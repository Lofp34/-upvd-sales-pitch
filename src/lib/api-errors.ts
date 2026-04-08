import { NextResponse } from "next/server";

type ErrorWithCode = {
  code?: string;
  message?: string;
};

function getErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  return (error as ErrorWithCode).code;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const message = (error as ErrorWithCode).message;

    if (typeof message === "string") {
      return message;
    }
  }

  return "";
}

export function toApiErrorResponse(
  error: unknown,
  fallbackMessage: string,
  consoleLabel: string,
) {
  console.error(consoleLabel, error);

  const code = getErrorCode(error);
  const message = getErrorMessage(error);
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("database_url") ||
    lowerMessage.includes("base de donnees non configuree")
  ) {
    return NextResponse.json(
      {
        message:
          "Base de donnees non configuree. Ajoute DATABASE_URL ou branche l'integration Neon dans Vercel.",
      },
      { status: 500 },
    );
  }

  if (code === "42P01" || lowerMessage.includes("relation") && lowerMessage.includes("does not exist")) {
    return NextResponse.json(
      {
        message:
          "Base connectee mais schema non initialise. Lance `npm run db:push`, puis reessaie.",
      },
      { status: 500 },
    );
  }

  if (
    lowerMessage.includes("password authentication failed") ||
    lowerMessage.includes("connection") ||
    lowerMessage.includes("connect") ||
    code === "ECONNREFUSED"
  ) {
    return NextResponse.json(
      {
        message:
          "Connexion a la base impossible. Verifie les variables Vercel et la base Neon.",
      },
      { status: 500 },
    );
  }

  if (lowerMessage.includes("openai_api_key")) {
    return NextResponse.json(
      {
        message:
          "Cle OpenAI absente cote serveur. Ajoute OPENAI_API_KEY dans Vercel.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: fallbackMessage }, { status: 500 });
}
