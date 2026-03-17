import { randomBytes } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import { rsvps, rsvpAnswers, events } from "~/server/db/schema";
import { parseCookie } from "~/server/auth";
import { autoPromoteWaitlist } from "~/server/events/waitlist";
import { resolveTier, validateRequiredAnswers, checkCapacityAndDetermineStatus } from "~/server/events/rsvp-helpers";
import { checkRateLimit, getClientIp } from "~/server/rate-limit";

type ContactFieldConfig = {
  email?: "required" | "optional" | "hidden";
  phone?: "required" | "optional" | "hidden";
};

function validateContactFields(
  config: ContactFieldConfig | null,
  email: string | undefined,
  phone: string | undefined,
): Response | null {
  if (!config) return null;

  if (config.email === "required" && !email?.trim()) {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }
  if (config.phone === "required" && !phone?.trim()) {
    return Response.json({ error: "Phone number is required" }, { status: 400 });
  }
  return null;
}

/**
 * POST handler — create an anonymous RSVP
 */
export const POST = async ({ request }: { request: Request }) => {
  const body = (await request.json().catch(() => null)) as {
    eventId?: string;
    tierId?: string;
    displayName?: string;
    email?: string;
    phone?: string;
    answers?: Array<{ questionId: string; answer: string }>;
    consent?: boolean;
  } | null;

  if (!body?.eventId || !body?.displayName?.trim()) {
    return Response.json({ error: "eventId and displayName are required" }, { status: 400 });
  }

  if (body.consent !== true) {
    return Response.json({ error: "Consent is required for anonymous registration" }, { status: 400 });
  }

  // Rate limit by IP + eventId (prevents rapid-fire abuse per event)
  const ip = getClientIp(request);
  const rateLimitResponse = checkRateLimit(`${ip}:${body.eventId}`);
  if (rateLimitResponse) return rateLimitResponse;

  // Load event and check anonymous RSVP is allowed
  const [event] = await db
    .select({
      id: events.id,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      allowAnonymousRsvp: events.allowAnonymousRsvp,
      anonymousContactFields: events.anonymousContactFields,
    })
    .from(events)
    .where(eq(events.id, body.eventId))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  if (!event.allowAnonymousRsvp) {
    return Response.json({ error: "Anonymous RSVPs are not allowed for this event" }, { status: 403 });
  }

  // Validate contact fields against event config
  const contactConfig = event.anonymousContactFields as ContactFieldConfig | null;
  const contactError = validateContactFields(contactConfig, body.email, body.phone);
  if (contactError) return contactError;

  // Check for existing anonymous RSVP via cookie
  const cookieName = `anon_rsvp_${body.eventId}`;
  const existingToken = parseCookie(request.headers.get("cookie"), cookieName);
  if (existingToken) {
    const [existing] = await db
      .select({ status: rsvps.status })
      .from(rsvps)
      .where(and(eq(rsvps.token, existingToken), eq(rsvps.eventId, body.eventId)))
      .limit(1);

    if (existing && (existing.status === "accepted" || existing.status === "waitlisted")) {
      return Response.json(
        { error: "You already have a registration for this event" },
        { status: 409 },
      );
    }
  }

  // Resolve tier
  const tierResult = await resolveTier(body.eventId, body.tierId, event.startsAt);
  if (tierResult instanceof Response) return tierResult;

  // Validate required questions
  const validationError = await validateRequiredAnswers(body.eventId, body.answers);
  if (validationError) return validationError;

  // Generate token
  const token = randomBytes(32).toString("hex");

  try {
    let finalStatus: string = "accepted";

    await db.transaction(async (tx) => {
      // Check capacity
      let effectiveStatus: "accepted" | "waitlisted" = "accepted";
      if (tierResult.tierId && tierResult.capacity != null && tierResult.capacity > 0) {
        effectiveStatus = await checkCapacityAndDetermineStatus(
          tx,
          tierResult.tierId,
          tierResult.capacity,
        );
      }

      // Insert RSVP
      const [newRsvp] = await tx
        .insert(rsvps)
        .values({
          userId: null,
          eventId: body.eventId!,
          tierId: tierResult.tierId,
          status: effectiveStatus,
          token,
          displayName: body.displayName!.trim(),
          email: body.email?.trim() || null,
          phone: body.phone?.trim() || null,
        })
        .returning({ id: rsvps.id });

      finalStatus = effectiveStatus;

      // Insert answers
      if (body.answers && body.answers.length > 0) {
        const validAnswers = body.answers.filter((a) => a.answer.trim());
        if (validAnswers.length > 0) {
          await tx.insert(rsvpAnswers).values(
            validAnswers.map((a) => ({
              rsvpId: newRsvp.id,
              userId: null,
              eventId: body.eventId!,
              questionId: a.questionId,
              answer: a.answer,
            })),
          );
        }
      }
    });

    // Compute cookie expiry: event end + 30 days (for GDPR window)
    const expiryDate = event.endsAt ?? new Date(event.startsAt.getTime() + 86400000);
    const maxAge = Math.max(
      0,
      Math.floor((expiryDate.getTime() + 30 * 86400000 - Date.now()) / 1000),
    );

    return new Response(
      JSON.stringify({ ok: true, token, status: finalStatus }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`,
        },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to submit anonymous RSVP";
    return Response.json({ error: message }, { status: 500 });
  }
};

/**
 * DELETE handler — cancel an anonymous RSVP via token
 */
export const DELETE = async ({ request, eventId }: { request: Request; eventId: string }) => {
  const cookieName = `anon_rsvp_${eventId}`;
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || parseCookie(request.headers.get("cookie"), cookieName);

  if (!token) {
    return Response.json({ error: "No anonymous RSVP token found" }, { status: 400 });
  }

  try {
    let found = false;

    await db.transaction(async (tx) => {
      const [rsvp] = await tx
        .select({ id: rsvps.id, status: rsvps.status, tierId: rsvps.tierId })
        .from(rsvps)
        .where(and(eq(rsvps.token, token), eq(rsvps.eventId, eventId)))
        .limit(1);

      if (!rsvp) return;
      found = true;

      await tx
        .update(rsvps)
        .set({ status: "declined", tierId: null })
        .where(eq(rsvps.id, rsvp.id));

      if (rsvp.status === "accepted" && rsvp.tierId) {
        await autoPromoteWaitlist(tx, rsvp.tierId, 1);
      }
    });

    if (!found) {
      return Response.json({ error: "RSVP not found" }, { status: 404 });
    }

    // Clear the cookie
    return new Response(
      JSON.stringify({ ok: true }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
        },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to cancel RSVP";
    return Response.json({ error: message }, { status: 500 });
  }
};
