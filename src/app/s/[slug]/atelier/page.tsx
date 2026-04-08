import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PitchEditor } from "@/components/pitch/pitch-editor";
import { PARTICIPANT_COOKIE_NAME } from "@/lib/cookies";
import { getWorkbookWithSessionByRawToken } from "@/lib/db/queries";

type WorkshopPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function WorkshopPage({ params }: WorkshopPageProps) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(PARTICIPANT_COOKIE_NAME)?.value;

  if (!rawToken) {
    redirect(`/s/${slug}`);
  }

  const access = await getWorkbookWithSessionByRawToken(rawToken, slug).catch(
    () => null,
  );

  if (!access) {
    redirect(`/s/${slug}`);
  }

  return (
    <PitchEditor
      resumePath={`/r/${rawToken}`}
      session={{
        id: access.session.id,
        slug: access.session.slug,
        title: access.session.title,
        deckUrl: access.session.deckUrl,
      }}
      workbook={{
        id: access.workbook.id,
        name: access.workbook.name,
        startup: access.workbook.startup,
        currentStepId: access.workbook.currentStepId,
        answersJson: access.workbook.answersJson,
        finalOutputJson: access.workbook.finalOutputJson,
      }}
    />
  );
}
