import { NextRequest, NextResponse } from "next/server";

import { toApiErrorResponse } from "@/lib/api-errors";
import { COACH_COOKIE_NAME, verifyCoachSessionToken } from "@/lib/cookies";
import { deleteParticipantWorkbook } from "@/lib/db/queries";

type CoachWorkbookContext = {
  params: Promise<{
    workbookId: string;
  }>;
};

export async function DELETE(
  request: NextRequest,
  context: CoachWorkbookContext,
) {
  try {
    const authenticated = await verifyCoachSessionToken(
      request.cookies.get(COACH_COOKIE_NAME)?.value,
    );

    if (!authenticated) {
      return NextResponse.json({ message: "Acces refuse." }, { status: 401 });
    }

    const { workbookId } = await context.params;
    const deleted = await deleteParticipantWorkbook(workbookId);

    if (!deleted) {
      return NextResponse.json(
        { message: "Sauvegarde introuvable." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, workbookId: deleted.id });
  } catch (error) {
    return toApiErrorResponse(
      error,
      "Suppression impossible pour le moment.",
      "Coach workbook deletion failed",
    );
  }
}
