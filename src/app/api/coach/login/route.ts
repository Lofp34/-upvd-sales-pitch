import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  COACH_COOKIE_NAME,
  createCoachSessionToken,
  getCoachCookieOptions,
} from "@/lib/cookies";
import { safeEqual } from "@/lib/crypto";
import { assertCoachAccessCode } from "@/lib/env";

const loginSchema = z.object({
  accessCode: z.string().min(1, "Code requis."),
});

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Code d'acces invalide." },
      { status: 400 },
    );
  }

  const expectedCode = assertCoachAccessCode();

  if (!safeEqual(parsed.data.accessCode.trim(), expectedCode.trim())) {
    return NextResponse.json({ message: "Code incorrect." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    COACH_COOKIE_NAME,
    await createCoachSessionToken(),
    getCoachCookieOptions(),
  );

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COACH_COOKIE_NAME, "", {
    ...getCoachCookieOptions(),
    maxAge: 0,
  });

  return response;
}
