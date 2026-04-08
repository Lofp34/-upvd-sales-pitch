const DATABASE_URL_CANDIDATES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_DATABASE_URL",
  "NEON_DATABASE_URL",
] as const;

export function getDatabaseUrl() {
  for (const key of DATABASE_URL_CANDIDATES) {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }

  return null;
}

export function isDatabaseConfigured() {
  return Boolean(getDatabaseUrl());
}

export function assertDatabaseUrl() {
  const value = getDatabaseUrl();

  if (!value) {
    throw new Error(
      "Base de donnees non configuree. Definis DATABASE_URL ou une variable Postgres injectee par Vercel.",
    );
  }

  return value;
}

export function assertOpenAiApiKey() {
  const value = process.env.OPENAI_API_KEY;

  if (!value) {
    throw new Error(
      "OPENAI_API_KEY est manquante. Configure la variable d'environnement cote serveur.",
    );
  }

  return value;
}

export function assertCoachAccessCode() {
  const value = process.env.COACH_ACCESS_CODE;

  if (!value) {
    throw new Error(
      "COACH_ACCESS_CODE est manquant. Configure un code d'acces formateur dans les variables d'environnement.",
    );
  }

  return value;
}

export function assertSessionCookieSecret() {
  const value = process.env.SESSION_COOKIE_SECRET;

  if (!value) {
    throw new Error(
      "SESSION_COOKIE_SECRET est manquant. Configure une cle secrete longue cote serveur.",
    );
  }

  return value;
}
