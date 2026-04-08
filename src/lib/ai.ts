import OpenAI from "openai";

import { assertOpenAiApiKey } from "@/lib/env";
import type { AiAction } from "@/lib/workshop/types";

type AssistInput = {
  action: AiAction;
  stepId: string;
  sourceText: string;
  context?: Record<string, string | undefined>;
};

const ACTION_PROMPTS: Record<
  AiAction,
  { instruction: string; outputShape: string }
> = {
  generate_pitch: {
    instruction:
      "Redige un pitch commercial d'une minute maximum a partir des informations fournies. Structure imperative : d'abord les enjeux clients, ensuite les forces mobilisees, puis les benefices obtenus.",
    outputShape:
      "Retourne un seul pitch commercial en 3 paragraphes courts, sans titre ni puces, a la premiere personne du pluriel, directement reutilisable.",
  },
  clarify: {
    instruction:
      "Reformule pour rendre le texte plus clair, plus concret et plus professionnel, sans allonger inutilement.",
    outputShape: "Retourne un seul texte retravaille, directement reutilisable.",
  },
  shorten: {
    instruction:
      "Raccourcis le texte en conservant uniquement l'essentiel utile pour un entretien de vente.",
    outputShape: "Retourne un seul texte plus court, net et directement utilisable.",
  },
  variants_3: {
    instruction:
      "Propose trois variantes distinctes, credibles et naturelles, a partir du contenu fourni.",
    outputShape:
      "Retourne exactement 3 variantes numerotees, sans commentaire additionnel.",
  },
  flag_vagueness: {
    instruction:
      "Signale ce qui reste vague, flou, non prouve ou trop generique dans le texte.",
    outputShape:
      "Retourne deux parties courtes : 'Ce qui reste flou' puis 'Ce qu'il faut preciser'.",
  },
  oralize_30s: {
    instruction:
      "Transforme le texte en version orale naturelle qui tienne en environ 30 secondes.",
    outputShape:
      "Retourne un seul texte oral, fluide, simple a dire a voix haute, maximum 65 mots.",
  },
  oralize_60s: {
    instruction:
      "Transforme le texte en version orale naturelle qui tienne en environ 1 minute.",
    outputShape:
      "Retourne un seul texte oral, fluide, simple a dire a voix haute, maximum 120 mots.",
  },
};

const PITCH_REFERENCE_EXAMPLE = [
  "J'accompagne des PME qui ont de bons fondamentaux, mais pas de vrai systeme commercial.",
  "Resultat : des ventes en dents de scie, des tensions entre commerce et production, un pilotage complique, et parfois de l'insatisfaction client.",
  "",
  "Mon travail, c'est de transformer ce desordre en systeme commercial structure, pilotable et efficace.",
  "Je realise un audit approfondi avec les commerciaux et les personnes qui travaillent avec eux, je formalise les points forts de l'entreprise, je structure les axes de progres avec les bonnes techniques de vente et de management, et je mets en place des agents d'IA qui assistent concretement les commerciaux au quotidien.",
  "",
  "Le resultat, c'est un systeme commercial plus clair, plus maitrise, plus efficace, avec plus d'autonomie pour l'equipe et des resultats concrets : regulierement +25 a +30 %, et jusqu'a x10 chez Septeo.",
].join("\n");

function getClient() {
  return new OpenAI({
    apiKey: assertOpenAiApiKey(),
  });
}

export async function assistWithAi({
  action,
  stepId,
  sourceText,
  context = {},
}: AssistInput) {
  const configuration = ACTION_PROMPTS[action];
  const isPitchGeneration = action === "generate_pitch";
  const isPitchField = context.fieldLabel === "Pitch commercial 1 minute max";

  const contextBlock = Object.entries(context)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");

  const systemInstructions = isPitchGeneration
    ? [
        "Tu es un coach commercial et redacteur pour jeunes startupers francophones.",
        "Quand on te demande de generer un pitch, tu le rediges toi-meme a partir des blocs fournis.",
        "Interdictions absolues : inventer des faits, des chiffres, des clients, des promesses ou des preuves non presentes dans la source.",
        "Si une information manque, tu restes sobre et tu n'inventes rien.",
        "Ton style doit rester concret, credible, fluide, terrain et naturel a l'oral.",
        "Le pitch doit toujours suivre cette logique : enjeux clients d'abord, forces mobilisees ensuite, benefices clients a la fin.",
        "Le pitch doit tenir en une minute maximum.",
      ]
    : [
        "Tu es un coach de vente pour jeunes startupers francophones.",
        "Tu aides a clarifier, raccourcir ou oraliser un texte, mais tu ne fais jamais l'exercice a la place de l'apprenant.",
        "Interdictions absolues : inventer des faits, combler des blancs, ajouter des promesses non presentes, changer le sens du propos.",
        "Si l'information manque, tu le signales dans la reponse au lieu d'inventer.",
        "Ton style doit rester simple, concret, professionnel et naturel a l'oral.",
      ];

  if (isPitchField && !isPitchGeneration) {
    systemInstructions.push(
      "Si le texte travaille un pitch commercial, conserve la logique enjeux clients -> forces -> benefices.",
      "Reste dans un format fluide, directement prononcable, sans puces ni titre.",
    );
  }

  const response = await getClient().responses.create({
    model: "gpt-5.4",
    store: false,
    text: {
      format: {
        type: "text",
      },
    },
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: systemInstructions.join(" "),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Etape: ${stepId}`,
              contextBlock ? `Contexte:\n${contextBlock}` : "Contexte: aucun",
              `Instruction: ${configuration.instruction}`,
              `Format attendu: ${configuration.outputShape}`,
              isPitchGeneration
                ? `Exemple de ton et de structure a suivre:\n${PITCH_REFERENCE_EXAMPLE}`
                : null,
              "Texte source:",
              sourceText.trim(),
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
        ],
      },
    ],
  });

  const output = response.output_text.trim();

  if (!output) {
    throw new Error("L'assistant IA n'a retourne aucun texte.");
  }

  return output;
}
