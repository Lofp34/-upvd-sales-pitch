"use client";

import { LoaderCircle, Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  MAX_RECORDING_SECONDS,
} from "@/lib/pitch/config";
import type {
  useVoiceDictation,
  VoiceDictationTarget,
} from "@/hooks/use-voice-dictation";

type VoiceDictationController = ReturnType<typeof useVoiceDictation>;

type VoiceDictationButtonProps = {
  controller: VoiceDictationController;
  target: VoiceDictationTarget;
  compact?: boolean;
};

export function VoiceDictationButton({
  controller,
  target,
  compact = false,
}: VoiceDictationButtonProps) {
  const active = controller.target?.id === target.id;
  const recording = active && controller.status === "recording";
  const transcribing = active && controller.status === "transcribing";

  if (controller.status === "unsupported") {
    return (
      <p className="text-xs text-muted-foreground">
        La dictee vocale n&apos;est pas disponible sur ce navigateur.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {recording ? (
        <Button
          aria-label={compact ? "Arreter la dictee" : undefined}
          className="rounded-full"
          onClick={controller.stopRecording}
          size={compact ? "icon-sm" : "sm"}
          type="button"
          variant="secondary"
        >
          <Square className="size-4" />
          {compact ? null : `Arreter (${controller.elapsedSeconds}s)`}
        </Button>
      ) : (
        <Button
          aria-label={compact ? "Demarrer la dictee" : undefined}
          className="rounded-full"
          disabled={controller.status === "transcribing"}
          onClick={() => controller.startRecording(target)}
          size={compact ? "icon-sm" : "sm"}
          type="button"
          variant="outline"
        >
          {transcribing ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Mic className="size-4" />
          )}
          {compact ? null : transcribing ? "Transcription..." : "Dicter"}
        </Button>
      )}

      {!compact ? (
        <p className="text-xs text-muted-foreground">
          Prise max {Math.round(MAX_RECORDING_SECONDS / 60)} min, ajoutee au
          texte existant.
        </p>
      ) : null}
    </div>
  );
}
