import crypto from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import {
  participantWorkbooks,
  workshopSessions,
  type ParticipantWorkbookRecord,
  type WorkshopSessionRecord,
} from "@/lib/db/schema";
import { getDb } from "@/lib/db";
import {
  createOpaqueToken,
  generateSessionSlug,
  hashOpaqueToken,
} from "@/lib/crypto";
import {
  createDefaultPitchWorkflow,
  getFinalOutputObject,
  type PitchPersona,
} from "@/lib/pitch/workflow";
import type { AnswersState } from "@/lib/workshop/types";

export type WorkbookWithSession = {
  workbook: ParticipantWorkbookRecord;
  session: WorkshopSessionRecord;
};

export type StoredCoachMessage = {
  id: string;
  body: string;
  createdAt: string;
  seenAt: string | null;
};

type WorkbookFinalOutput = Record<string, unknown> & {
  coachMessages?: unknown;
};

function getWorkbookFinalOutput(
  finalOutputJson: Record<string, unknown> | null,
): WorkbookFinalOutput {
  return getFinalOutputObject(finalOutputJson);
}

function getStoredCoachMessages(
  finalOutputJson: Record<string, unknown> | null,
) {
  const output = getWorkbookFinalOutput(finalOutputJson);

  if (!Array.isArray(output.coachMessages)) {
    return [];
  }

  return output.coachMessages.filter(
    (message): message is StoredCoachMessage =>
      typeof message === "object" &&
      message !== null &&
      typeof (message as StoredCoachMessage).id === "string" &&
      typeof (message as StoredCoachMessage).body === "string" &&
      typeof (message as StoredCoachMessage).createdAt === "string",
  );
}

export async function getRecentWorkshopSessions(limit = 5) {
  return getDb()
    .select()
    .from(workshopSessions)
    .orderBy(desc(workshopSessions.createdAt))
    .limit(limit);
}

export async function getRecentWorkbookProductions(limit = 50) {
  return getDb()
    .select({
      workbook: participantWorkbooks,
      session: workshopSessions,
    })
    .from(participantWorkbooks)
    .innerJoin(
      workshopSessions,
      eq(participantWorkbooks.sessionId, workshopSessions.id),
    )
    .orderBy(desc(participantWorkbooks.lastActiveAt))
    .limit(limit);
}

export async function deleteParticipantWorkbook(workbookId: string) {
  const [deleted] = await getDb()
    .delete(participantWorkbooks)
    .where(eq(participantWorkbooks.id, workbookId))
    .returning({ id: participantWorkbooks.id });

  return deleted ?? null;
}

export async function createCoachMessage(input: {
  workbookId: string;
  body: string;
}) {
  const workbook = await getWorkbookById(input.workbookId);

  if (!workbook) {
    return null;
  }

  const output = getWorkbookFinalOutput(workbook.finalOutputJson);
  const message: StoredCoachMessage = {
    id: crypto.randomUUID(),
    body: input.body.trim(),
    createdAt: new Date().toISOString(),
    seenAt: null,
  };
  const coachMessages = [
    ...getStoredCoachMessages(workbook.finalOutputJson),
    message,
  ].slice(-50);

  await getDb()
    .update(participantWorkbooks)
    .set({
      finalOutputJson: {
        ...output,
        coachMessages,
      },
      updatedAt: new Date(),
    })
    .where(eq(participantWorkbooks.id, input.workbookId));

  return message;
}

export async function getUnreadCoachMessages(workbookId: string, limit = 5) {
  const workbook = await getWorkbookById(workbookId);

  if (!workbook) {
    return [];
  }

  return getStoredCoachMessages(workbook.finalOutputJson)
    .filter((message) => !message.seenAt)
    .slice(0, limit);
}

export async function markCoachMessagesSeen(
  workbookId: string,
  messageIds: string[],
) {
  if (messageIds.length === 0) {
    return [];
  }

  const workbook = await getWorkbookById(workbookId);

  if (!workbook) {
    return [];
  }

  const output = getWorkbookFinalOutput(workbook.finalOutputJson);
  const messageIdSet = new Set(messageIds);
  const seenAt = new Date().toISOString();
  const coachMessages = getStoredCoachMessages(workbook.finalOutputJson).map(
    (message) =>
      messageIdSet.has(message.id) ? { ...message, seenAt } : message,
  );

  await getDb()
    .update(participantWorkbooks)
    .set({
      finalOutputJson: {
        ...output,
        coachMessages,
      },
      updatedAt: new Date(),
    })
    .where(eq(participantWorkbooks.id, workbookId));

  return messageIds.map((id) => ({ id }));
}

export async function createWorkshopSession(input: {
  title: string;
  deckUrl?: string | null;
}) {
  const db = getDb();
  const title = input.title.trim();
  const deckUrl = input.deckUrl?.trim() || null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const [session] = await db
        .insert(workshopSessions)
        .values({
          title,
          deckUrl,
          slug: generateSessionSlug(title),
        })
        .returning();

      return session;
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }
    }
  }

  throw new Error("Impossible de creer une session.");
}

export async function getWorkshopSessionBySlug(slug: string) {
  const [session] = await getDb()
    .select()
    .from(workshopSessions)
    .where(eq(workshopSessions.slug, slug))
    .limit(1);

  return session ?? null;
}

export async function createParticipantWorkbook(input: {
  sessionId: string;
  name: string;
  startup: string;
  email?: string;
  persona?: PitchPersona;
}) {
  const resumeToken = createOpaqueToken();

  const [workbook] = await getDb()
    .insert(participantWorkbooks)
    .values({
      sessionId: input.sessionId,
      name: input.name.trim(),
      startup: input.startup.trim(),
      resumeTokenHash: hashOpaqueToken(resumeToken),
      finalOutputJson: {
        pitchWorkflow: createDefaultPitchWorkflow({
          email: input.email,
          persona: input.persona,
        }),
      },
    })
    .returning();

  return { workbook, resumeToken };
}

export async function getWorkbookWithSessionByRawToken(
  rawToken: string,
  slug?: string,
) {
  const whereClause = slug
    ? and(
        eq(participantWorkbooks.resumeTokenHash, hashOpaqueToken(rawToken)),
        eq(workshopSessions.slug, slug),
      )
    : eq(participantWorkbooks.resumeTokenHash, hashOpaqueToken(rawToken));

  const [row] = await getDb()
    .select({
      workbook: participantWorkbooks,
      session: workshopSessions,
    })
    .from(participantWorkbooks)
    .innerJoin(
      workshopSessions,
      eq(participantWorkbooks.sessionId, workshopSessions.id),
    )
    .where(whereClause)
    .limit(1);

  return row ?? null;
}

export async function getWorkbookById(id: string) {
  const [workbook] = await getDb()
    .select()
    .from(participantWorkbooks)
    .where(eq(participantWorkbooks.id, id))
    .limit(1);

  return workbook ?? null;
}

export async function saveWorkbookState(input: {
  workbookId: string;
  answersJson: AnswersState;
  currentStepId: string;
  finalOutputJson?: Record<string, unknown> | null;
}) {
  const existing = await getWorkbookById(input.workbookId);

  if (!existing) {
    return null;
  }

  const relatedSession = await getWorkshopSessionById(existing.sessionId);

  if (!relatedSession) {
    return null;
  }

  const nextFinalOutputJson = input.finalOutputJson
    ? {
        ...getWorkbookFinalOutput(existing.finalOutputJson),
        ...getFinalOutputObject(input.finalOutputJson),
      }
    : existing.finalOutputJson ?? null;

  const [updated] = await getDb()
    .update(participantWorkbooks)
    .set({
      answersJson: input.answersJson,
      currentStepId: input.currentStepId,
      finalOutputJson: nextFinalOutputJson,
      lastActiveAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(participantWorkbooks.id, input.workbookId))
    .returning();

  return updated ?? null;
}

export async function getWorkbookWithSessionById(workbookId: string) {
  const [row] = await getDb()
    .select({
      workbook: participantWorkbooks,
      session: workshopSessions,
    })
    .from(participantWorkbooks)
    .innerJoin(
      workshopSessions,
      eq(participantWorkbooks.sessionId, workshopSessions.id),
    )
    .where(eq(participantWorkbooks.id, workbookId))
    .limit(1);

  return row ?? null;
}

async function getWorkshopSessionById(id: string) {
  const [session] = await getDb()
    .select()
    .from(workshopSessions)
    .where(eq(workshopSessions.id, id))
    .limit(1);

  return session ?? null;
}
