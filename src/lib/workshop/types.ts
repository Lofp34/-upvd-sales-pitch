export const AI_ACTIONS = [
  "generate_pitch",
  "clarify",
  "shorten",
  "variants_3",
  "flag_vagueness",
  "raise_stakes",
  "oralize_30s",
  "oralize_60s",
] as const;

export type AiAction = (typeof AI_ACTIONS)[number];

export type FieldKind = "input" | "textarea";

export type WorkshopField = {
  id: string;
  label: string;
  helper?: string;
  placeholder?: string;
  kind?: FieldKind;
  rows?: number;
  aiActions?: AiAction[];
};

export type WorkshopStep = {
  id: string;
  slideRef: string;
  title: string;
  subtitle: string;
  intro: string;
  coachCue: string;
  railTitle: string;
  railBullets: string[];
  fields: WorkshopField[];
};

export type AnswersState = Record<string, Record<string, string>>;

export type PlaybookLine = {
  label: string;
  value: string;
};

export type FinalPlaybook = {
  generatedAt: string;
  participantName: string;
  startup: string;
  contactStructure: PlaybookLine[];
  startupStrengths: PlaybookLine[];
  clientIssues: PlaybookLine[];
  valueProposition: PlaybookLine[];
  shortPitch: string;
  extendedPitch: string;
  firstDiscoveryQuestion: string;
  commitmentNote: string;
};
