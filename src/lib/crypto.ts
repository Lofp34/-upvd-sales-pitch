import crypto from "node:crypto";

export function createOpaqueToken(size = 24) {
  return crypto.randomBytes(size).toString("base64url");
}

export function hashOpaqueToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("base64url");
}

export function slugifySessionTitle(input: string) {
  const normalized = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return normalized || "atelier-vente";
}

export function generateSessionSlug(title: string) {
  return `${slugifySessionTitle(title)}-${crypto.randomBytes(2).toString("hex")}`;
}

export function safeEqual(input: string, expected: string) {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}
