import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { COACH_COOKIE_NAME, verifyCoachSessionToken } from "@/lib/cookies";
import { createWorkshopSession } from "@/lib/db/queries";
import { toApiErrorResponse } from "@/lib/api-errors";

const sessionSchema = z.object({
  title: z.string().min(3, "Le titre est requis."),
  deckUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authenticated = await verifyCoachSessionToken(
      request.cookies.get(COACH_COOKIE_NAME)?.value,
    );

    if (!authenticated) {
      return NextResponse.json({ message: "Acces refuse." }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    const parsed = sessionSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Impossible de creer la session." },
        { status: 400 },
      );
    }

    const session = await createWorkshopSession({
      title: parsed.data.title,
      deckUrl: parsed.data.deckUrl || null,
    });

    return NextResponse.json({
      ok: true,
      session,
      joinPath: `/s/${session.slug}`,
    });
  } catch (error) {
    return toApiErrorResponse(
      error,
      "Creation de session impossible pour le moment.",
      "Coach session creation failed",
    );
  }
}
