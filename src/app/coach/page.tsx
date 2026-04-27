import { cookies } from "next/headers";

import { CoachWorkspace } from "@/components/coach/coach-workspace";
import { verifyCoachSessionToken, COACH_COOKIE_NAME } from "@/lib/cookies";
import {
  getRecentWorkbookProductions,
  getRecentWorkshopSessions,
} from "@/lib/db/queries";
import { isDatabaseConfigured } from "@/lib/env";

const coachDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

export default async function CoachPage() {
  const cookieStore = await cookies();
  const authenticated = await verifyCoachSessionToken(
    cookieStore.get(COACH_COOKIE_NAME)?.value,
  );

  const recentSessions =
    authenticated && isDatabaseConfigured()
      ? await getRecentWorkshopSessions().catch(() => [])
      : [];
  const recentProductions =
    authenticated && isDatabaseConfigured()
      ? await getRecentWorkbookProductions().catch(() => [])
      : [];

  return (
    <CoachWorkspace
      authenticated={authenticated}
      databaseReady={isDatabaseConfigured()}
      learnerProductions={recentProductions.map(({ session, workbook }) => ({
        id: workbook.id,
        answersJson: workbook.answersJson,
        currentStepId: workbook.currentStepId,
        lastActiveLabel: coachDateFormatter.format(workbook.lastActiveAt),
        name: workbook.name,
        sessionSlug: session.slug,
        sessionTitle: session.title,
        startup: workbook.startup,
      }))}
      recentSessions={recentSessions}
    />
  );
}
