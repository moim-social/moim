import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  handle: varchar("handle", { length: 64 }).notNull().unique(),
  displayName: varchar("display_name", { length: 200 }).notNull(),
  summary: text("summary"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const actors = pgTable("actors", {
  id: uuid("id").defaultRandom().primaryKey(),
  handle: varchar("handle", { length: 64 }).notNull().unique(),
  actorUrl: text("actor_url").notNull(),
  inboxUrl: text("inbox_url"),
  outboxUrl: text("outbox_url"),
  publicKeyPem: text("public_key_pem"),
  privateKeyPem: text("private_key_pem"),
  isLocal: boolean("is_local").default(false).notNull(),
  raw: jsonb("raw"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizerId: uuid("organizer_id").references(() => users.id).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  location: text("location"),
  placeId: uuid("place_id").references(() => places.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

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
  handle: varchar("handle", { length: 64 }).notNull(),
  otp: varchar("otp", { length: 16 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
