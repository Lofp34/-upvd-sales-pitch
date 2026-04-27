import crypto from "node:crypto";

import { sql } from "drizzle-orm";
import {
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import type { AnswersState } from "@/lib/workshop/types";

export const workshopSessions = pgTable("pitch_sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 160 }).notNull(),
  deckUrl: text("deck_url"),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const participantWorkbooks = pgTable("pitch_workbooks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sessionId: text("session_id")
    .notNull()
    .references(() => workshopSessions.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  startup: varchar("startup", { length: 160 }).notNull(),
  resumeTokenHash: varchar("resume_token_hash", { length: 255 })
    .notNull()
    .unique(),
  currentStepId: varchar("current_step_id", { length: 64 })
    .notNull()
    .default("pitch-studio"),
  answersJson: jsonb("answers_json")
    .$type<AnswersState>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  finalOutputJson: jsonb("final_output_json").$type<Record<string, unknown> | null>(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const coachMessages = pgTable("pitch_coach_messages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workbookId: text("workbook_id")
    .notNull()
    .references(() => participantWorkbooks.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  seenAt: timestamp("seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type WorkshopSessionRecord = typeof workshopSessions.$inferSelect;
export type ParticipantWorkbookRecord = typeof participantWorkbooks.$inferSelect;
export type CoachMessageRecord = typeof coachMessages.$inferSelect;
