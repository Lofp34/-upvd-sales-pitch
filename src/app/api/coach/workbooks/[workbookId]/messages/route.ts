import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { toApiErrorResponse } from "@/lib/api-errors";
import { COACH_COOKIE_NAME, verifyCoachSessionToken } from "@/lib/cookies";
import { createCoachMessage } from "@/lib/db/queries";

const coachMessageSchema = z.object({
  body: z.string().trim().min(1, "Le message est requis.").max(500),
});

type CoachWorkbookMessageContext = {
  params: Promise<{
    workbookId: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: CoachWorkbookMessageContext,
) {
  try {
    const authenticated = await verifyCoachSessionToken(
      request.cookies.get(COACH_COOKIE_NAME)?.value,
    );

    if (!authenticated) {
      return NextResponse.json({ message: "Acces refuse." }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    const parsed = coachMessageSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Message formateur invalide." },
        { status: 400 },
      );
    }

    const { workbookId } = await context.params;
    const message = await createCoachMessage({
      workbookId,
      body: parsed.data.body,
    });

    if (!message) {
      return NextResponse.json(
        { message: "Sauvegarde introuvable." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: {
        id: message.id,
        body: message.body,
        createdAt: message.createdAt,
      },
    });
  } catch (error) {
    return toApiErrorResponse(
      error,
      "Message impossible a envoyer pour le moment.",
      "Coach message creation failed",
    );
  }
}
