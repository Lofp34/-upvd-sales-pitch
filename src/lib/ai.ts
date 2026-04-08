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

  const contextBlock = Object.entries(context)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");

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
            text: [
              "Tu es un coach de vente pour jeunes startupers francophones.",
              "Tu aides a clarifier, raccourcir ou oraliser un texte, mais tu ne fais jamais l'exercice a la place de l'apprenant.",
              "Interdictions absolues : inventer des faits, combler des blancs, ajouter des promesses non presentes, changer le sens du propos.",
              "Si l'information manque, tu le signales dans la reponse au lieu d'inventer.",
              "Ton style doit rester simple, concret, professionnel et naturel a l'oral.",
            ].join(" "),
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
              "Texte source:",
              sourceText.trim(),
            ].join("\n\n"),
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
