import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isDatabaseConfigured } from "@/lib/env";

export default function HomePage() {
  const databaseReady = isDatabaseConfigured();

  return (
    <main className="editorial-shell soft-grid">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-6 py-8 md:px-10 lg:px-12">
        <header className="editorial-card flex flex-col gap-8 overflow-hidden px-6 py-8 md:px-10 md:py-12">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary">
              Compagnon d&apos;atelier
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full border-accent/40 bg-accent/10 px-3 py-1 text-accent-foreground"
            >
              UPVD 2026
            </Badge>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
            <div className="space-y-5">
              <p className="text-sm uppercase tracking-[0.22em] text-muted-foreground">
                Pitch startup • coaching vocal • atelier UPVD 2026
              </p>
              <h1 className="editorial-title max-w-4xl text-5xl leading-none text-primary sm:text-6xl">
                Une application concentree sur la redaction du pitch.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                Chaque participant entre dans sa session, travaille sa valeur
                ajoutee, redige son pitch 30 secondes et sa version 1 minute,
                puis peut dicter ses idees a la voix avant de les retravailler
                avec l&apos;IA.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-full px-6">
                  <Link href="/coach">Acces formateur</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="rounded-full px-6"
                >
                  <a
                    href="https://github.com/Lofp34/-upvd-sales-pitch"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Voir le depot GitHub
                  </a>
                </Button>
              </div>
            </div>

            <Card className="rounded-[2rem] border-border/70 bg-primary text-primary-foreground shadow-none">
              <CardHeader className="space-y-3">
                <CardTitle className="editorial-title text-3xl">
                  Ce que l&apos;app fait deja
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-primary-foreground/86">
                <p>Sessions coach avec lien participant.</p>
                <p>Studio pitch mono-ecran et autosauvegarde.</p>
                <p>Assistance GPT-5.4 sur chaque champ critique.</p>
                <p>Suggestions IA rendues en Markdown lisible.</p>
                <p>Dictee vocale OpenAI sur les champs de pitch.</p>
                <p className="pt-2 text-xs uppercase tracking-[0.18em] text-primary-foreground/60">
                  {databaseReady
                    ? "Base de donnees detectee"
                    : "Base de donnees a configurer avant usage live"}
                </p>
              </CardContent>
            </Card>
          </div>
        </header>
      </div>
    </main>
  );
}
