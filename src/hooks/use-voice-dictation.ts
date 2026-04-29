"use client";

import { useEffect, useRef, useState } from "react";

import { readResponsePayload } from "@/lib/http";
import {
  getAudioFileExtension,
  normalizeAudioMimeType,
} from "@/lib/audio-formats";
import {
  MAX_AUDIO_UPLOAD_BYTES,
  MAX_RECORDING_SECONDS,
} from "@/lib/pitch/config";

export type VoiceDictationStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "unsupported";

export type VoiceDictationTarget = {
  id: string;
  fieldId: string;
  fieldLabel: string;
  contextLabel?: string;
  currentText: string;
  onTranscript: (text: string) => void;
};

const MIME_TYPE_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "video/mp4",
];

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }

  return (
    MIME_TYPE_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ??
    null
  );
}

export function useVoiceDictation(workbookId: string) {
  const [status, setStatus] = useState<VoiceDictationStatus>("idle");
  const [error, setError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [target, setTarget] = useState<VoiceDictationTarget | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetRef = useRef<VoiceDictationTarget | null>(null);

  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setStatus("unsupported");
    }
  }, []);

  useEffect(() => {
    return () => {
      stopStream();
      clearTimers();
    };
  }, []);

  function clearTimers() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function startRecording(nextTarget: VoiceDictationTarget) {
    if (status === "unsupported") {
      return;
    }

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    setError("");
    setTarget(nextTarget);
    targetRef.current = nextTarget;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      setElapsedSeconds(0);
      setStatus("recording");

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        clearTimers();
        const durationSeconds = Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000),
        );
        const audioBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        stopStream();
        await transcribeBlob(audioBlob, durationSeconds);
      };

      recorder.start();

      timerRef.current = setInterval(() => {
        setElapsedSeconds(
          Math.round((Date.now() - startedAtRef.current) / 1000),
        );
      }, 1000);

      autoStopRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_RECORDING_SECONDS * 1000);
    } catch (caughtError) {
      stopStream();
      clearTimers();
      setStatus("idle");
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Impossible d'acceder au micro.",
      );
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  async function transcribeBlob(audioBlob: Blob, durationSeconds: number) {
    const currentTarget = targetRef.current;

    if (!currentTarget) {
      setStatus("idle");
      setError("Aucune cible de dictee n'est active.");
      return;
    }

    if (audioBlob.size > MAX_AUDIO_UPLOAD_BYTES) {
      setStatus("idle");
      setError(
        "L'enregistrement est trop lourd. Garde une dictee plus courte et recommence.",
      );
      return;
    }

    setStatus("transcribing");

    try {
      const audioMimeType = normalizeAudioMimeType(audioBlob.type) || "audio/webm";
      const extension = getAudioFileExtension(audioMimeType) ?? "webm";
      const audioFile = new File(
        [audioBlob],
        `pitch-${Date.now()}.${extension}`,
        { type: audioMimeType },
      );
      const formData = new FormData();

      formData.set("file", audioFile);
      formData.set("workbookId", workbookId);
      formData.set("fieldId", currentTarget.fieldId);
      formData.set("fieldLabel", currentTarget.fieldLabel);
      formData.set("currentText", currentTarget.currentText);
      formData.set("durationSeconds", String(durationSeconds));

      const response = await fetch("/api/audio/transcribe", {
        method: "POST",
        body: formData,
      });
      const payload = await readResponsePayload<{
        message?: string;
        text?: string;
      }>(response);

      if (!response.ok || !payload.text) {
        throw new Error(payload.message ?? "Transcription indisponible.");
      }

      currentTarget.onTranscript(payload.text);
      setStatus("idle");
      setError("");
      setElapsedSeconds(0);
    } catch (caughtError) {
      setStatus("idle");
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Transcription indisponible.",
      );
    }
  }

  return {
    elapsedSeconds,
    error,
    startRecording,
    status,
    stopRecording,
    target,
  };
}

