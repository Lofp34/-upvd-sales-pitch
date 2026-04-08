import type { WorkshopField } from "@/lib/workshop/types";

export const PITCH_STEP_ID = "pitch-studio";
export const MAX_RECORDING_SECONDS = 5 * 60;
export const MAX_AUDIO_UPLOAD_BYTES = 24 * 1024 * 1024;

export const PITCH_FIELDS: WorkshopField[] = [
  {
    id: "valueResponse",
    label: "Ce que vous apportez",
    helper: "Solution, methode, savoir-faire, technologie ou accompagnement.",
    placeholder: "Pour repondre a ces enjeux, nous apportons...",
    kind: "textarea",
    rows: 5,
    aiActions: ["clarify", "shorten", "flag_vagueness", "variants_3"],
  },
  {
    id: "valueMethod",
    label: "Comment vous traitez le sujet",
    helper: "Plus simple, plus fluide, plus rapide, plus fiable...",
    placeholder: "Notre maniere de traiter ce sujet est...",
    kind: "textarea",
    rows: 4,
    aiActions: ["clarify", "shorten", "flag_vagueness"],
  },
  {
    id: "valueBenefits",
    label: "Ce que cela permet",
    helper: "Gagner, eviter, securiser, ameliorer.",
    placeholder:
      "Cela permet a nos interlocuteurs de gagner..., d'eviter..., de securiser...",
    kind: "textarea",
    rows: 5,
    aiActions: ["clarify", "shorten", "flag_vagueness", "variants_3"],
  },
  {
    id: "pitch30",
    label: "Pitch court 30 secondes",
    helper: "Une version ramassee, tres claire, utilisable vite.",
    placeholder: "Nous aidons [type d'interlocuteur] qui font face a...",
    kind: "textarea",
    rows: 5,
    aiActions: [
      "clarify",
      "shorten",
      "variants_3",
      "oralize_30s",
      "flag_vagueness",
    ],
  },
  {
    id: "pitch60",
    label: "Pitch oral 1 minute max",
    helper: "Une version orale plus posee, mais toujours lisible.",
    placeholder: "En une minute, je presenterais ma startup ainsi...",
    kind: "textarea",
    rows: 6,
    aiActions: ["clarify", "shorten", "oralize_60s", "flag_vagueness"],
  },
];

export const PITCH_RAIL_BULLETS = [
  "Commence par l'enjeu traite, pas par ton produit.",
  "Explique ensuite ce que vous apportez concretement.",
  "Termine par le benefice visible pour l'interlocuteur.",
];
