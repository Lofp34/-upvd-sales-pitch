"use client";

import {
  ArrowRight,
  CheckCircle2,
  Clipboard,
  Copy,
  LoaderCircle,
  MessageCircle,
  Mic,
  Pin,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
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
  PITCH_CLIENT_ISSUES_FIELD_ID,
  PITCH_COMMERCIAL_FIELD_ID,
  PITCH_FIELDS,
  PITCH_RAIL_BULLETS,
  PITCH_STRENGTHS_FIELD_ID,
  PITCH_STEP_ID,
} from "@/lib/pitch/config";
import {
  createWorkflowId,
  getPersonaLabel,
  MAX_FIELD_ITERATIONS,
  readPitchWorkflow,
  type PitchFieldVersion,
  type PitchVaguenessCard,
  type PitchWorkflow,
  type PitchWorkflowFeedbackType,
} from "@/lib/pitch/workflow";
import type { AiAction, AnswersState, WorkshopField } from "@/lib/workshop/types";
import {
  useVoiceDictation,
  type VoiceDictationTarget,
} from "@/hooks/use-voice-dictation";

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

type CoachMessage = {
  id: string;
  body: string;
  createdAt: string;
};

type AiAssistResponse = {
  message?: string;
  output?: string;
  cards?: Array<{
    question?: string;
  }>;
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

function joinAnswerBlocks(...values: Array<string | undefined>) {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join("\n\n");
}

function getStepFieldValue(
  stepAnswers: Record<string, string>,
  fieldId: string,
) {
  if (fieldId === PITCH_STRENGTHS_FIELD_ID) {
    return (
      stepAnswers[PITCH_STRENGTHS_FIELD_ID] ??
      joinAnswerBlocks(stepAnswers.valueResponse, stepAnswers.valueMethod)
    );
  }

  if (fieldId === PITCH_COMMERCIAL_FIELD_ID) {
    return (
      stepAnswers[PITCH_COMMERCIAL_FIELD_ID] ??
      stepAnswers.pitch60 ??
      stepAnswers.pitch30 ??
      ""
    );
  }

  return stepAnswers[fieldId] ?? "";
}

function getAiActionLabel(action: AiAction) {
  switch (action) {
    case "generate_pitch":
      return "Generer le pitch";
    case "clarify":
      return "Clarifier";
    case "shorten":
      return "Raccourcir";
    case "variants_3":
      return "3 variantes";
    case "flag_vagueness":
      return "Reperer le flou";
    case "raise_stakes":
      return "Rehausser les enjeux";
    case "oralize_30s":
      return "Version orale 30s";
    case "oralize_60s":
      return "Version orale 1 min";
    default:
      return action;
  }
}

function getFieldById(fieldId: string) {
  return (
    PITCH_FIELDS.find((field) => field.id === fieldId) ??
    PITCH_FIELDS.find((field) => field.id === PITCH_STRENGTHS_FIELD_ID) ??
    PITCH_FIELDS[0]
  );
}

function getNextInputFieldId(fieldId: string) {
  if (fieldId === PITCH_STRENGTHS_FIELD_ID) {
    return PITCH_CLIENT_ISSUES_FIELD_ID;
  }

  return PITCH_COMMERCIAL_FIELD_ID;
}

function getStatusLabel(status: PitchVaguenessCard["status"]) {
  switch (status) {
    case "answered":
      return "Traite";
    case "ignored":
      return "Hors sujet";
    case "pending":
    default:
      return "A traiter";
  }
}

function recordFieldVersion(
  workflow: PitchWorkflow,
  fieldId: string,
  value: string,
  label: string,
) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return workflow;
  }

  const previousVersions = workflow.versions[fieldId] ?? [];
  const previousVersion = previousVersions[previousVersions.length - 1];

  if (previousVersion?.value === value) {
    return workflow;
  }

  const nextVersion: PitchFieldVersion = {
    id: createWorkflowId("version"),
    fieldId,
    label,
    value,
    createdAt: new Date().toISOString(),
  };

  return {
    ...workflow,
    versions: {
      ...workflow.versions,
      [fieldId]: [...previousVersions, nextVersion].slice(-12),
    },
  };
}

function buildClarificationSource(
  fieldValue: string,
  cards: PitchVaguenessCard[],
) {
  const answered = cards.filter(
    (card) => card.status === "answered" && card.response.trim(),
  );
  const ignored = cards.filter((card) => card.status === "ignored");

  return [
    "Texte actuel:",
    fieldValue,
    answered.length ? "\nReponses aux points flous:" : null,
    ...answered.map((card) => `- ${card.question}\n  Reponse: ${card.response}`),
    ignored.length ? "\nPoints ignores car hors sujet:" : null,
    ...ignored.map((card) => `- ${card.question}`),
  ]
    .filter(Boolean)
    .join("\n");
}

function getFeedbackClasses(type: PitchWorkflowFeedbackType) {
  switch (type) {
    case "error":
      return "border-destructive/25 bg-destructive/10 text-destructive";
    case "loading":
      return "border-accent/30 bg-accent/15 text-accent-foreground";
    case "success":
      return "border-primary/20 bg-primary/10 text-primary";
    case "info":
    default:
      return "border-border bg-background/80 text-foreground";
  }
}

export function PitchEditor({
  session,
  workbook,
  resumePath,
}: PitchEditorProps) {
  const storageKey = `upvd-sales-pitch:${workbook.id}`;
  const [answers, setAnswers] = useState<AnswersState>(workbook.answersJson ?? {});
  const [workflow, setWorkflow] = useState<PitchWorkflow>(() =>
    readPitchWorkflow(workbook.finalOutputJson),
  );
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveMessage, setSaveMessage] = useState(
    "Chaque modification est sauvegardee automatiquement.",
  );
  const [assistStates, setAssistStates] = useState<Record<string, AssistState>>(
    {},
  );
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [pinnedCoachMessageIds, setPinnedCoachMessageIds] = useState<
    Set<string>
  >(new Set());
  const [origin, setOrigin] = useState("");
  const hydratedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenCoachMessageIdsRef = useRef<Set<string>>(new Set());
  const pinnedCoachMessageIdsRef = useRef<Set<string>>(new Set());
  const dictation = useVoiceDictation(workbook.id);

  const stepAnswers = answers[PITCH_STEP_ID] ?? {};
  const strengthsText = getStepFieldValue(
    stepAnswers,
    PITCH_STRENGTHS_FIELD_ID,
  ).trim();
  const clientIssuesText = getStepFieldValue(
    stepAnswers,
    PITCH_CLIENT_ISSUES_FIELD_ID,
  ).trim();
  const commercialPitch = getStepFieldValue(
    stepAnswers,
    PITCH_COMMERCIAL_FIELD_ID,
  ).trim();
  const activeField = getFieldById(workflow.activeFieldId);
  const activeFieldValue = getStepFieldValue(stepAnswers, activeField.id);
  const activeFieldKey = getFieldStorageId(PITCH_STEP_ID, activeField.id);
  const activeAssistState = assistStates[activeFieldKey];
  const activeIteration = workflow.iterations[activeField.id] ?? 1;
  const activeCards = workflow.vaguenessCards.filter(
    (card) => card.fieldId === activeField.id && card.iteration === activeIteration,
  );
  const handledCards = activeCards.filter((card) => card.status !== "pending");
  const activeCard =
    workflow.activeCardId
      ? workflow.vaguenessCards.find((card) => card.id === workflow.activeCardId)
      : null;
  const resumeUrl = origin ? `${origin}${resumePath}` : resumePath;

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      hydratedRef.current = true;
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        answers?: AnswersState;
        workflow?: PitchWorkflow;
      };

      if (parsed.answers) {
        setAnswers((previous) => mergeAnswers(previous, parsed.answers));
      }

      if (parsed.workflow) {
        setWorkflow(readPitchWorkflow({ pitchWorkflow: parsed.workflow }));
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
        workflow,
        savedAt: new Date().toISOString(),
      }),
    );
  }, [answers, storageKey, workflow]);

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
            finalOutputJson: {
              pitchWorkflow: workflow,
            },
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
  }, [answers, workbook.id, workflow]);

  useEffect(() => {
    let stopped = false;
    const messageTimeouts: Array<ReturnType<typeof setTimeout>> = [];

    async function pollCoachMessages() {
      if (document.visibilityState === "hidden") {
        return;
      }

      try {
        const response = await fetch(
          `/api/workbooks/${workbook.id}/coach-messages`,
          { cache: "no-store" },
        );
        const payload = await readResponsePayload<{
          messages?: CoachMessage[];
        }>(response);
        const incomingMessages = payload.messages ?? [];

        if (!response.ok || stopped || incomingMessages.length === 0) {
          return;
        }

        const freshMessages = incomingMessages.filter(
          (message) => !seenCoachMessageIdsRef.current.has(message.id),
        );

        if (freshMessages.length === 0) {
          return;
        }

        for (const message of freshMessages) {
          seenCoachMessageIdsRef.current.add(message.id);
          messageTimeouts.push(
            setTimeout(() => {
              if (pinnedCoachMessageIdsRef.current.has(message.id)) {
                return;
              }

              setCoachMessages((visibleMessages) =>
                visibleMessages.filter((item) => item.id !== message.id),
              );
            }, 12000),
          );
        }

        setCoachMessages((currentMessages) => {
          return [...currentMessages, ...freshMessages].slice(-3);
        });
      } catch {
        // Messaging is helpful but should never interrupt the writing flow.
      }
    }

    void pollCoachMessages();
    const interval = setInterval(() => {
      void pollCoachMessages();
    }, 4000);

    return () => {
      stopped = true;
      clearInterval(interval);
      for (const timeout of messageTimeouts) {
        clearTimeout(timeout);
      }
    };
  }, [workbook.id]);

  function updateWorkflow(
    updater: (currentWorkflow: PitchWorkflow) => PitchWorkflow,
  ) {
    setWorkflow((currentWorkflow) => ({
      ...updater(currentWorkflow),
      updatedAt: new Date().toISOString(),
    }));
  }

  function showFeedback(type: PitchWorkflowFeedbackType, message: string) {
    setSaveMessage(message);
    updateWorkflow((currentWorkflow) => ({
      ...currentWorkflow,
      lastFeedback: {
        id: createWorkflowId("feedback"),
        type,
        message,
        createdAt: new Date().toISOString(),
      },
    }));
  }

  function pinCoachMessage(messageId: string) {
    setPinnedCoachMessageIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(messageId);
      pinnedCoachMessageIdsRef.current = nextIds;

      return nextIds;
    });
  }

  function closeCoachMessage(messageId: string) {
    setCoachMessages((visibleMessages) =>
      visibleMessages.filter((item) => item.id !== messageId),
    );
    setPinnedCoachMessageIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.delete(messageId);
      pinnedCoachMessageIdsRef.current = nextIds;

      return nextIds;
    });
  }

  function updateField(fieldId: string, value: string) {
    setAnswers((previous) => ({
      ...previous,
      [PITCH_STEP_ID]: {
        ...(previous[PITCH_STEP_ID] ?? {}),
        [fieldId]: value,
      },
    }));
  }

  function updateWorkflowFocus(
    fieldId: string,
    stage: PitchWorkflow["stage"],
    activeCardId?: string,
  ) {
    updateWorkflow((currentWorkflow) => ({
      ...currentWorkflow,
      activeFieldId: fieldId,
      activeCardId,
      stage,
    }));
  }

  function appendTranscriptToField(
    fieldId: string,
    baseText: string,
    transcript: string,
  ) {
    const nextValue = baseText.trim()
      ? `${baseText.trim()}\n\n${transcript.trim()}`
      : transcript.trim();

    updateField(fieldId, nextValue);
    updateWorkflow((currentWorkflow) =>
      recordFieldVersion(
        {
          ...currentWorkflow,
          activeFieldId: fieldId,
          stage: "draft",
        },
        fieldId,
        baseText,
        "Version avant dictee",
      ),
    );
    showFeedback("success", "Dictee ajoutee au champ.");
  }

  function appendTranscriptToCard(
    card: PitchVaguenessCard,
    transcript: string,
  ) {
    const now = new Date().toISOString();
    const nextResponse = card.response.trim()
      ? `${card.response.trim()}\n\n${transcript.trim()}`
      : transcript.trim();

    updateWorkflow((currentWorkflow) => ({
      ...currentWorkflow,
      activeFieldId: card.fieldId,
      activeCardId: card.id,
      stage: "respond",
      vaguenessCards: currentWorkflow.vaguenessCards.map((item) =>
        item.id === card.id
          ? {
              ...item,
              response: nextResponse,
              status: "answered",
              updatedAt: now,
            }
          : item,
      ),
    }));
    showFeedback("success", "Dictee ajoutee au point flou.");
  }

  function createFieldDictationTarget(
    field: WorkshopField,
    fieldValue: string,
  ): VoiceDictationTarget {
    return {
      id: `field:${field.id}`,
      fieldId: field.id,
      fieldLabel: field.label,
      contextLabel: field.label,
      currentText: fieldValue,
      onTranscript: (text) => appendTranscriptToField(field.id, fieldValue, text),
    };
  }

  function createCardDictationTarget(card: PitchVaguenessCard) {
    const field = getFieldById(card.fieldId);

    return {
      id: `card:${card.id}`,
      fieldId: card.fieldId,
      fieldLabel: field.label,
      contextLabel: card.question,
      currentText: card.response,
      onTranscript: (text: string) => appendTranscriptToCard(card, text),
    } satisfies VoiceDictationTarget;
  }

  function buildAssistPayload(
    field: WorkshopField,
    action: AiAction,
    sourceTextOverride?: string,
  ) {
    const ignoredPoints = workflow.vaguenessCards
      .filter((card) => card.fieldId === field.id && card.status === "ignored")
      .map((card) => card.question)
      .join("\n");
    const context = {
      startup: workbook.startup,
      participant: workbook.name,
      stepTitle: "Pitch commercial startup",
      fieldLabel: field.label,
      fieldHelper: field.helper,
      sessionTitle: session.title,
      persona: getPersonaLabel(workflow.profile.persona),
      emailAvailable: workflow.profile.email ? "oui" : "non",
      iteration: String(workflow.iterations[field.id] ?? 1),
      ignoredPoints,
    };

    if (action === "generate_pitch") {
      if (!strengthsText || !clientIssuesText) {
        return {
          error:
            "Renseigne d'abord le bloc forces et le bloc enjeux avant de generer le pitch.",
        };
      }

      return {
        sourceText: [
          `Bloc 1 - Ce que vous apportez, vos forces :\n${strengthsText}`,
          `Bloc 2 - Enjeux reels de vos interlocuteurs :\n${clientIssuesText}`,
          commercialPitch
            ? `Brouillon actuel du pitch :\n${commercialPitch}`
            : null,
        ]
          .filter(Boolean)
          .join("\n\n"),
        context: {
          ...context,
          pitchStructure: "enjeux clients -> forces -> benefices clients",
        },
      };
    }

    const sourceText =
      sourceTextOverride ?? getStepFieldValue(stepAnswers, field.id);

    if (!sourceText.trim()) {
      return {
        error: "Commence par ecrire une base de texte dans ce champ.",
      };
    }

    return {
      sourceText,
      context,
    };
  }

  async function runAiAssist(
    field: WorkshopField,
    action: AiAction,
    sourceTextOverride?: string,
  ) {
    const fieldKey = getFieldStorageId(PITCH_STEP_ID, field.id);
    const assistPayload = buildAssistPayload(field, action, sourceTextOverride);

    if ("error" in assistPayload) {
      const errorMessage =
        assistPayload.error ?? "Assistance IA indisponible.";

      setAssistStates((previous) => ({
        ...previous,
        [fieldKey]: {
          loading: false,
          action,
          error: errorMessage,
        },
      }));
      showFeedback("error", errorMessage);
      return null;
    }

    setAssistStates((previous) => ({
      ...previous,
      [fieldKey]: {
        loading: true,
        action,
      },
    }));
    showFeedback("loading", `${getAiActionLabel(action)} en cours...`);

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
          sourceText: assistPayload.sourceText,
          context: assistPayload.context,
        }),
      });

      const payload = await readResponsePayload<AiAssistResponse>(response);

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
      showFeedback("success", `${getAiActionLabel(action)} termine.`);

      return payload;
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Assistance IA indisponible.";

      setAssistStates((previous) => ({
        ...previous,
        [fieldKey]: {
          loading: false,
          action,
          error: message,
        },
      }));
      showFeedback("error", message);

      return null;
    }
  }

  async function handleFlagVagueness(field: WorkshopField) {
    const payload = await runAiAssist(field, "flag_vagueness");

    if (!payload) {
      return;
    }

    const now = new Date().toISOString();
    const iteration = workflow.iterations[field.id] ?? 1;
    const cards = (payload.cards ?? [])
      .map((card) => card.question?.trim())
      .filter((question): question is string => Boolean(question))
      .map((question) => ({
        id: createWorkflowId("card"),
        fieldId: field.id,
        question,
        response: "",
        status: "pending" as const,
        iteration,
        createdAt: now,
        updatedAt: now,
      }));

    updateWorkflow((currentWorkflow) => ({
      ...currentWorkflow,
      activeFieldId: field.id,
      stage: cards.length ? "respond" : "clarify",
      vaguenessCards: [
        ...currentWorkflow.vaguenessCards.filter(
          (card) => !(card.fieldId === field.id && card.iteration === iteration),
        ),
        ...cards,
      ],
    }));
  }

  function applyAiOutput(field: WorkshopField, output: string, action: AiAction) {
    const currentValue = getStepFieldValue(stepAnswers, field.id);

    updateField(field.id, output);
    updateWorkflow((currentWorkflow) => {
      const nextWorkflow = recordFieldVersion(
        currentWorkflow,
        field.id,
        currentValue,
        `Version avant ${getAiActionLabel(action).toLowerCase()}`,
      );

      if (action === "generate_pitch") {
        return {
          ...nextWorkflow,
          activeFieldId: PITCH_COMMERCIAL_FIELD_ID,
          stage: "finalize",
          activeCardId: undefined,
        };
      }

      if (action === "raise_stakes") {
        return {
          ...nextWorkflow,
          activeFieldId: PITCH_COMMERCIAL_FIELD_ID,
          stage: "generate",
          activeCardId: undefined,
        };
      }

      return {
        ...nextWorkflow,
        activeFieldId: field.id,
        stage: field.id === PITCH_COMMERCIAL_FIELD_ID ? "finalize" : "review",
        activeCardId: undefined,
      };
    });
    setAssistStates((previous) => ({
      ...previous,
      [getFieldStorageId(PITCH_STEP_ID, field.id)]: {
        loading: false,
        action,
      },
    }));
    showFeedback("success", "Texte mis a jour. Tu peux annuler si besoin.");
  }

  function undoLastFieldChange(field: WorkshopField) {
    const versions = workflow.versions[field.id] ?? [];
    const lastVersion = versions[versions.length - 1];

    if (!lastVersion) {
      showFeedback("info", "Aucune version precedente disponible pour ce bloc.");
      return;
    }

    updateField(field.id, lastVersion.value);
    updateWorkflow((currentWorkflow) => ({
      ...currentWorkflow,
      activeFieldId: field.id,
      versions: {
        ...currentWorkflow.versions,
        [field.id]: versions.slice(0, -1),
      },
    }));
    showFeedback("success", "Derniere action annulee.");
  }

  function updateCardResponse(cardId: string, response: string) {
    const now = new Date().toISOString();

    updateWorkflow((currentWorkflow) => ({
      ...currentWorkflow,
      activeCardId: cardId,
      stage: "respond",
      vaguenessCards: currentWorkflow.vaguenessCards.map((card) =>
        card.id === cardId
          ? {
              ...card,
              response,
              status: response.trim() ? "answered" : "pending",
              updatedAt: now,
            }
          : card,
      ),
    }));
  }

  function ignoreCard(cardId: string) {
    const now = new Date().toISOString();

    updateWorkflow((currentWorkflow) => ({
      ...currentWorkflow,
      activeCardId: cardId,
      stage: "respond",
      vaguenessCards: currentWorkflow.vaguenessCards.map((card) =>
        card.id === cardId
          ? {
              ...card,
              status: "ignored",
              updatedAt: now,
            }
          : card,
      ),
    }));
    showFeedback("success", "Point ignore. Il sera signale a l'IA.");
  }

  async function clarifyWithCards(field: WorkshopField) {
    const fieldValue = getStepFieldValue(stepAnswers, field.id);
    const iteration = workflow.iterations[field.id] ?? 1;
    const cards = workflow.vaguenessCards.filter(
      (card) => card.fieldId === field.id && card.iteration === iteration,
    );

    if (
      cards.length > 0 &&
      !cards.some((card) => card.status !== "pending")
    ) {
      showFeedback("info", "Traite ou ignore au moins un point flou avant de clarifier.");
      return;
    }

    const sourceText = buildClarificationSource(fieldValue, cards);
    const payload = await runAiAssist(field, "clarify", sourceText);

    if (payload?.output) {
      updateWorkflowFocus(field.id, "clarify");
    }
  }

  async function handleRaiseStakes(field: WorkshopField) {
    const payload = await runAiAssist(field, "raise_stakes");

    if (payload?.output) {
      updateWorkflowFocus(field.id, "raise_stakes");
    }
  }

  async function handleGeneratePitch() {
    const field = getFieldById(PITCH_COMMERCIAL_FIELD_ID);
    const payload = await runAiAssist(field, "generate_pitch");

    if (payload?.output) {
      updateWorkflowFocus(PITCH_COMMERCIAL_FIELD_ID, "generate");
    }
  }

  function startNewIteration(field: WorkshopField) {
    const currentIteration = workflow.iterations[field.id] ?? 1;

    updateWorkflow((currentWorkflow) => ({
      ...currentWorkflow,
      activeFieldId: field.id,
      activeCardId: undefined,
      stage: "vagueness",
      iterations: {
        ...currentWorkflow.iterations,
        [field.id]: currentIteration + 1,
      },
    }));
    showFeedback("info", "Nouvelle iteration ouverte.");
  }

  async function runPrimaryAction() {
    if (activeAssistState?.loading) {
      return;
    }

    if (activeField.id === PITCH_COMMERCIAL_FIELD_ID) {
      if (workflow.stage === "finalize" && commercialPitch) {
        await copyPitch(commercialPitch, "Pitch commercial");
        return;
      }

      if (activeAssistState?.output) {
        applyAiOutput(
          activeField,
          activeAssistState.output,
          activeAssistState.action ?? "generate_pitch",
        );
        return;
      }

      await handleGeneratePitch();
      return;
    }

    if (!activeFieldValue.trim()) {
      showFeedback("error", "Commence par ecrire ou dicter une base de texte.");
      return;
    }

    if (activeAssistState?.output && workflow.stage !== "respond") {
      applyAiOutput(
        activeField,
        activeAssistState.output,
        activeAssistState.action ?? "clarify",
      );
      return;
    }

    if (workflow.stage === "draft" || workflow.stage === "vagueness") {
      await handleFlagVagueness(activeField);
      return;
    }

    if (workflow.stage === "respond" || workflow.stage === "clarify") {
      await clarifyWithCards(activeField);
      return;
    }

    if (workflow.stage === "review") {
      if (activeField.id === PITCH_STRENGTHS_FIELD_ID) {
        updateWorkflowFocus(PITCH_CLIENT_ISSUES_FIELD_ID, "draft");
        showFeedback("info", "Bloc enjeux ouvert.");
        return;
      }

      await handleRaiseStakes(activeField);
      return;
    }

    if (workflow.stage === "raise_stakes") {
      await handleRaiseStakes(activeField);
    }
  }

  function getPrimaryActionLabel() {
    if (activeAssistState?.loading) {
      return `${getAiActionLabel(activeAssistState.action ?? "clarify")}...`;
    }

    if (activeAssistState?.output && workflow.stage !== "respond") {
      return "Appliquer cette version";
    }

    if (activeField.id === PITCH_COMMERCIAL_FIELD_ID) {
      return workflow.stage === "finalize" && commercialPitch
        ? "Copier le pitch"
        : "Generer le pitch";
    }

    if (workflow.stage === "draft" || workflow.stage === "vagueness") {
      return "Reperer ce qui reste flou";
    }

    if (workflow.stage === "respond" || workflow.stage === "clarify") {
      return "Clarifier avec ces reponses";
    }

    if (workflow.stage === "review") {
      return activeField.id === PITCH_STRENGTHS_FIELD_ID
        ? "Passer au bloc enjeux"
        : "Rehausser les enjeux";
    }

    if (workflow.stage === "raise_stakes") {
      return "Rehausser les enjeux";
    }

    return "Etape suivante";
  }

  async function copyResumeLink() {
    await navigator.clipboard.writeText(resumeUrl);
    showFeedback("success", "Lien personnel copie.");
  }

  async function copySuggestion(output: string) {
    await navigator.clipboard.writeText(output);
    showFeedback("success", "Suggestion IA copiee.");
  }

  async function copyPitch(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    showFeedback("success", `${label} copie.`);
  }

  function renderSuggestion(field: WorkshopField) {
    const fieldKey = getFieldStorageId(PITCH_STEP_ID, field.id);
    const assistState = assistStates[fieldKey];

    if (!assistState?.output) {
      return null;
    }

    return (
      <div className="mt-4 rounded-3xl border border-primary/15 bg-primary/5 p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-primary/70">
          Suggestion IA
        </p>
        <div className="mt-2 text-sm leading-7 text-foreground [overflow-wrap:anywhere] [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded-md [&_code]:bg-background/80 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.92em] [&_em]:italic [&_h1]:mt-5 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-primary [&_h1:first-child]:mt-0 [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-primary [&_h2:first-child]:mt-0 [&_h3]:mt-4 [&_h3]:font-semibold [&_h3:first-child]:mt-0 [&_li]:ml-1 [&_li]:pl-1 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p]:mt-3 [&_p:first-child]:mt-0 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:bg-background/85 [&_pre]:p-4 [&_pre]:text-xs [&_strong]:font-semibold [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {assistState.output}
          </ReactMarkdown>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {assistState.action !== "flag_vagueness" ? (
            <Button
              className="rounded-full"
              onClick={() =>
                applyAiOutput(
                  field,
                  assistState.output ?? "",
                  assistState.action ?? "clarify",
                )
              }
              size="sm"
              type="button"
            >
              <CheckCircle2 className="size-3.5" />
              Appliquer cette version
            </Button>
          ) : null}
          <Button
            className="rounded-full"
            onClick={() => copySuggestion(assistState.output ?? "")}
            size="sm"
            type="button"
            variant="outline"
          >
            <Copy className="size-3.5" />
            Copier
          </Button>
        </div>
      </div>
    );
  }

  function renderField(field: WorkshopField) {
    const fieldValue = getStepFieldValue(stepAnswers, field.id);
    const fieldKey = getFieldStorageId(PITCH_STEP_ID, field.id);
    const assistState = assistStates[fieldKey];
    const selected = workflow.activeFieldId === field.id;
    const versions = workflow.versions[field.id] ?? [];

    return (
      <article
        className={`rounded-[1.75rem] border p-5 transition ${
          selected
            ? "border-primary/30 bg-primary/5 shadow-[0_24px_70px_-50px_rgba(24,30,58,0.45)]"
            : "border-border/80 bg-background/75"
        }`}
        key={fieldKey}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Label
              className="text-base font-medium text-foreground"
              htmlFor={fieldKey}
            >
              {field.label}
            </Label>
            {field.helper ? (
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {field.helper}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={selected ? "default" : "outline"}>
              Iteration {workflow.iterations[field.id] ?? 1}
              {field.id !== PITCH_COMMERCIAL_FIELD_ID
                ? `/${MAX_FIELD_ITERATIONS}`
                : ""}
            </Badge>
            <Button
              className="rounded-full"
              onClick={() => updateWorkflowFocus(field.id, "draft")}
              size="sm"
              type="button"
              variant={selected ? "secondary" : "outline"}
            >
              Travailler ce bloc
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <Textarea
            id={fieldKey}
            onChange={(event) => updateField(field.id, event.target.value)}
            onFocus={() => updateWorkflowFocus(field.id, workflow.stage)}
            placeholder={field.placeholder}
            rows={field.rows ?? 5}
            value={fieldValue}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <VoiceDictationButton
            controller={dictation}
            target={createFieldDictationTarget(field, fieldValue)}
          />
          {versions.length ? (
            <Button
              className="rounded-full"
              onClick={() => undoLastFieldChange(field)}
              size="sm"
              type="button"
              variant="outline"
            >
              <RotateCcw className="size-3.5" />
              Annuler la derniere action
            </Button>
          ) : null}
        </div>

        {field.aiActions?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {field.aiActions.map((action) => (
              <Button
                className="rounded-full"
                disabled={assistState?.loading}
                key={action}
                onClick={() => {
                  if (action === "flag_vagueness") {
                    void handleFlagVagueness(field);
                    return;
                  }

                  void runAiAssist(field, action);
                }}
                size="sm"
                type="button"
                variant={action === "generate_pitch" ? "default" : "outline"}
              >
                {assistState?.loading && assistState.action === action ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : null}
                {getAiActionLabel(action)}
              </Button>
            ))}
          </div>
        ) : null}

        {renderSuggestion(field)}

        {assistState?.error ? (
          <p className="mt-3 text-sm text-destructive">{assistState.error}</p>
        ) : null}
      </article>
    );
  }

  function renderVaguenessCards() {
    if (activeField.id === PITCH_COMMERCIAL_FIELD_ID || activeCards.length === 0) {
      return (
        <div className="rounded-[1.5rem] border border-dashed border-border bg-background/60 p-5 text-sm leading-6 text-muted-foreground">
          Les points flous apparaitront ici apres l&apos;analyse du bloc actif.
        </div>
      );
    }

    return (
      <div className="grid gap-3">
        {activeCards.map((card) => {
          const selected = workflow.activeCardId === card.id;

          return (
            <article
              className={`rounded-[1.5rem] border p-4 transition ${
                selected
                  ? "border-primary/35 bg-primary/5"
                  : "border-border/80 bg-background/75"
              }`}
              key={card.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <Badge
                    className="rounded-full"
                    variant={card.status === "pending" ? "outline" : "default"}
                  >
                    {getStatusLabel(card.status)}
                  </Badge>
                  <p className="text-sm font-medium leading-6 text-foreground">
                    {card.question}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="rounded-full"
                    onClick={() => {
                      updateWorkflowFocus(card.fieldId, "respond", card.id);
                      void dictation.startRecording(createCardDictationTarget(card));
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Mic className="size-3.5" />
                    Preciser
                  </Button>
                  <Button
                    className="rounded-full"
                    onClick={() => ignoreCard(card.id)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <XCircle className="size-3.5" />
                    Hors sujet
                  </Button>
                </div>
              </div>
              <Textarea
                aria-label={`Reponse au point flou: ${card.question}`}
                className="mt-3 min-h-24 bg-background/90"
                onChange={(event) =>
                  updateCardResponse(card.id, event.target.value)
                }
                onFocus={() => updateWorkflowFocus(card.fieldId, "respond", card.id)}
                placeholder="Ecris ou dicte ta reponse a ce point."
                value={card.response}
              />
            </article>
          );
        })}
      </div>
    );
  }

  function renderMobileDictationBar() {
    const target =
      activeCard && activeCard.status !== "ignored"
        ? createCardDictationTarget(activeCard)
        : createFieldDictationTarget(activeField, activeFieldValue);
    const recording = dictation.status === "recording";
    const transcribing = dictation.status === "transcribing";

    return (
      <div className="fixed inset-x-3 bottom-3 z-40 rounded-[1.5rem] border border-primary/20 bg-card/95 p-3 shadow-[0_24px_80px_-34px_rgba(24,30,58,0.48)] backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Dictee active
            </p>
            <p className="truncate text-sm font-medium text-primary">
              {target.contextLabel}
            </p>
          </div>
          {recording ? (
            <Button
              className="rounded-full"
              onClick={dictation.stopRecording}
              type="button"
              variant="secondary"
            >
              <Square className="size-4" />
              Stop {dictation.elapsedSeconds}s
            </Button>
          ) : (
            <Button
              className="rounded-full"
              disabled={transcribing || dictation.status === "unsupported"}
              onClick={() => dictation.startRecording(target)}
              type="button"
            >
              {transcribing ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Mic className="size-4" />
              )}
              {transcribing ? "Transcription" : "Micro"}
            </Button>
          )}
        </div>
        {dictation.error ? (
          <p className="mt-2 text-xs text-destructive">{dictation.error}</p>
        ) : null}
      </div>
    );
  }

  const inputFields = PITCH_FIELDS.filter(
    (field) => field.id !== PITCH_COMMERCIAL_FIELD_ID,
  );
  const pitchField = getFieldById(PITCH_COMMERCIAL_FIELD_ID);

  return (
    <main className="editorial-shell soft-grid pb-28 md:pb-0">
      <div className="mx-auto flex min-h-screen w-full max-w-[1560px] flex-col gap-6 px-4 py-4 md:px-6 lg:px-8">
        <header className="editorial-card flex flex-col gap-5 px-5 py-5 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-primary/10 text-primary">
                  Assistant guide
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-full border-accent/50 bg-accent/10 text-accent-foreground"
                >
                  {workbook.startup}
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {getPersonaLabel(workflow.profile.persona)}
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                  {session.title}
                </p>
                <h1 className="editorial-title text-4xl text-primary md:text-5xl">
                  Construis ton pitch sans perdre ton texte.
                </h1>
                <p className="max-w-3xl text-base leading-7 text-muted-foreground">
                  L&apos;atelier avance bloc par bloc: decrire, reperer les flous,
                  repondre point par point, clarifier, rehausser les enjeux,
                  puis generer le pitch.
                </p>
              </div>
            </div>

            <div className="grid min-w-[280px] gap-3 rounded-[1.5rem] bg-secondary/75 p-4">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Etape active</span>
                <span className="font-medium text-primary">
                  {activeField.label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">
                  {saveState === "error" ? "Attention" : "Autosave actif"}
                </span>
                <span className="font-medium text-primary">{saveMessage}</span>
              </div>
              <Button
                className="w-full rounded-full"
                onClick={copyResumeLink}
                type="button"
                variant="outline"
              >
                <Clipboard className="size-4" />
                Copier le lien de reprise
              </Button>
            </div>
          </div>

          {workflow.lastFeedback ? (
            <div
              aria-live="polite"
              className={`rounded-2xl border px-4 py-3 text-sm ${getFeedbackClasses(
                workflow.lastFeedback.type,
              )}`}
              role="status"
            >
              {workflow.lastFeedback.message}
            </div>
          ) : null}
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.6fr)]">
          <section className="space-y-6">
            <Card className="editorial-card rounded-[2rem]">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="editorial-title text-3xl text-primary">
                      Workflow de clarification
                    </CardTitle>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                      Le bouton principal declenche l&apos;action logique selon
                      l&apos;etat du bloc actif. Les suggestions IA restent appliquees
                      seulement apres validation.
                    </p>
                  </div>
                  <Button
                    className="rounded-full"
                    disabled={activeAssistState?.loading}
                    onClick={() => void runPrimaryAction()}
                    type="button"
                  >
                    {activeAssistState?.loading ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <ArrowRight className="size-4" />
                    )}
                    {getPrimaryActionLabel()}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 xl:grid-cols-2">
                  {inputFields.map((field) => renderField(field))}
                </div>
                {renderField(pitchField)}
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-6">
            <Card className="editorial-card sticky top-4 rounded-[2rem]">
              <CardHeader className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge className="rounded-full bg-primary/10 text-primary">
                    Cartes de flou
                  </Badge>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {handledCards.length}/{activeCards.length} traitees
                  </p>
                </div>
                <CardTitle className="editorial-title text-3xl text-primary">
                  Ce qu&apos;il faut preciser
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {renderVaguenessCards()}

                {activeField.id !== PITCH_COMMERCIAL_FIELD_ID ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="rounded-full"
                      onClick={() => startNewIteration(activeField)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Sparkles className="size-3.5" />
                      {activeIteration >= MAX_FIELD_ITERATIONS
                        ? "Forcer une iteration"
                        : "Refaire une iteration"}
                    </Button>
                    <Button
                      className="rounded-full"
                      onClick={() =>
                        updateWorkflowFocus(
                          getNextInputFieldId(activeField.id),
                          activeField.id === PITCH_CLIENT_ISSUES_FIELD_ID
                            ? "generate"
                            : "draft",
                        )
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Passer a la suite
                    </Button>
                  </div>
                ) : null}

                <div className="space-y-3 rounded-2xl border border-border/80 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Lien de reprise
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="rounded-xl bg-white p-2">
                      <QRCode
                        size={92}
                        title="QR code du lien de reprise"
                        value={resumeUrl}
                        viewBox="0 0 256 256"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="break-all text-sm text-muted-foreground">
                        {resumeUrl}
                      </p>
                      <Button
                        className="rounded-full"
                        onClick={copyResumeLink}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Copy className="size-3.5" />
                        Copier
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/80 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Pitch commercial
                  </p>
                  <p className="text-sm leading-7 text-foreground">
                    {commercialPitch || "Ton pitch commercial apparaitra ici."}
                  </p>
                  {commercialPitch ? (
                    <Button
                      className="rounded-full"
                      onClick={() => copyPitch(commercialPitch, "Pitch commercial")}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Copy className="size-3.5" />
                      Copier le pitch
                    </Button>
                  ) : null}
                </div>

                <div className="grid gap-3">
                  {PITCH_RAIL_BULLETS.map((bullet) => (
                    <div
                      className="rounded-2xl border border-border/80 bg-background/70 p-4 text-sm leading-7 text-foreground"
                      key={bullet}
                    >
                      <ShieldCheck className="mb-2 size-4 text-primary" />
                      {bullet}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      {renderMobileDictationBar()}

      {coachMessages.length ? (
        <div
          aria-live="polite"
          className="fixed bottom-24 right-4 z-50 flex w-[min(calc(100vw-2rem),26rem)] flex-col gap-3 md:bottom-4"
        >
          {coachMessages.map((message) => {
            const pinned = pinnedCoachMessageIds.has(message.id);

            return (
              <div
                className="animate-in slide-in-from-bottom-3 fade-in rounded-[1.5rem] border border-primary/15 bg-card/95 p-4 text-card-foreground shadow-[0_24px_80px_-34px_rgba(24,30,58,0.45)] backdrop-blur"
                key={message.id}
                role="status"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <MessageCircle className="size-4" />
                    </span>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-primary/70">
                        Conseil formateur
                      </p>
                      {pinned ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Message epingle
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <Button
                      className="rounded-full"
                      disabled={pinned}
                      onClick={() => pinCoachMessage(message.id)}
                      size="sm"
                      type="button"
                      variant={pinned ? "secondary" : "outline"}
                    >
                      <Pin className="size-3.5" />
                      {pinned ? "Epingle" : "Epingler"}
                    </Button>
                    <Button
                      aria-label="Fermer le conseil formateur"
                      className="rounded-full"
                      onClick={() => closeCoachMessage(message.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <X className="size-3.5" />
                      Fermer
                    </Button>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {message.body}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}
    </main>
  );
}
