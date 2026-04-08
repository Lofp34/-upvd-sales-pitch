import { jwtVerify, SignJWT } from "jose";

import { assertSessionCookieSecret } from "@/lib/env";

export const COACH_COOKIE_NAME = "upvd_coach_session";
export const PARTICIPANT_COOKIE_NAME = "upvd_resume_token";

const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 7;

function getCookieSecret() {
  return new TextEncoder().encode(assertSessionCookieSecret());
}

export function getSecureCookieFlag() {
  return process.env.NODE_ENV === "production";
}

export function getCoachCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: getSecureCookieFlag(),
    path: "/",
    maxAge: COOKIE_TTL_SECONDS,
  };
}

export function getParticipantCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: getSecureCookieFlag(),
    path: "/",
    maxAge: COOKIE_TTL_SECONDS,
  };
}

export async function createCoachSessionToken() {
  return new SignJWT({ role: "coach" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getCookieSecret());
}

export async function verifyCoachSessionToken(token?: string | null) {
  if (!token) {
    return false;
  }

  try {
    const verified = await jwtVerify(token, getCookieSecret());

    return verified.payload.role === "coach";
  } catch {
    return false;
  }
}
