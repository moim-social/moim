import {
  Accept,
  Application,
  Create,
  createFederation,
  Endpoints,
  exportJwk,
  Follow,
  generateCryptoKeyPair,
  Group,
  Image,
  importJwk,
  InProcessMessageQueue,
  MemoryKvStore,
  Note,
  Place,
  parseSemVer,
  Person,
  PropertyValue,
  PUBLIC_COLLECTION,
  Question,
  Reject,
  Service,
  Undo,
} from "@fedify/fedify";
import type { Context, RequestContext } from "@fedify/fedify";
import { Temporal } from "@js-temporal/polyfill";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, follows, groupMembers, keypairs, otpChallenges, otpVotes, places, posts, users } from "~/server/db/schema";
import { env } from "~/server/env";
import { EMOJI_SET } from "~/server/fediverse/otp";

// --- Instance actor key (parsed once at startup) ---
let instanceKeyPair: CryptoKeyPair | undefined;

async function loadInstanceKey(): Promise<CryptoKeyPair | undefined> {
  if (!env.instanceActorKey) return undefined;
  try {
    const jwk = JSON.parse(env.instanceActorKey);
    if (jwk.kty !== "RSA") return undefined;
    const privateKey = await importJwk(jwk, "private");
    const publicKey = await importJwk(
      { kty: jwk.kty, alg: jwk.alg, e: jwk.e, n: jwk.n, key_ops: ["verify"] },
      "public",
    );
    return { privateKey, publicKey };
  } catch {
    return undefined;
  }
}

const instanceKeyPromise = loadInstanceKey().then((kp) => {
  instanceKeyPair = kp;
  return kp;
});

function getInstanceHostname(): string {
  return new URL(env.federationOrigin).hostname;
}

// --- Instance actor auto-provisioning ---
async function ensureInstanceActor(ctx: Context<void>): Promise<void> {
  const hostname = getInstanceHostname();
  const [existing] = await db
    .select({ id: actors.id })
    .from(actors)
    .where(and(eq(actors.handle, hostname), eq(actors.isLocal, true)))
    .limit(1);
  if (existing) return;

  await db
    .insert(actors)
    .values({
      handle: hostname,
      type: "Application",
      actorUrl: ctx.getActorUri(hostname).href,
      iri: ctx.getActorUri(hostname).href,
      inboxUrl: ctx.getInboxUri(hostname).href,
      outboxUrl: ctx.getOutboxUri(hostname).href,
      sharedInboxUrl: ctx.getInboxUri().href,
      followersUrl: ctx.getFollowersUri(hostname).href,
      followingUrl: ctx.getFollowingUri(hostname).href,
      domain: hostname,
      isLocal: true,
      name: "Moim",
      summary: "An instance actor for Moim.",
    })
    .onConflictDoNothing();
}

// --- Federation instance ---
export const federation = createFederation<void>({
  kv: new MemoryKvStore(),
  queue: new InProcessMessageQueue(),
});

/**
 * Get a Fedify context for use in business logic (no request needed).
 */
export function getFederationContext(): Context<void> {
  return federation.createContext(new URL(env.baseUrl), undefined as void);
}

/**
 * Get a request-aware Fedify context for use in API route handlers.
 */
export function getRequestContext(request: Request): RequestContext<void> {
  return federation.createContext(request, undefined as void);
}

// --- Actor dispatcher ---
federation
  .setActorDispatcher("/ap/actors/{identifier}", async (ctx, identifier) => {
    await instanceKeyPromise;

    // Instance actor (auto-provisioned in DB)
    if (identifier === getInstanceHostname()) {
      await ensureInstanceActor(ctx);
      const keys = await ctx.getActorKeyPairs(identifier);
      return new Application({
        id: ctx.getActorUri(identifier),
        preferredUsername: identifier,
        name: "Moim",
        summary: "An instance actor for Moim.",
        manuallyApprovesFollowers: true,
        inbox: ctx.getInboxUri(identifier),
        outbox: ctx.getOutboxUri(identifier),
        endpoints: new Endpoints({ sharedInbox: ctx.getInboxUri() }),
        following: ctx.getFollowingUri(identifier),
        followers: ctx.getFollowersUri(identifier),
        publicKey: keys[0]?.cryptographicKey,
        assertionMethods: keys.map((k) => k.multikey),
      });
    }

    // Check actors table first (covers Group and pre-created Person actors)
    let [actor] = await db
      .select()
      .from(actors)
      .where(and(eq(actors.handle, identifier), eq(actors.isLocal, true)))
      .limit(1);

    // Group actor
    if (actor?.type === "Group") {
      const keys = await ctx.getActorKeyPairs(identifier);

      // Build PropertyValue attachments
      const attachments: PropertyValue[] = [];

      // Page link
      const pageUrl = new URL(`/groups/@${identifier}`, ctx.canonicalOrigin).href;
      attachments.push(
        new PropertyValue({
          name: "page",
          value: `<a href="${pageUrl}" rel="nofollow noopener noreferrer" target="_blank">${pageUrl}</a>`,
        }),
      );

      // Website (if set)
      if (actor.website) {
        attachments.push(
          new PropertyValue({
            name: "website",
            value: `<a href="${actor.website}" rel="nofollow noopener noreferrer" target="_blank">${actor.website}</a>`,
          }),
        );
      }

      // Moderators
      const moderatorRows = await db
        .select({
          handle: actors.handle,
          actorUrl: actors.actorUrl,
        })
        .from(groupMembers)
        .innerJoin(actors, eq(groupMembers.memberActorId, actors.id))
        .where(eq(groupMembers.groupActorId, actor.id));

      if (moderatorRows.length > 0) {
        const moderatorLinks = moderatorRows
          .map((m) => `<a href="${m.actorUrl}" rel="nofollow noopener noreferrer" target="_blank">@${m.handle}</a>`)
          .join(", ");
        attachments.push(
          new PropertyValue({ name: "moderators", value: moderatorLinks }),
        );
      }

      return new Group({
        id: ctx.getActorUri(identifier),
        preferredUsername: identifier,
        name: actor.name ?? identifier,
        summary: actor.summary ?? "",
        url: new URL(`/groups/@${identifier}`, ctx.canonicalOrigin),
        inbox: ctx.getInboxUri(identifier),
        outbox: ctx.getOutboxUri(identifier),
        endpoints: new Endpoints({ sharedInbox: ctx.getInboxUri() }),
        following: ctx.getFollowingUri(identifier),
        followers: ctx.getFollowersUri(identifier),
        manuallyApprovesFollowers: actor.manuallyApprovesFollowers,
        publicKey: keys[0]?.cryptographicKey,
        assertionMethods: keys.map((k) => k.multikey),
        attachments,
      });
    }

    // Service actor (category feeds)
    if (actor?.type === "Service") {
      const keys = await ctx.getActorKeyPairs(identifier);
      return new Service({
        id: ctx.getActorUri(identifier),
        preferredUsername: identifier,
        name: actor.name ?? identifier,
        summary: actor.summary ?? "",
        inbox: ctx.getInboxUri(identifier),
        outbox: ctx.getOutboxUri(identifier),
        endpoints: new Endpoints({ sharedInbox: ctx.getInboxUri() }),
        following: ctx.getFollowingUri(identifier),
        followers: ctx.getFollowersUri(identifier),
        manuallyApprovesFollowers: false,
        publicKey: keys[0]?.cryptographicKey,
        assertionMethods: keys.map((k) => k.multikey),
      });
    }

    // Person actor: lazy-create from users table if no actor exists yet
    if (!actor) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.handle, identifier))
        .limit(1);
      if (!user) return null;

      const [inserted] = await db
        .insert(actors)
        .values({
          handle: identifier,
          type: "Person",
          actorUrl: ctx.getActorUri(identifier).href,
          iri: ctx.getActorUri(identifier).href,
          url: new URL(`/users/@${user.handle}`, ctx.canonicalOrigin).href,
          name: user.displayName,
          summary: user.summary ?? "",
          inboxUrl: ctx.getInboxUri(identifier).href,
          outboxUrl: ctx.getOutboxUri(identifier).href,
          sharedInboxUrl: ctx.getInboxUri().href,
          followersUrl: ctx.getFollowersUri(identifier).href,
          followingUrl: ctx.getFollowingUri(identifier).href,
          domain: new URL(ctx.canonicalOrigin).hostname,
          isLocal: true,
          userId: user.id,
        })
        .returning();
      actor = inserted;
    }

    // Load user for Person actor display info
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, actor.userId!))
      .limit(1);
    if (!user) return null;

    const keys = await ctx.getActorKeyPairs(identifier);
    return new Person({
      id: ctx.getActorUri(identifier),
      preferredUsername: user.handle,
      name: user.displayName,
      summary: user.summary ?? "",
      url: new URL(`/users/@${user.handle}`, ctx.canonicalOrigin),
      inbox: ctx.getInboxUri(identifier),
      outbox: ctx.getOutboxUri(identifier),
      endpoints: new Endpoints({ sharedInbox: ctx.getInboxUri() }),
      following: ctx.getFollowingUri(identifier),
      followers: ctx.getFollowersUri(identifier),
      manuallyApprovesFollowers: actor.manuallyApprovesFollowers,
      publicKey: keys[0]?.cryptographicKey,
      assertionMethods: keys.map((k) => k.multikey),
      icon: user.avatarUrl
        ? new Image({ url: new URL(user.avatarUrl), mediaType: "image/png" })
        : undefined,
    });
  })
  .mapHandle(async (_ctx, username) => {
    // Instance actor
    if (username === getInstanceHostname()) {
      return username;
    }

    // Check actors table first (covers Group + pre-created Person actors)
    const [actor] = await db
      .select({ handle: actors.handle })
      .from(actors)
      .where(and(eq(actors.handle, username), eq(actors.isLocal, true)))
      .limit(1);
    if (actor) return actor.handle;

    // Fallback: users table (for Person actors not yet in actors table)
    const [user] = await db
      .select({ handle: users.handle })
      .from(users)
      .where(eq(users.handle, username))
      .limit(1);
    return user?.handle ?? null;
  })
  .mapAlias((_ctx, resource: URL) => {
    const m = /^\/@([a-z0-9_][a-z0-9_.]*[a-z0-9_])$/i.exec(resource.pathname);
    if (m == null) return null;
    return { username: m[1] };
  })
  .setKeyPairsDispatcher(async (_ctx, identifier) => {
    await instanceKeyPromise;

    // Instance actor key from env var (backwards compatibility)
    if (instanceKeyPair && identifier === getInstanceHostname()) {
      return [instanceKeyPair];
    }

    // For all local actors (including instance actor when env var not set)
    const [actor] = await db
      .select()
      .from(actors)
      .where(and(eq(actors.handle, identifier), eq(actors.isLocal, true)))
      .limit(1);
    if (!actor) return [];

    // Load existing key pairs
    const existingKeys = await db
      .select()
      .from(keypairs)
      .where(and(eq(keypairs.actorId, actor.id), eq(keypairs.isActive, true)))
      .orderBy(keypairs.algorithm, keypairs.createdAt);

    const result: CryptoKeyPair[] = [];

    for (const algorithm of ["RSASSA-PKCS1-v1_5", "Ed25519"] as const) {
      const existing = existingKeys.find((k) => k.algorithm === algorithm);
      if (existing) {
        result.push({
          privateKey: await importJwk(JSON.parse(existing.privateKey), "private"),
          publicKey: await importJwk(JSON.parse(existing.publicKey), "public"),
        });
      } else {
        // Auto-generate missing key type
        const generated = await generateCryptoKeyPair(algorithm);
        const publicJwk = JSON.stringify(await exportJwk(generated.publicKey));
        const privateJwk = JSON.stringify(await exportJwk(generated.privateKey));

        await db.insert(keypairs).values({
          algorithm,
          publicKey: publicJwk,
          privateKey: privateJwk,
          actorId: actor.id,
        });

        result.push(generated);
      }
    }

    return result;
  });

// --- Note object dispatcher ---
federation.setObjectDispatcher(
  Note,
  "/ap/notes/{noteId}",
  async (ctx, { noteId }) => {
    const [post] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, noteId))
      .limit(1);
    if (!post) return null;

    const [actor] = await db
      .select()
      .from(actors)
      .where(and(eq(actors.id, post.actorId), eq(actors.isLocal, true)))
      .limit(1);
    if (!actor) return null;

    return new Note({
      id: ctx.getObjectUri(Note, { noteId }),
      attribution: ctx.getActorUri(actor.handle),
      content: post.content,
      url: new URL(`/notes/${noteId}`, ctx.canonicalOrigin),
      published: Temporal.Instant.from(post.published.toISOString()),
      to: PUBLIC_COLLECTION,
      ccs: [ctx.getFollowersUri(actor.handle)],
    });
  },
);

// --- Question object dispatcher (for OTP polls) ---
federation.setObjectDispatcher(
  Question,
  "/ap/questions/{questionId}",
  async (ctx, { questionId }) => {
    const [challenge] = await db
      .select()
      .from(otpChallenges)
      .where(eq(otpChallenges.questionId, questionId))
      .limit(1);
    if (!challenge) return null;

    const instanceId = getInstanceHostname();
    return new Question({
      id: ctx.getObjectUri(Question, { questionId }),
      attribution: ctx.getActorUri(instanceId),
      to: new URL(challenge.actorUrl),
      inclusiveOptions: EMOJI_SET.map((emoji: string) => new Note({ name: emoji })),
      closed: Temporal.Instant.from(challenge.expiresAt.toISOString()),
      published: Temporal.Instant.from(challenge.createdAt.toISOString()),
    });
  },
);

// --- Place object dispatcher ---
federation.setObjectDispatcher(
  Place,
  "/ap/places/{placeId}",
  async (ctx, { placeId }) => {
    const [place] = await db
      .select()
      .from(places)
      .where(eq(places.id, placeId))
      .limit(1);
    if (!place) return null;

    return new Place({
      id: ctx.getObjectUri(Place, { placeId }),
      name: place.name,
      content: place.description ?? undefined,
      latitude: place.latitude ? parseFloat(place.latitude) : undefined,
      longitude: place.longitude ? parseFloat(place.longitude) : undefined,
      url: new URL(`/places/${placeId}`, ctx.canonicalOrigin),
    });
  },
);

// --- NodeInfo ---
federation.setNodeInfoDispatcher("/nodeinfo/2.1", async () => {
  const [result] = await db.select({ total: count() }).from(users);
  const totalUsers = result?.total ?? 0;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const halfYearAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

  const [activeMonth] = await db
    .select({ total: count() })
    .from(users)
    .where(sql`${users.updatedAt} > ${thirtyDaysAgo}`);

  const [activeHalfyear] = await db
    .select({ total: count() })
    .from(users)
    .where(sql`${users.updatedAt} > ${halfYearAgo}`);

  return {
    software: {
      name: "moim",
      version: parseSemVer("0.1.0"),
    },
    protocols: ["activitypub"] as const,
    services: { inbound: [], outbound: [] },
    usage: {
      users: {
        total: totalUsers,
        activeMonth: activeMonth?.total ?? 0,
        activeHalfyear: activeHalfyear?.total ?? 0,
      },
      localPosts: await db.select({ total: count() }).from(posts).then(([r]) => r?.total ?? 0),
      localComments: 0,
    },
    openRegistrations: false,
  };
});

// --- Inbox listeners ---
federation
  .setInboxListeners("/ap/actors/{identifier}/inbox", "/ap/inbox")
  .setSharedKeyDispatcher((_ctx) => ({
    identifier: getInstanceHostname(),
  }))
  .on(Follow, async (ctx, follow) => {
    if (follow.objectId == null) return;

    const parsed = ctx.parseUri(follow.objectId);
    if (parsed == null || parsed.type !== "actor") return;

    const follower = await follow.getActor();
    if (follower?.id == null || follower?.inboxId == null) return;

    // Find or create target actor
    const [targetActor] = await db
      .select()
      .from(actors)
      .where(eq(actors.handle, parsed.identifier))
      .limit(1);
    if (!targetActor) return;

    // Persist remote follower as actor if not exists
    let [followerActor] = await db
      .select()
      .from(actors)
      .where(eq(actors.actorUrl, follower.id.href))
      .limit(1);

    if (!followerActor) {
      const [inserted] = await db
        .insert(actors)
        .values({
          handle: `${follower.preferredUsername}@${follower.id.hostname}`,
          type: "Person",
          actorUrl: follower.id.href,
          iri: follower.id.href,
          url: follower.url instanceof URL ? follower.url.href : null,
          name: follower.name?.toString() ?? null,
          summary: follower.summary?.toString() ?? null,
          inboxUrl: follower.inboxId?.href ?? null,
          outboxUrl: follower.outboxId?.href ?? null,
          sharedInboxUrl: follower.endpoints?.sharedInbox instanceof URL
            ? follower.endpoints.sharedInbox.href
            : null,
          domain: follower.id.hostname,
          isLocal: false,
        })
        .returning();
      followerActor = inserted;
    }

    // Create follow relationship
    const [existingFollow] = await db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.followerId, followerActor.id),
          eq(follows.followingId, targetActor.id),
        ),
      )
      .limit(1);

    if (!existingFollow) {
      await db.insert(follows).values({
        followerId: followerActor.id,
        followingId: targetActor.id,
        status: "pending",
      });
    }

    // Auto-accept if target doesn't manually approve
    if (!targetActor.manuallyApprovesFollowers) {
      await db
        .update(follows)
        .set({ status: "accepted", acceptedAt: new Date() })
        .where(
          and(
            eq(follows.followerId, followerActor.id),
            eq(follows.followingId, targetActor.id),
          ),
        );

      // Increment follower count
      await db
        .update(actors)
        .set({ followersCount: sql`${actors.followersCount} + 1` })
        .where(eq(actors.id, targetActor.id));

      const accept = new Accept({
        actor: follow.objectId,
        to: follow.actorId,
        object: follow,
      });
      await ctx.sendActivity(
        { identifier: parsed.identifier },
        follower,
        accept,
      );
    }
  })
  .on(Undo, async (ctx, undo) => {
    const object = await undo.getObject();

    if (object instanceof Follow) {
      // Undo Follow
      if (undo.actorId == null || object.objectId == null) return;

      const parsed = ctx.parseUri(object.objectId);
      if (parsed == null || parsed.type !== "actor") return;

      const [followerActor] = await db
        .select()
        .from(actors)
        .where(eq(actors.actorUrl, undo.actorId.href))
        .limit(1);

      const [followedActor] = await db
        .select()
        .from(actors)
        .where(eq(actors.handle, parsed.identifier))
        .limit(1);

      if (followerActor && followedActor) {
        // Check if follow was accepted before deleting
        const [existingFollow] = await db
          .select()
          .from(follows)
          .where(
            and(
              eq(follows.followerId, followerActor.id),
              eq(follows.followingId, followedActor.id),
            ),
          )
          .limit(1);

        if (existingFollow?.status === "accepted") {
          await db
            .update(actors)
            .set({ followersCount: sql`GREATEST(${actors.followersCount} - 1, 0)` })
            .where(eq(actors.id, followedActor.id));
        }

        await db
          .delete(follows)
          .where(
            and(
              eq(follows.followerId, followerActor.id),
              eq(follows.followingId, followedActor.id),
            ),
          );
      }
    }
  })
  .on(Accept, async (ctx, accept) => {
    const object = await accept.getObject({ crossOrigin: "trust" });
    if (!(object instanceof Follow)) return;
    if (accept.actorId == null || object.actorId == null) return;

    // Find the requesting actor (who sent the Follow)
    const [requestedActor] = await db
      .select()
      .from(actors)
      .where(eq(actors.actorUrl, object.actorId.href))
      .limit(1);

    // Find the target actor (who accepted)
    const [targetActor] = await db
      .select()
      .from(actors)
      .where(eq(actors.actorUrl, accept.actorId.href))
      .limit(1);

    if (requestedActor && targetActor) {
      await db
        .update(follows)
        .set({ status: "accepted", acceptedAt: new Date() })
        .where(
          and(
            eq(follows.followerId, requestedActor.id),
            eq(follows.followingId, targetActor.id),
          ),
        );
    }
  })
  .on(Reject, async (ctx, reject) => {
    const object = await reject.getObject({ crossOrigin: "trust" });
    if (!(object instanceof Follow)) return;
    if (reject.actorId == null || object.actorId == null) return;

    const [requestedActor] = await db
      .select()
      .from(actors)
      .where(eq(actors.actorUrl, object.actorId.href))
      .limit(1);

    const [targetActor] = await db
      .select()
      .from(actors)
      .where(eq(actors.actorUrl, reject.actorId.href))
      .limit(1);

    if (requestedActor && targetActor) {
      await db
        .delete(follows)
        .where(
          and(
            eq(follows.followerId, requestedActor.id),
            eq(follows.followingId, targetActor.id),
          ),
        );
    }
  })
  .on(Create, async (ctx, create) => {
    // Handle poll votes (Create(Note) with inReplyTo pointing to our Question)
    const object = await create.getObject();
    if (!(object instanceof Note)) return;

    const replyTo = object.replyTargetId;
    if (!replyTo) return;

    const name = object.name?.toString();
    if (!name || !(EMOJI_SET as readonly string[]).includes(name)) return;

    // Extract questionId from the replyTo URI
    let questionId: string | null = null;
    const parsed = ctx.parseUri(replyTo);
    if (parsed?.type === "object" && "questionId" in parsed.values) {
      questionId = parsed.values.questionId as string;
    } else {
      // Regex fallback
      const match = replyTo.pathname?.match(/\/ap\/questions\/(.+)$/);
      if (match) questionId = match[1];
    }
    if (!questionId) return;

    // Find the pending challenge
    const [challenge] = await db
      .select()
      .from(otpChallenges)
      .where(
        and(
          eq(otpChallenges.questionId, questionId),
          eq(otpChallenges.status, "pending"),
        ),
      )
      .limit(1);
    if (!challenge) return;

    // Check expiry
    if (new Date(challenge.expiresAt).getTime() < Date.now()) return;

    // Verify voter identity
    const voterActorUrl = create.actorId?.href;
    if (!voterActorUrl || voterActorUrl !== challenge.actorUrl) return;

    // Record the vote
    await db
      .insert(otpVotes)
      .values({
        challengeId: challenge.id,
        emoji: name,
        voterActorUrl,
      })
      .onConflictDoNothing();
  });

// --- Outbox dispatcher ---
federation
  .setOutboxDispatcher(
    "/ap/actors/{identifier}/outbox",
    async (ctx, identifier, cursor) => {
      const [actor] = await db
        .select()
        .from(actors)
        .where(and(eq(actors.handle, identifier), eq(actors.isLocal, true)))
        .limit(1);
      if (!actor) return null;

      const limit = 20;
      const offset = cursor ? parseInt(cursor, 10) : 0;

      const postRows = await db
        .select()
        .from(posts)
        .where(eq(posts.actorId, actor.id))
        .orderBy(sql`${posts.published} DESC`)
        .limit(limit)
        .offset(offset);

      const items = postRows.map((post) => {
        const noteUri = ctx.getObjectUri(Note, {
          noteId: post.id,
        });
        return new Create({
          id: new URL(`${noteUri.href}#activity`),
          actor: ctx.getActorUri(identifier),
          object: new Note({
            id: noteUri,
            attribution: ctx.getActorUri(identifier),
            content: post.content,
            published: Temporal.Instant.from(post.published.toISOString()),
            to: PUBLIC_COLLECTION,
            ccs: [ctx.getFollowersUri(identifier)],
          }),
        });
      });

      const [totalResult] = await db
        .select({ total: count() })
        .from(posts)
        .where(eq(posts.actorId, actor.id));
      const total = totalResult?.total ?? 0;
      const isLast = offset + limit >= total;

      return {
        items,
        nextCursor: isLast ? null : String(offset + limit),
      };
    },
  )
  .setFirstCursor(async () => "0");

// --- Followers collection ---
federation
  .setFollowersDispatcher(
    "/ap/actors/{identifier}/followers",
    async (_ctx, identifier, cursor) => {
      const [actor] = await db
        .select()
        .from(actors)
        .where(eq(actors.handle, identifier))
        .limit(1);
      if (!actor) return null;

      const limit = 10;
      const offset = cursor ? parseInt(cursor, 10) : 0;

      const followerRows = await db
        .select({
          followerActorUrl: actors.actorUrl,
          followerInboxUrl: actors.inboxUrl,
        })
        .from(follows)
        .innerJoin(actors, eq(follows.followerId, actors.id))
        .where(
          and(
            eq(follows.followingId, actor.id),
            eq(follows.status, "accepted"),
          ),
        )
        .limit(limit)
        .offset(offset);

      const [totalResult] = await db
        .select({ total: count() })
        .from(follows)
        .where(
          and(
            eq(follows.followingId, actor.id),
            eq(follows.status, "accepted"),
          ),
        );
      const total = totalResult?.total ?? 0;
      const isLast = offset + limit >= total;

      return {
        items: followerRows.map((row) => ({
          id: new URL(row.followerActorUrl),
          inboxId: row.followerInboxUrl ? new URL(row.followerInboxUrl) : null,
        })),
        nextCursor: isLast ? null : String(offset + limit),
      };
    },
  )
  .setFirstCursor(async () => "0");

// --- Following collection ---
federation
  .setFollowingDispatcher(
    "/ap/actors/{identifier}/following",
    async (_ctx, identifier, cursor) => {
      const [actor] = await db
        .select()
        .from(actors)
        .where(eq(actors.handle, identifier))
        .limit(1);
      if (!actor) return null;

      const limit = 10;
      const offset = cursor ? parseInt(cursor, 10) : 0;

      const followingRows = await db
        .select({ followingActorUrl: actors.actorUrl })
        .from(follows)
        .innerJoin(actors, eq(follows.followingId, actors.id))
        .where(
          and(
            eq(follows.followerId, actor.id),
            eq(follows.status, "accepted"),
          ),
        )
        .limit(limit)
        .offset(offset);

      const [totalResult] = await db
        .select({ total: count() })
        .from(follows)
        .where(
          and(
            eq(follows.followerId, actor.id),
            eq(follows.status, "accepted"),
          ),
        );
      const total = totalResult?.total ?? 0;
      const isLast = offset + limit >= total;

      return {
        items: followingRows.map((row) => new URL(row.followingActorUrl)),
        nextCursor: isLast ? null : String(offset + limit),
      };
    },
  )
  .setFirstCursor(async () => "0");
