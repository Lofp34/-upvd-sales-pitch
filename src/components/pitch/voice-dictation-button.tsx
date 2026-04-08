"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { readResponsePayload } from "@/lib/http";
import {
  MAX_AUDIO_UPLOAD_BYTES,
  MAX_RECORDING_SECONDS,
} from "@/lib/pitch/config";

type VoiceDictationButtonProps = {
  workbookId: string;
  fieldId: string;
  fieldLabel: string;
  currentText: string;
  onTranscript: (text: string) => void;
};

const MIME_TYPE_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
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

export function VoiceDictationButton({
  workbookId,
  fieldId,
  fieldLabel,
  currentText,
  onTranscript,
}: VoiceDictationButtonProps) {
  const [status, setStatus] = useState<
    "idle" | "recording" | "transcribing" | "unsupported"
  >("idle");
  const [error, setError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  async function startRecording() {
    if (status === "unsupported") {
      return;
    }

    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
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
    if (audioBlob.size > MAX_AUDIO_UPLOAD_BYTES) {
      setStatus("idle");
      setError(
        "L'enregistrement est trop lourd. Garde une dictee plus courte et recommence.",
      );
      return;
    }

    setStatus("transcribing");

    try {
      const extension = audioBlob.type.includes("wav") ? "wav" : "webm";
      const audioFile = new File([audioBlob], `pitch-${Date.now()}.${extension}`, {
        type: audioBlob.type || "audio/webm",
      });
      const formData = new FormData();

      formData.set("file", audioFile);
      formData.set("workbookId", workbookId);
      formData.set("fieldId", fieldId);
      formData.set("fieldLabel", fieldLabel);
      formData.set("currentText", currentText);
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

      onTranscript(payload.text);
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

  if (status === "unsupported") {
    return (
      <p className="text-xs text-muted-foreground">
        La dictee vocale n&apos;est pas disponible sur ce navigateur.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "recording" ? (
        <Button
          className="rounded-full"
          onClick={stopRecording}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Square className="mr-2 size-4" />
          Arreter la dictee ({elapsedSeconds}s)
        </Button>
      ) : (
        <Button
          className="rounded-full"
          disabled={status === "transcribing"}
          onClick={startRecording}
          size="sm"
          type="button"
          variant="outline"
        >
          {status === "transcribing" ? (
            <LoaderCircle className="mr-2 size-4 animate-spin" />
          ) : (
            <Mic className="mr-2 size-4" />
          )}
          {status === "transcribing" ? "Transcription..." : "Dicter ce champ"}
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        Prise max {Math.round(MAX_RECORDING_SECONDS / 60)} min, ajoutee au texte
        existant.
      </p>

      {error ? <p className="w-full text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
