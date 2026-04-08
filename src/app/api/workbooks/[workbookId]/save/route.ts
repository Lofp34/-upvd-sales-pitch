import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { toApiErrorResponse } from "@/lib/api-errors";
import { PARTICIPANT_COOKIE_NAME } from "@/lib/cookies";
import {
  getWorkbookWithSessionByRawToken,
  saveWorkbookState,
} from "@/lib/db/queries";
import type { AnswersState } from "@/lib/workshop/types";

const saveSchema = z.object({
  answers: z.record(z.string(), z.record(z.string(), z.string())),
  currentStepId: z.string().min(1),
  finalOutputJson: z.unknown().optional(),
});

type WorkbookSaveContext = {
  params: Promise<{
    workbookId: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: WorkbookSaveContext,
) {
  try {
    const { workbookId } = await context.params;
    const rawToken = request.cookies.get(PARTICIPANT_COOKIE_NAME)?.value;

    if (!rawToken) {
      return NextResponse.json({ message: "Acces refuse." }, { status: 401 });
    }

    const access = await getWorkbookWithSessionByRawToken(rawToken).catch(
      () => null,
    );

    if (!access || access.workbook.id !== workbookId) {
      return NextResponse.json({ message: "Acces refuse." }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    const parsed = saveSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Sauvegarde invalide." },
        { status: 400 },
      );
    }

    const updated = await saveWorkbookState({
      workbookId,
      answersJson: parsed.data.answers as AnswersState,
      currentStepId: parsed.data.currentStepId,
      finalOutputJson: (parsed.data.finalOutputJson ??
        null) as Record<string, unknown> | null,
    });

    return NextResponse.json({
      ok: true,
      workbookId: updated?.id ?? workbookId,
    });
  } catch (error) {
    return toApiErrorResponse(
      error,
      "Sauvegarde impossible pour le moment.",
      "Workbook save failed",
    );
  }
}
