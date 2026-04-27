import { NextRequest, NextResponse } from "next/server";

import { toApiErrorResponse } from "@/lib/api-errors";
import { PARTICIPANT_COOKIE_NAME } from "@/lib/cookies";
import {
  getUnreadCoachMessages,
  getWorkbookWithSessionByRawToken,
  markCoachMessagesSeen,
} from "@/lib/db/queries";

type ParticipantCoachMessagesContext = {
  params: Promise<{
    workbookId: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: ParticipantCoachMessagesContext,
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

    const messages = await getUnreadCoachMessages(workbookId);
    await markCoachMessagesSeen(messages.map((message) => message.id));

    return NextResponse.json({
      ok: true,
      messages: messages.map((message) => ({
        id: message.id,
        body: message.body,
        createdAt: message.createdAt,
      })),
    });
  } catch (error) {
    return toApiErrorResponse(
      error,
      "Messages formateur indisponibles pour le moment.",
      "Participant coach message polling failed",
    );
  }
}
