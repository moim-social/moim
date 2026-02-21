import {
  Accept,
  createFederation,
  Endpoints,
  exportJwk,
  Follow,
  generateCryptoKeyPair,
  Image,
  importJwk,
  MemoryKvStore,
  parseSemVer,
  Person,
} from "@fedify/fedify";
import type { Context, RequestContext } from "@fedify/fedify";
import { and, count, eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, users } from "~/server/db/schema";
import { env } from "~/server/env";

export const federation = createFederation<void>({
  kv: new MemoryKvStore(),
});

/**
 * Get a Fedify context for use in business logic (no request needed).
 * Uses the configured BASE_URL as the canonical origin.
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
  .setActorDispatcher("/ap/{identifier}", async (ctx, identifier) => {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.handle, identifier))
      .limit(1);
    if (!user) return null;

    const keys = await ctx.getActorKeyPairs(identifier);
    return new Person({
      id: ctx.getActorUri(identifier),
      preferredUsername: user.handle,
      name: user.displayName,
      summary: user.summary ?? "",
      url: new URL(`/@/${user.handle}`, ctx.canonicalOrigin),
      inbox: ctx.getInboxUri(identifier),
      outbox: ctx.getOutboxUri(identifier),
      endpoints: new Endpoints({ sharedInbox: ctx.getInboxUri() }),
      publicKey: keys[0]?.cryptographicKey,
      assertionMethods: keys.map((k) => k.multikey),
      icon: user.avatarUrl
        ? new Image({ url: new URL(user.avatarUrl), mediaType: "image/png" })
        : undefined,
    });
  })
  .mapHandle(async (_ctx, username) => {
    const [user] = await db
      .select({ handle: users.handle })
      .from(users)
      .where(eq(users.handle, username))
      .limit(1);
    return user?.handle ?? null;
  })
  .mapAlias((_ctx, resource: URL) => {
    const m = /^\/@\/(\w+)$/.exec(resource.pathname);
    if (m == null) return null;
    return { username: m[1] };
  })
  .setKeyPairsDispatcher(async (ctx, identifier) => {
    const [actor] = await db
      .select()
      .from(actors)
      .where(and(eq(actors.handle, identifier), eq(actors.isLocal, true)))
      .limit(1);

    if (actor?.publicKeyPem && actor?.privateKeyPem) {
      return [
        {
          privateKey: await importJwk(
            JSON.parse(actor.privateKeyPem),
            "private",
          ),
          publicKey: await importJwk(
            JSON.parse(actor.publicKeyPem),
            "public",
          ),
        },
      ];
    }

    // Generate new RSA key pair
    const keyPair = await generateCryptoKeyPair("RSASSA-PKCS1-v1_5");
    const publicJwk = JSON.stringify(await exportJwk(keyPair.publicKey));
    const privateJwk = JSON.stringify(await exportJwk(keyPair.privateKey));

    if (!actor) {
      await db.insert(actors).values({
        handle: identifier,
        actorUrl: ctx.getActorUri(identifier).href,
        inboxUrl: ctx.getInboxUri(identifier).href,
        outboxUrl: ctx.getOutboxUri(identifier).href,
        publicKeyPem: publicJwk,
        privateKeyPem: privateJwk,
        isLocal: true,
      });
    } else {
      await db
        .update(actors)
        .set({ publicKeyPem: publicJwk, privateKeyPem: privateJwk })
        .where(eq(actors.id, actor.id));
    }

    return [keyPair];
  });

// --- NodeInfo ---
federation.setNodeInfoDispatcher("/nodeinfo/2.0", async () => {
  const [result] = await db.select({ total: count() }).from(users);
  const totalUsers = result?.total ?? 0;

  return {
    software: {
      name: "moim",
      version: parseSemVer("0.1.0"),
    },
    protocols: ["activitypub"] as const,
    services: { inbound: [], outbound: [] },
    usage: {
      users: { total: totalUsers, activeMonth: totalUsers, activeHalfyear: totalUsers },
      localPosts: 0,
      localComments: 0,
    },
    openRegistrations: false,
  };
});

// --- Inbox listeners ---
federation
  .setInboxListeners("/ap/{identifier}/inbox", "/ap/inbox")
  .on(Follow, async (ctx, follow) => {
    if (follow.objectId == null) return;

    const parsed = ctx.parseUri(follow.objectId);
    if (parsed == null || parsed.type !== "actor") return;

    const follower = await follow.getActor();
    if (follower?.id == null || follower?.inboxId == null) return;

    // Auto-accept: send Accept back to follower
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
  });

// --- Outbox dispatcher (empty for now) ---
federation.setOutboxDispatcher(
  "/ap/{identifier}/outbox",
  async () => ({ items: [] }),
);
