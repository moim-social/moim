import {
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
  fediverseHandle: varchar("fediverse_handle", { length: 128 }).unique(), // original: alice@mastodon.social
  displayName: varchar("display_name", { length: 200 }).notNull(),
  summary: text("summary"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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
  categories: jsonb("categories"), // string[] of category IDs (for Group actors)
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
  content: text("content").notNull(), // HTML
  published: timestamp("published", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const groupMembers = pgTable("group_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupActorId: uuid("group_actor_id").references(() => actors.id).notNull(),
  memberActorId: uuid("member_actor_id").references(() => actors.id).notNull(),
  role: varchar("role", { length: 32 }).notNull().default("host"), // 'host', 'moderator'
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
  location: text("location"),
  placeId: uuid("place_id").references(() => places.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const eventOrganizers = pgTable("event_organizers", {
  eventId: uuid("event_id").references(() => events.id).notNull(),
  actorId: uuid("actor_id").references(() => actors.id).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.eventId, table.actorId] }),
}));

export const places = pgTable("places", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  latitude: varchar("latitude", { length: 32 }),
  longitude: varchar("longitude", { length: 32 }),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
