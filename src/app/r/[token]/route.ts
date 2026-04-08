import { NextResponse } from "next/server";

import {
  getParticipantCookieOptions,
  PARTICIPANT_COOKIE_NAME,
} from "@/lib/cookies";
import { getWorkbookWithSessionByRawToken } from "@/lib/db/queries";

type ResumeRouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(request: Request, context: ResumeRouteContext) {
  const { token } = await context.params;
  const access = await getWorkbookWithSessionByRawToken(token).catch(() => null);

  if (!access) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.redirect(
    new URL(`/s/${access.session.slug}/atelier`, request.url),
  );

  response.cookies.set(
    PARTICIPANT_COOKIE_NAME,
    token,
    getParticipantCookieOptions(),
  );

  return response;
}
