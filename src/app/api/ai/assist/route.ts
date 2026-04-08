import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { toApiErrorResponse } from "@/lib/api-errors";
import { assistWithAi } from "@/lib/ai";
import { PARTICIPANT_COOKIE_NAME } from "@/lib/cookies";
import { getWorkbookWithSessionByRawToken } from "@/lib/db/queries";
import { AI_ACTIONS } from "@/lib/workshop/types";

const aiRequestSchema = z.object({
  workbookId: z.string().min(1),
  stepId: z.string().min(1),
  action: z.enum(AI_ACTIONS),
  sourceText: z.string().trim().min(1).max(4000),
  context: z.record(z.string(), z.string().optional()).optional(),
});

const aiRateLimit = new Map<string, number[]>();

export async function POST(request: NextRequest) {
  try {
    const rawToken = request.cookies.get(PARTICIPANT_COOKIE_NAME)?.value;

    if (!rawToken) {
      return NextResponse.json({ message: "Acces refuse." }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    const parsed = aiRequestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Requete IA invalide." },
        { status: 400 },
      );
    }

    const access = await getWorkbookWithSessionByRawToken(rawToken).catch(
      () => null,
    );

    if (!access || access.workbook.id !== parsed.data.workbookId) {
      return NextResponse.json({ message: "Acces refuse." }, { status: 401 });
    }

    const now = Date.now();
    const previousRequests = (aiRateLimit.get(access.workbook.id) ?? []).filter(
      (timestamp) => now - timestamp < 60_000,
    );

    if (previousRequests.length >= 8) {
      return NextResponse.json(
        {
          message:
            "Trop de requetes IA en peu de temps. Attends quelques secondes puis relance.",
        },
        { status: 429 },
      );
    }

    previousRequests.push(now);
    aiRateLimit.set(access.workbook.id, previousRequests);

    const output = await assistWithAi({
      action: parsed.data.action,
      stepId: parsed.data.stepId,
      sourceText: parsed.data.sourceText,
      context: parsed.data.context,
    });

    return NextResponse.json({
      ok: true,
      output,
    });
  } catch (error) {
    return toApiErrorResponse(
      error,
      "Assistance IA indisponible pour le moment.",
      "AI assist failed",
    );
  }
}
