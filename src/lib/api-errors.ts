import { NextResponse } from "next/server";

type ErrorWithCode = {
  code?: string;
  message?: string;
  status?: number;
  type?: string;
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

function getErrorStatus(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const status = (error as ErrorWithCode).status;

  return typeof status === "number" ? status : undefined;
}

function getErrorType(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const type = (error as ErrorWithCode).type;

  return typeof type === "string" ? type : undefined;
}

export function toApiErrorResponse(
  error: unknown,
  fallbackMessage: string,
  consoleLabel: string,
) {
  console.error(consoleLabel, error);

  const code = getErrorCode(error);
  const message = getErrorMessage(error);
  const status = getErrorStatus(error);
  const type = getErrorType(error);
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

  if (
    code === "invalid_api_key" ||
    status === 401 ||
    type === "invalid_request_error" && lowerMessage.includes("incorrect api key")
  ) {
    return NextResponse.json(
      {
        message:
          "Cle OpenAI invalide ou expiree cote serveur. Remplace OPENAI_API_KEY dans Vercel puis redeploie.",
      },
      { status: 500 },
    );
  }

  if (status === 429 || lowerMessage.includes("rate limit")) {
    return NextResponse.json(
      {
        message:
          "Limite OpenAI atteinte temporairement. Attends un peu puis reessaie.",
      },
      { status: 429 },
    );
  }

  return NextResponse.json({ message: fallbackMessage }, { status: 500 });
}
