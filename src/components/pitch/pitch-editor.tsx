"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { VoiceDictationButton } from "@/components/pitch/voice-dictation-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readResponsePayload } from "@/lib/http";
import {
  PITCH_FIELDS,
  PITCH_RAIL_BULLETS,
  PITCH_STEP_ID,
} from "@/lib/pitch/config";
import type { AiAction, AnswersState, WorkshopField } from "@/lib/workshop/types";

type PitchEditorProps = {
  session: {
    id: string;
    slug: string;
    title: string;
    deckUrl: string | null;
  };
  workbook: {
    id: string;
    name: string;
    startup: string;
    currentStepId: string;
    answersJson: AnswersState;
    finalOutputJson?: unknown;
  };
  resumePath: string;
};

type AssistState = {
  loading: boolean;
  action?: AiAction;
  output?: string;
  error?: string;
};

function mergeAnswers(
  baseAnswers: AnswersState,
  localAnswers: AnswersState | undefined,
) {
  if (!localAnswers) {
    return baseAnswers;
  }

  const merged: AnswersState = { ...baseAnswers };

  for (const [stepId, stepValues] of Object.entries(localAnswers)) {
    merged[stepId] = {
      ...(merged[stepId] ?? {}),
      ...stepValues,
    };
  }

  return merged;
}

function getFieldStorageId(stepId: string, fieldId: string) {
  return `${stepId}:${fieldId}`;
}

export function PitchEditor({
  session,
  workbook,
  resumePath,
}: PitchEditorProps) {
  const storageKey = `upvd-sales-pitch:${workbook.id}`;
  const [answers, setAnswers] = useState<AnswersState>(workbook.answersJson ?? {});
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveMessage, setSaveMessage] = useState(
    "Chaque modification est sauvegardee automatiquement.",
  );
  const [assistStates, setAssistStates] = useState<Record<string, AssistState>>(
    {},
  );
  const hydratedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stepAnswers = answers[PITCH_STEP_ID] ?? {};
  const shortPitch = stepAnswers.pitch30?.trim() || "";
  const longPitch = stepAnswers.pitch60?.trim() || "";

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      hydratedRef.current = true;
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        answers?: AnswersState;
      };

      if (parsed.answers) {
        setAnswers((previous) => mergeAnswers(previous, parsed.answers));
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    } finally {
      hydratedRef.current = true;
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        answers,
        savedAt: new Date().toISOString(),
      }),
    );
  }, [answers, storageKey]);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setSaveState("saving");
      setSaveMessage("Sauvegarde en cours...");

      try {
        const response = await fetch(`/api/workbooks/${workbook.id}/save`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            answers,
            currentStepId: PITCH_STEP_ID,
            finalOutputJson: null,
          }),
        });

        const payload = await readResponsePayload<{ message?: string }>(
          response,
        );

        if (!response.ok) {
          throw new Error(payload.message ?? "Sauvegarde impossible.");
        }

        setSaveState("saved");
        setSaveMessage("Sauvegarde ok.");
      } catch (caughtError) {
        setSaveState("error");
        setSaveMessage(
          caughtError instanceof Error
            ? caughtError.message
            : "Sauvegarde impossible.",
        );
      }
    }, 900);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [answers, workbook.id]);

  function updateField(fieldId: string, value: string) {
    setAnswers((previous) => ({
      ...previous,
      [PITCH_STEP_ID]: {
        ...(previous[PITCH_STEP_ID] ?? {}),
        [fieldId]: value,
      },
    }));
  }

  function appendTranscript(fieldId: string, transcript: string) {
    const existingText = stepAnswers[fieldId]?.trim();
    const nextValue = existingText
      ? `${existingText}\n\n${transcript.trim()}`
      : transcript.trim();

    updateField(fieldId, nextValue);
    setSaveMessage("Transcription ajoutee au champ.");
  }

  async function runAiAssist(field: WorkshopField, action: AiAction) {
    const fieldKey = getFieldStorageId(PITCH_STEP_ID, field.id);
    const sourceText = stepAnswers[field.id] ?? "";

    if (!sourceText.trim()) {
      setAssistStates((previous) => ({
        ...previous,
        [fieldKey]: {
          loading: false,
          action,
          error: "Commence par ecrire une base de texte dans ce champ.",
        },
      }));
      return;
    }

    setAssistStates((previous) => ({
      ...previous,
      [fieldKey]: {
        loading: true,
        action,
      },
    }));

    try {
      const response = await fetch("/api/ai/assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workbookId: workbook.id,
          stepId: PITCH_STEP_ID,
          action,
          sourceText,
          context: {
            startup: workbook.startup,
            participant: workbook.name,
            stepTitle: "Pitch startup",
            fieldLabel: field.label,
            sessionTitle: session.title,
          },
        }),
      });

      const payload = await readResponsePayload<{
        message?: string;
        output?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.message ?? "Assistance IA indisponible.");
      }

      setAssistStates((previous) => ({
        ...previous,
        [fieldKey]: {
          loading: false,
          action,
          output: payload.output ?? "",
        },
      }));
    } catch (caughtError) {
      setAssistStates((previous) => ({
        ...previous,
        [fieldKey]: {
          loading: false,
          action,
          error:
            caughtError instanceof Error
              ? caughtError.message
              : "Assistance IA indisponible.",
        },
      }));
    }
  }

  async function copyResumeLink() {
    await navigator.clipboard.writeText(`${window.location.origin}${resumePath}`);
    setSaveMessage("Lien personnel copie.");
  }

  async function copySuggestion(output: string) {
    await navigator.clipboard.writeText(output);
    setSaveMessage("Suggestion IA copiee.");
  }

  async function copyPitch(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setSaveMessage(`${label} copie.`);
  }

  return (
    <main className="editorial-shell soft-grid">
      <div className="mx-auto flex min-h-screen w-full max-w-[1560px] flex-col gap-6 px-4 py-4 md:px-6 lg:px-8">
        <header className="editorial-card flex flex-col gap-6 px-6 py-6 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-primary/10 text-primary">
                  Pitch studio
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-full border-accent/50 bg-accent/10 text-accent-foreground"
                >
                  {workbook.startup}
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                  {session.title}
                </p>
                <h1 className="editorial-title text-4xl text-primary md:text-5xl">
                  Rédige ton pitch startup
                </h1>
                <p className="max-w-3xl text-base leading-7 text-muted-foreground">
                  Travaille ta proposition de valeur, ta version 30 secondes et
                  ta version 1 minute dans un seul espace, avec assistance IA et
                  dictee vocale.
                </p>
              </div>
            </div>
            <div className="min-w-[280px] rounded-[1.75rem] bg-secondary/75 p-4">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Progression</span>
                <span className="font-medium text-primary">1 / 1</span>
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {saveState === "error" ? "Attention" : "Autosave actif"}
              </p>
              <p className="mt-1 text-sm text-primary">{saveMessage}</p>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
          <section className="space-y-6">
            <Card className="editorial-card rounded-[2rem]">
              <CardHeader className="space-y-3">
                <CardTitle className="editorial-title text-3xl text-primary">
                  Valeur ajoutee et pitch
                </CardTitle>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                  D&apos;abord l&apos;enjeu, ensuite la reponse, puis le benefice.
                  Le pitch court doit donner envie d&apos;aller plus loin, pas
                  tout raconter.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {PITCH_FIELDS.map((field) => {
                  const fieldValue = stepAnswers[field.id] ?? "";
                  const fieldKey = getFieldStorageId(PITCH_STEP_ID, field.id);
                  const assistState = assistStates[fieldKey];

                  return (
                    <article
                      className="rounded-[1.75rem] border border-border/80 bg-background/75 p-5"
                      key={fieldKey}
                    >
                      <div className="space-y-2">
                        <Label
                          className="text-base font-medium text-foreground"
                          htmlFor={fieldKey}
                        >
                          {field.label}
                        </Label>
                        {field.helper ? (
                          <p className="text-sm leading-6 text-muted-foreground">
                            {field.helper}
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-4">
                        <Textarea
                          id={fieldKey}
                          onChange={(event) =>
                            updateField(field.id, event.target.value)
                          }
                          placeholder={field.placeholder}
                          rows={field.rows ?? 5}
                          value={fieldValue}
                        />
                      </div>

                      <div className="mt-4">
                        <VoiceDictationButton
                          currentText={fieldValue}
                          fieldId={field.id}
                          fieldLabel={field.label}
                          onTranscript={(text) => appendTranscript(field.id, text)}
                          workbookId={workbook.id}
                        />
                      </div>

                      {field.aiActions?.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {field.aiActions.map((action) => (
                            <Button
                              className="rounded-full"
                              disabled={assistState?.loading}
                              key={action}
                              onClick={() => runAiAssist(field, action)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {action === "clarify" && "Clarifier"}
                              {action === "shorten" && "Raccourcir"}
                              {action === "variants_3" && "3 variantes"}
                              {action === "flag_vagueness" && "Repérer le flou"}
                              {action === "oralize_30s" && "Version orale 30s"}
                              {action === "oralize_60s" && "Version orale 1 min"}
                            </Button>
                          ))}
                        </div>
                      ) : null}

                      {assistState?.output ? (
                        <div className="mt-4 rounded-3xl border border-primary/15 bg-primary/5 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-primary/70">
                            Suggestion IA
                          </p>
                          <div className="mt-2 text-sm leading-7 text-foreground [overflow-wrap:anywhere] [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded-md [&_code]:bg-background/80 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.92em] [&_em]:italic [&_h1]:mt-5 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-primary [&_h1:first-child]:mt-0 [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-primary [&_h2:first-child]:mt-0 [&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-primary [&_h3:first-child]:mt-0 [&_li]:ml-1 [&_li]:pl-1 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p]:mt-3 [&_p:first-child]:mt-0 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:bg-background/85 [&_pre]:p-4 [&_pre]:text-xs [&_strong]:font-semibold [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {assistState.output}
                            </ReactMarkdown>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              className="rounded-full"
                              onClick={() =>
                                updateField(field.id, assistState.output ?? "")
                              }
                              size="sm"
                              type="button"
                            >
                              Remplacer mon texte
                            </Button>
                            <Button
                              className="rounded-full"
                              onClick={() =>
                                copySuggestion(assistState.output ?? "")
                              }
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              Copier la suggestion
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      {assistState?.error ? (
                        <p className="mt-3 text-sm text-destructive">
                          {assistState.error}
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-6">
            <Card className="editorial-card sticky top-4 rounded-[2rem]">
              <CardHeader className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge className="rounded-full bg-primary/10 text-primary">
                    Repere terrain
                  </Badge>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Etape pitch
                  </p>
                </div>
                <CardTitle className="editorial-title text-3xl text-primary">
                  Ton fil directeur
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3">
                  {PITCH_RAIL_BULLETS.map((bullet) => (
                    <div
                      className="rounded-2xl border border-border/80 bg-background/70 p-4 text-sm leading-7 text-foreground"
                      key={bullet}
                    >
                      {bullet}
                    </div>
                  ))}
                </div>

                <div className="space-y-3 rounded-2xl border border-border/80 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Pitch 30 secondes
                  </p>
                  <p className="text-sm leading-7 text-foreground">
                    {shortPitch || "Ton pitch court apparaitra ici."}
                  </p>
                  {shortPitch ? (
                    <Button
                      className="rounded-full"
                      onClick={() => copyPitch(shortPitch, "Pitch 30 secondes")}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Copier le pitch 30s
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-3 rounded-2xl border border-border/80 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Pitch 1 minute
                  </p>
                  <p className="text-sm leading-7 text-foreground">
                    {longPitch || "Ta version orale une minute apparaitra ici."}
                  </p>
                  {longPitch ? (
                    <Button
                      className="rounded-full"
                      onClick={() => copyPitch(longPitch, "Pitch 1 minute")}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Copier le pitch 1 min
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Ton lien personnel
                  </p>
                  <p className="rounded-2xl border border-border/80 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                    {resumePath}
                  </p>
                  <Button
                    className="rounded-full"
                    onClick={copyResumeLink}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Copier le lien de reprise
                  </Button>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}
