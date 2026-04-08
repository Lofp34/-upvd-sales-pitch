import { NextRequest, NextResponse } from "next/server";

import { toApiErrorResponse } from "@/lib/api-errors";
import { PARTICIPANT_COOKIE_NAME } from "@/lib/cookies";
import { getWorkbookWithSessionByRawToken } from "@/lib/db/queries";
import {
  assertAudioFileIsSupported,
  assertDurationIsSupported,
  transcribePitchAudio,
} from "@/lib/transcription";

export const runtime = "nodejs";

const transcriptionRateLimit = new Map<string, number[]>();

export async function POST(request: NextRequest) {
  try {
    const rawToken = request.cookies.get(PARTICIPANT_COOKIE_NAME)?.value;

    if (!rawToken) {
      return NextResponse.json({ message: "Acces refuse." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const workbookId = formData.get("workbookId");
    const fieldLabel = formData.get("fieldLabel");
    const currentText = formData.get("currentText");
    const durationSecondsRaw = formData.get("durationSeconds");

    if (
      !(file instanceof File) ||
      typeof workbookId !== "string" ||
      typeof fieldLabel !== "string"
    ) {
      return NextResponse.json(
        { message: "Requete de transcription invalide." },
        { status: 400 },
      );
    }

    const access = await getWorkbookWithSessionByRawToken(rawToken).catch(
      () => null,
    );

    if (!access || access.workbook.id !== workbookId) {
      return NextResponse.json({ message: "Acces refuse." }, { status: 401 });
    }

    const now = Date.now();
    const previousRequests = (
      transcriptionRateLimit.get(access.workbook.id) ?? []
    ).filter((timestamp) => now - timestamp < 60_000);

    if (previousRequests.length >= 6) {
      return NextResponse.json(
        {
          message:
            "Trop de transcriptions en peu de temps. Attends quelques secondes puis relance.",
        },
        { status: 429 },
      );
    }

    previousRequests.push(now);
    transcriptionRateLimit.set(access.workbook.id, previousRequests);

    assertAudioFileIsSupported(file);

    if (typeof durationSecondsRaw === "string") {
      const durationSeconds = Number(durationSecondsRaw);

      if (Number.isFinite(durationSeconds)) {
        assertDurationIsSupported(durationSeconds);
      }
    }

    const text = await transcribePitchAudio({
      file,
      fieldLabel,
      currentText: typeof currentText === "string" ? currentText : "",
    });

    if (!text) {
      return NextResponse.json(
        { message: "Aucun texte n'a ete reconnu dans cet enregistrement." },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      text,
    });
  } catch (error) {
    return toApiErrorResponse(
      error,
      "Transcription audio indisponible pour le moment.",
      "Audio transcription failed",
    );
  }
}
