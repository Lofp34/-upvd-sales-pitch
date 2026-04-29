import {
  PITCH_CLIENT_ISSUES_FIELD_ID,
  PITCH_STRENGTHS_FIELD_ID,
} from "@/lib/pitch/config";

export const PITCH_WORKFLOW_VERSION = 1;
export const MAX_FIELD_ITERATIONS = 3;

export const PITCH_PERSONAS = [
  "founder",
  "team",
  "external",
] as const;

export type PitchPersona = (typeof PITCH_PERSONAS)[number];

export type PitchWorkflowStage =
  | "draft"
  | "vagueness"
  | "respond"
  | "clarify"
  | "review"
  | "raise_stakes"
  | "generate"
  | "finalize";

export type PitchVaguenessStatus = "pending" | "answered" | "ignored";

export type PitchWorkflowFeedbackType =
  | "info"
  | "loading"
  | "success"
  | "error";

export type PitchWorkflowProfile = {
  email?: string;
  persona: PitchPersona;
};

export type PitchWorkflowFeedback = {
  id: string;
  type: PitchWorkflowFeedbackType;
  message: string;
  createdAt: string;
};

export type PitchFieldVersion = {
  id: string;
  fieldId: string;
  label: string;
  value: string;
  createdAt: string;
};

export type PitchVaguenessCard = {
  id: string;
  fieldId: string;
  question: string;
  response: string;
  status: PitchVaguenessStatus;
  iteration: number;
  createdAt: string;
  updatedAt: string;
};

export type PitchWorkflow = {
  version: typeof PITCH_WORKFLOW_VERSION;
  activeFieldId: string;
  activeCardId?: string;
  stage: PitchWorkflowStage;
  profile: PitchWorkflowProfile;
  iterations: Record<string, number>;
  versions: Record<string, PitchFieldVersion[]>;
  vaguenessCards: PitchVaguenessCard[];
  lastFeedback?: PitchWorkflowFeedback;
  createdAt: string;
  updatedAt: string;
};

export type PitchFinalOutput = Record<string, unknown> & {
  pitchWorkflow?: PitchWorkflow;
};

export function createWorkflowId(prefix: string) {
  const randomId =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  return `${prefix}-${randomId}`;
}

export function getPersonaLabel(persona: PitchPersona) {
  switch (persona) {
    case "team":
      return "Je travaille dans l'equipe";
    case "external":
      return "Je decouvre le projet / regard exterieur";
    case "founder":
    default:
      return "Je suis le porteur du projet";
  }
}

export function isPitchPersona(value: unknown): value is PitchPersona {
  return typeof value === "string" && PITCH_PERSONAS.includes(value as PitchPersona);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeProfile(value: unknown): PitchWorkflowProfile {
  if (!isRecord(value)) {
    return { persona: "founder" };
  }

  return {
    email: typeof value.email === "string" ? value.email : undefined,
    persona: isPitchPersona(value.persona) ? value.persona : "founder",
  };
}

export function getFinalOutputObject(value: unknown): PitchFinalOutput {
  if (isRecord(value)) {
    return value;
  }

  return {};
}

export function createDefaultPitchWorkflow(
  profile: Partial<PitchWorkflowProfile> = {},
): PitchWorkflow {
  const now = new Date().toISOString();

  return {
    version: PITCH_WORKFLOW_VERSION,
    activeFieldId: PITCH_STRENGTHS_FIELD_ID,
    stage: "draft",
    profile: {
      email: profile.email?.trim() || undefined,
      persona: profile.persona ?? "founder",
    },
    iterations: {
      [PITCH_STRENGTHS_FIELD_ID]: 1,
      [PITCH_CLIENT_ISSUES_FIELD_ID]: 1,
    },
    versions: {},
    vaguenessCards: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function readPitchWorkflow(value: unknown): PitchWorkflow {
  const output = getFinalOutputObject(value);
  const workflow = output.pitchWorkflow;

  if (!isRecord(workflow)) {
    return createDefaultPitchWorkflow();
  }

  const fallback = createDefaultPitchWorkflow(normalizeProfile(workflow.profile));
  const iterations = isRecord(workflow.iterations)
    ? Object.fromEntries(
        Object.entries(workflow.iterations).filter(
          ([, iteration]) => typeof iteration === "number",
        ),
      )
    : fallback.iterations;
  const versions = isRecord(workflow.versions)
    ? (workflow.versions as Record<string, PitchFieldVersion[]>)
    : fallback.versions;
  const vaguenessCards = Array.isArray(workflow.vaguenessCards)
    ? workflow.vaguenessCards.filter(isRecord).map((card) => ({
        id: typeof card.id === "string" ? card.id : createWorkflowId("card"),
        fieldId:
          typeof card.fieldId === "string"
            ? card.fieldId
            : PITCH_STRENGTHS_FIELD_ID,
        question: typeof card.question === "string" ? card.question : "",
        response: typeof card.response === "string" ? card.response : "",
        status:
          card.status === "answered" || card.status === "ignored"
            ? card.status
            : ("pending" as PitchVaguenessStatus),
        iteration:
          typeof card.iteration === "number" && card.iteration > 0
            ? card.iteration
            : 1,
        createdAt:
          typeof card.createdAt === "string" ? card.createdAt : fallback.createdAt,
        updatedAt:
          typeof card.updatedAt === "string" ? card.updatedAt : fallback.updatedAt,
      }))
    : fallback.vaguenessCards;

  return {
    ...fallback,
    activeFieldId:
      typeof workflow.activeFieldId === "string"
        ? workflow.activeFieldId
        : fallback.activeFieldId,
    activeCardId:
      typeof workflow.activeCardId === "string" ? workflow.activeCardId : undefined,
    stage:
      typeof workflow.stage === "string"
        ? (workflow.stage as PitchWorkflowStage)
        : fallback.stage,
    profile: normalizeProfile(workflow.profile),
    iterations: {
      ...fallback.iterations,
      ...iterations,
    },
    versions,
    vaguenessCards,
    lastFeedback: isRecord(workflow.lastFeedback)
      ? (workflow.lastFeedback as PitchWorkflowFeedback)
      : undefined,
    createdAt:
      typeof workflow.createdAt === "string" ? workflow.createdAt : fallback.createdAt,
    updatedAt:
      typeof workflow.updatedAt === "string" ? workflow.updatedAt : fallback.updatedAt,
  };
}

export function mergeFinalOutputWithWorkflow(
  finalOutputJson: unknown,
  workflow: PitchWorkflow,
): PitchFinalOutput {
  return {
    ...getFinalOutputObject(finalOutputJson),
    pitchWorkflow: workflow,
  };
}
