import { cookies } from "next/headers";

import { CoachWorkspace } from "@/components/coach/coach-workspace";
import { verifyCoachSessionToken, COACH_COOKIE_NAME } from "@/lib/cookies";
import { getRecentWorkshopSessions } from "@/lib/db/queries";
import { isDatabaseConfigured } from "@/lib/env";

export default async function CoachPage() {
  const cookieStore = await cookies();
  const authenticated = await verifyCoachSessionToken(
    cookieStore.get(COACH_COOKIE_NAME)?.value,
  );

  const recentSessions =
    authenticated && isDatabaseConfigured()
      ? await getRecentWorkshopSessions().catch(() => [])
      : [];

  return (
    <CoachWorkspace
      authenticated={authenticated}
      databaseReady={isDatabaseConfigured()}
      recentSessions={recentSessions}
    />
  );
}
