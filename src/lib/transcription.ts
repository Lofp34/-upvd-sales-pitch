import OpenAI from "openai";

import { assertOpenAiApiKey } from "@/lib/env";
import {
  MAX_AUDIO_UPLOAD_BYTES,
  MAX_RECORDING_SECONDS,
} from "@/lib/pitch/config";

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mp3",
  "audio/mpeg",
  "audio/mp4",
  "audio/mpga",
  "audio/m4a",
  "audio/wav",
  "audio/webm",
]);

function getClient() {
  return new OpenAI({
    apiKey: assertOpenAiApiKey(),
  });
}

export function assertAudioFileIsSupported(file: File) {
  if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
    throw new Error(
      "Le fichier audio est trop lourd. Garde un enregistrement court ou redemarre une nouvelle dictee.",
    );
  }

  if (!ALLOWED_AUDIO_TYPES.has(file.type)) {
    throw new Error(
      "Format audio non pris en charge. Utilise un enregistrement webm, wav, mp3, mp4 ou m4a.",
    );
  }
}

export function assertDurationIsSupported(durationSeconds?: number) {
  if (!durationSeconds) {
    return;
  }

  if (durationSeconds > MAX_RECORDING_SECONDS) {
    throw new Error(
      "La dictee est trop longue pour ce mode. Garde chaque prise sous 5 minutes.",
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
