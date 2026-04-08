import OpenAI from "openai";

import {
  isSupportedAudioMimeType,
  normalizeAudioMimeType,
} from "@/lib/audio-formats";
import { assertOpenAiApiKey } from "@/lib/env";
import {
  MAX_AUDIO_UPLOAD_BYTES,
  MAX_RECORDING_SECONDS,
} from "@/lib/pitch/config";

type TranscriptionInputError = Error & {
  code?: string;
  status?: number;
};

function createTranscriptionInputError(
  message: string,
  status: number,
  code: string,
) {
  const error = new Error(message) as TranscriptionInputError;

  error.status = status;
  error.code = code;

  return error;
}

function getClient() {
  return new OpenAI({
    apiKey: assertOpenAiApiKey(),
  });
}

export function assertAudioFileIsSupported(file: File) {
  if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
    throw createTranscriptionInputError(
      "Le fichier audio est trop lourd. Garde un enregistrement court ou redemarre une nouvelle dictee.",
      413,
      "audio_file_too_large",
    );
  }

  if (!isSupportedAudioMimeType(file.type)) {
    const normalizedType = normalizeAudioMimeType(file.type);
    const formatLabel = normalizedType || file.type || "inconnu";

    throw createTranscriptionInputError(
      "Format audio non pris en charge. Utilise un enregistrement webm, wav, mp3, mp4 ou m4a.",
      400,
      `unsupported_audio_format:${formatLabel}`,
    );
  }
}

export function assertDurationIsSupported(durationSeconds?: number) {
  if (!durationSeconds) {
    return;
  }

  if (durationSeconds > MAX_RECORDING_SECONDS) {
    throw createTranscriptionInputError(
      "La dictee est trop longue pour ce mode. Garde chaque prise sous 5 minutes.",
      400,
      "audio_duration_too_long",
    );
  }
}

function buildPrompt(fieldLabel: string, currentText?: string) {
  const promptParts = [
    `Transcription en francais pour le champ "${fieldLabel}".`,
    "Conserve une ponctuation lisible et un style naturel a l'oral.",
    "N'invente rien et n'ajoute aucun commentaire.",
  ];

  if (currentText?.trim()) {
    promptParts.push(
      `Contexte deja saisi pour garder la continuite: ${currentText.trim().slice(-600)}`,
    );
  }

  return promptParts.join(" ");
}

export async function transcribePitchAudio(input: {
  file: File;
  fieldLabel: string;
  currentText?: string;
}) {
  const transcription = await getClient().audio.transcriptions.create({
    file: input.file,
    model: "gpt-4o-mini-transcribe",
    language: "fr",
    response_format: "json",
    prompt: buildPrompt(input.fieldLabel, input.currentText),
  });

  return transcription.text.trim();
}
