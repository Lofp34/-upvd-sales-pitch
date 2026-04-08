import type { WorkshopField } from "@/lib/workshop/types";

export const PITCH_STEP_ID = "pitch-studio";
export const MAX_RECORDING_SECONDS = 5 * 60;
export const MAX_AUDIO_UPLOAD_BYTES = 24 * 1024 * 1024;
export const PITCH_STRENGTHS_FIELD_ID = "startupStrengths";
export const PITCH_CLIENT_ISSUES_FIELD_ID = "clientIssues";
export const PITCH_COMMERCIAL_FIELD_ID = "pitchCommercial";

export const PITCH_FIELDS: WorkshopField[] = [
  {
    id: PITCH_STRENGTHS_FIELD_ID,
    label: "Ce que vous apportez, vos forces",
    helper:
      "Vos savoir-faire, vos differentiations, votre methode, vos preuves, ce qui vous rend credibles.",
    placeholder:
      "Decrivez ce que vous apportez reellement : expertise, methode, savoir-faire, differenciations, elements de credibilite...",
    kind: "textarea",
    rows: 6,
    aiActions: ["clarify", "shorten", "flag_vagueness", "variants_3"],
  },
  {
    id: PITCH_CLIENT_ISSUES_FIELD_ID,
    label: "Les enjeux reels de vos interlocuteurs",
    helper:
      "Attention : ne decrivez pas ici les enjeux directement lies a votre solution. Visez les enjeux de tres haut niveau, les plus percus et les plus pregnants chez vos futurs interlocuteurs. L'IA vous aidera ensuite a faire le lien.",
    placeholder:
      "Decrivez les attentes de haut niveau, les tensions, les priorites, les risques ou les blocages reellement ressentis par vos interlocuteurs...",
    kind: "textarea",
    rows: 6,
    aiActions: ["clarify", "shorten", "flag_vagueness", "variants_3"],
  },
  {
    id: PITCH_COMMERCIAL_FIELD_ID,
    label: "Pitch commercial 1 minute max",
    helper:
      "L'IA le redige a partir de vos forces et des enjeux de vos interlocuteurs. Structure attendue : enjeux clients, forces mobilisees, benefices obtenus.",
    placeholder:
      "Cliquez sur \"Generer le pitch\" pour produire une premiere version a partir des deux blocs ci-dessus.",
    kind: "textarea",
    rows: 8,
    aiActions: [
      "generate_pitch",
      "clarify",
      "shorten",
      "variants_3",
    ],
  },
];

export const PITCH_RAIL_BULLETS = [
  "Pars d'abord des enjeux de haut niveau percus par tes interlocuteurs, pas de ta solution.",
  "Expose ensuite les forces que tu mets au service de ces enjeux.",
  "Conclus par les benefices concrets que les clients en retirent.",
];
