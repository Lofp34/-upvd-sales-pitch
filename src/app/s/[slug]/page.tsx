import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { JoinSessionForm } from "@/components/participant/join-session-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PARTICIPANT_COOKIE_NAME } from "@/lib/cookies";
import { getWorkbookWithSessionByRawToken, getWorkshopSessionBySlug } from "@/lib/db/queries";

type SessionJoinPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function SessionJoinPage({
  params,
}: SessionJoinPageProps) {
  const { slug } = await params;
  const session = await getWorkshopSessionBySlug(slug).catch(() => null);

  if (!session) {
    return (
      <main className="editorial-shell soft-grid">
        <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-10">
          <Card className="editorial-card w-full rounded-[2rem]">
            <CardHeader>
              <Badge className="w-fit rounded-full bg-destructive/10 text-destructive">
                Session introuvable
              </Badge>
              <CardTitle className="editorial-title text-4xl text-primary">
                Ce lien de session n&apos;est plus disponible.
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-muted-foreground">
              Demande au formateur de te renvoyer le bon lien participant.
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const cookieStore = await cookies();
  const resumeToken = cookieStore.get(PARTICIPANT_COOKIE_NAME)?.value;

  if (resumeToken) {
    const existingAccess = await getWorkbookWithSessionByRawToken(
      resumeToken,
      slug,
    ).catch(() => null);

    if (existingAccess) {
      redirect(`/s/${slug}/atelier`);
    }
  }

  return (
    <main className="editorial-shell soft-grid">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-8 px-6 py-10">
        <div className="space-y-3">
          <Badge className="rounded-full bg-primary/10 text-primary">
            Entree participant
          </Badge>
          <h1 className="editorial-title text-5xl text-primary">
            Entre dans l&apos;atelier et travaille ton pitch.
          </h1>
          <p className="max-w-2xl text-base leading-8 text-muted-foreground">
            L&apos;outil te permet de formuler ta valeur ajoutee, d&apos;ecrire
            ton pitch court, de preparer ta version orale et de saisir tes
            idees a la voix.
          </p>
        </div>

        <JoinSessionForm sessionTitle={session.title} slug={slug} />
      </div>
    </main>
  );
}
