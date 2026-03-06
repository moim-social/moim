import {
  type AnyPgColumn,
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  handle: varchar("handle", { length: 128 }).notNull().unique(), // proxy format: alice.mastodon.social
  fediverseHandle: varchar("fediverse_handle", { length: 128 }), // original: alice@mastodon.social (kept for backward compat, canonical source is userFediverseAccounts)
  displayName: varchar("display_name", { length: 200 }).notNull(),
  summary: text("summary"),
  avatarUrl: text("avatar_url"),
  avatarSourceHash: text("avatar_source_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userFediverseAccounts = pgTable("user_fediverse_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  fediverseHandle: varchar("fediverse_handle", { length: 128 }).notNull().unique(),
  proxyHandle: varchar("proxy_handle", { length: 128 }).notNull().unique(),
  isPrimary: boolean("is_primary").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const actors = pgTable("actors", {
  id: uuid("id").defaultRandom().primaryKey(),
  handle: varchar("handle", { length: 128 }).notNull().unique(),
  type: varchar("type", { length: 32 }).notNull().default("Person"), // Person, Group, Application, Service
  actorUrl: text("actor_url").notNull(),
  iri: text("iri"),
  url: text("url"),
  name: text("name"),
  summary: text("summary"),
  inboxUrl: text("inbox_url"),
  outboxUrl: text("outbox_url"),
  sharedInboxUrl: text("shared_inbox_url"),
  followersUrl: text("followers_url"),
  followingUrl: text("following_url"),
  domain: text("domain"),
  isLocal: boolean("is_local").default(false).notNull(),
  manuallyApprovesFollowers: boolean("manually_approves_followers").default(false).notNull(),
  followersCount: integer("followers_count").default(0).notNull(),
  followingCount: integer("following_count").default(0).notNull(),
  // Owner: for Person actors, points to the user; for Group actors, can be null (managed via group_members)
  userId: uuid("user_id").references(() => users.id),
  website: text("website"),
  avatarUrl: text("avatar_url"),
  language: varchar("language", { length: 16 }), // BCP 47 tag e.g. "en", "ko", "ja"
  timezone: varchar("timezone", { length: 64 }), // IANA e.g. "Asia/Seoul"
  categories: jsonb("categories"), // string[] of category IDs (for Group actors)
  verified: boolean("verified").default(false).notNull(),
  raw: jsonb("raw"),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const keypairs = pgTable("keypairs", {
  id: uuid("id").defaultRandom().primaryKey(),
  algorithm: varchar("algorithm", { length: 32 }).notNull(), // 'RSASSA-PKCS1-v1_5' or 'Ed25519'
  publicKey: text("public_key").notNull(),  // JWK JSON
  privateKey: text("private_key").notNull(), // JWK JSON
  actorId: uuid("actor_id").references(() => actors.id).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const follows = pgTable("follows", {
  id: uuid("id").defaultRandom().primaryKey(),
  followerId: uuid("follower_id").references(() => actors.id).notNull(),
  followingId: uuid("following_id").references(() => actors.id).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("pending"), // 'pending', 'accepted', 'rejected'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
});

export const posts = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => actors.id).notNull(),
  eventId: uuid("event_id").references(() => events.id),
  inReplyTo: text("in_reply_to"), // AP URI of the post this is replying to
  content: text("content").notNull(), // HTML
  imageUrl: text("image_url"), // attached image (e.g. map snapshot)
  published: timestamp("published", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: varchar("type", { length: 32 }).notNull(), // 'like', 'emoji_react', 'announce', 'reply', 'quote'
  actorId: uuid("actor_id").references(() => actors.id).notNull(),
  postId: uuid("post_id").references(() => posts.id).notNull(),
  eventId: uuid("event_id").references(() => events.id), // denormalized for direct dashboard queries
  emoji: varchar("emoji", { length: 64 }), // '⭐' for Like, actual emoji for EmojiReact, null for announce/reply
  activityUrl: text("activity_url"), // AP activity URI for dedup and Undo matching
  content: text("content"), // reply/quote text content for display
  replyPostId: uuid("reply_post_id").references(() => posts.id), // for type='reply'/'quote', the stored post
  raw: jsonb("raw"), // full AP activity JSON (includes custom emoji icon URLs in tags)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueEngagement: unique().on(table.actorId, table.postId, table.type, table.emoji),
}));

export const groupMembers = pgTable("group_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupActorId: uuid("group_actor_id").references(() => actors.id).notNull(),
  memberActorId: uuid("member_actor_id").references(() => actors.id).notNull(),
  role: varchar("role", { length: 32 }).notNull().default("owner"), // 'owner', 'moderator'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizerId: uuid("organizer_id").references(() => users.id).notNull(),
  groupActorId: uuid("group_actor_id").references(() => actors.id),
  categoryId: varchar("category_id", { length: 64 }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  timezone: varchar("timezone", { length: 64 }), // IANA e.g. "Asia/Seoul"
  location: text("location"),
  externalUrl: text("external_url").default("").notNull(),
  placeId: uuid("place_id").references(() => places.id),
  headerImageUrl: text("header_image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const eventOrganizers = pgTable("event_organizers", {
  eventId: uuid("event_id").references(() => events.id).notNull(),
  actorId: uuid("actor_id").references(() => actors.id).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.eventId, table.actorId] }),
}));

export const placeCategories = pgTable("place_categories", {
  slug: varchar("slug", { length: 64 }).primaryKey(),
  label: varchar("label", { length: 128 }).notNull(),
  emoji: varchar("emoji", { length: 16 }).notNull(),
  parentSlug: varchar("parent_slug", { length: 64 }).references((): AnyPgColumn => placeCategories.slug),
  sortOrder: integer("sort_order").default(0).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const places = pgTable("places", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: varchar("category_id", { length: 64 }).references(() => placeCategories.slug),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  latitude: varchar("latitude", { length: 32 }),
  longitude: varchar("longitude", { length: 32 }),
  address: text("address"),
  website: text("website"),
  mapImageUrl: text("map_image_url"), // cached static map snapshot URL
  createdById: uuid("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rsvps = pgTable("rsvps", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  eventId: uuid("event_id").references(() => events.id).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.eventId] }),
}));

export const eventQuestions = pgTable("event_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id).notNull(),
  question: text("question").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  required: boolean("required").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rsvpAnswers = pgTable("rsvp_answers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  eventId: uuid("event_id").references(() => events.id).notNull(),
  questionId: uuid("question_id").references(() => eventQuestions.id).notNull(),
  answer: text("answer").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueAnswer: unique().on(table.userId, table.eventId, table.questionId),
}));

export const checkins = pgTable("checkins", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  placeId: uuid("place_id").references(() => places.id).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  label: varchar("label", { length: 64 }).notNull(),
});

export const eventTags = pgTable("event_tags", {
  eventId: uuid("event_id").references(() => events.id).notNull(),
  tagId: uuid("tag_id").references(() => tags.id).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.eventId, table.tagId] }),
}));

export const placeTags = pgTable("place_tags", {
  placeId: uuid("place_id").references(() => places.id).notNull(),
  tagId: uuid("tag_id").references(() => tags.id).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.placeId, table.tagId] }),
}));

export const groupPlaces = pgTable("group_places", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupActorId: uuid("group_actor_id").references(() => actors.id).notNull(),
  placeId: uuid("place_id").references(() => places.id).notNull(),
  assignedByUserId: uuid("assigned_by_user_id").references(() => users.id).notNull(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueGroupPlace: unique().on(table.groupActorId, table.placeId),
}));

export const placeAuditLog = pgTable("place_audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  placeId: uuid("place_id").references(() => places.id).notNull(),
  groupActorId: uuid("group_actor_id").references(() => actors.id),
  userId: uuid("user_id").references(() => users.id).notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  changes: jsonb("changes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const otpChallenges = pgTable("otp_challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  handle: varchar("handle", { length: 128 }).notNull(),
  questionId: uuid("question_id").defaultRandom().notNull().unique(),
  expectedEmojis: jsonb("expected_emojis").notNull(), // string[]
  actorUrl: text("actor_url").notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const otpVotes = pgTable("otp_votes", {
  id: uuid("id").defaultRandom().primaryKey(),
  challengeId: uuid("challenge_id").references(() => otpChallenges.id).notNull(),
  emoji: varchar("emoji", { length: 8 }).notNull(),
  voterActorUrl: text("voter_actor_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueVote: unique().on(table.challengeId, table.emoji),
}));

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const banners = pgTable("banners", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url").notNull(),
  altText: varchar("alt_text", { length: 512 }),
  requester: varchar("requester", { length: 256 }),
  weight: integer("weight").default(0).notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  impressionCount: integer("impression_count").default(0).notNull(),
  clickCount: integer("click_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
