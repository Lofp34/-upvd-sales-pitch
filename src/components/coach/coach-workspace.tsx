"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { WorkshopSessionRecord } from "@/lib/db/schema";
import { readResponsePayload } from "@/lib/http";

type CoachWorkspaceProps = {
  authenticated: boolean;
  databaseReady: boolean;
  recentSessions: WorkshopSessionRecord[];
};

export function CoachWorkspace({
  authenticated,
  databaseReady,
  recentSessions,
}: CoachWorkspaceProps) {
  const [accessCode, setAccessCode] = useState("");
  const [title, setTitle] = useState("Atelier pitch startup UPVD");
  const [deckUrl, setDeckUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdSession, setCreatedSession] = useState<{
    title: string;
    joinPath: string;
  } | null>(null);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/coach/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accessCode }),
      });

      const payload = await readResponsePayload<{ message?: string }>(response);

      if (!response.ok) {
        throw new Error(payload.message ?? "Connexion impossible.");
      }

      window.location.reload();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Connexion impossible.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/coach/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, deckUrl }),
      });

      const payload = await readResponsePayload<{
        message?: string;
        joinPath?: string;
        session?: { title?: string };
      }>(response);

      if (!response.ok) {
        throw new Error(payload.message ?? "Creation de session impossible.");
      }

      setCreatedSession({
        title: payload.session?.title ?? title,
        joinPath: payload.joinPath ?? "",
      });
      setMessage("Session creee. Tu peux maintenant partager le lien.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Creation de session impossible.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(path: string) {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setMessage("Lien copie.");
  }

  async function handleLogout() {
    await fetch("/api/coach/login", { method: "DELETE" });
    window.location.reload();
  }

  return (
    <main className="editorial-shell soft-grid">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 md:px-10 lg:px-12">
        <header className="editorial-card flex flex-col gap-4 px-6 py-8 md:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <Badge className="rounded-full bg-primary/10 text-primary">
                Mode formateur
              </Badge>
              <h1 className="editorial-title text-4xl text-primary md:text-5xl">
                Creer une session pitch en quelques clics.
              </h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground">
                L&apos;acces formateur sert a creer la session, generer le lien
                participant et lancer rapidement un atelier centre sur le pitch
                startup.
              </p>
            </div>
            {authenticated ? (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={handleLogout}
                type="button"
              >
                Fermer la session coach
              </Button>
            ) : null}
          </div>
        </header>

        {!databaseReady ? (
          <Card className="editorial-card rounded-[2rem] border-dashed border-accent/50 bg-accent/10">
            <CardHeader>
              <CardTitle className="editorial-title text-3xl text-primary">
                Base de données requise
              </CardTitle>
              <CardDescription className="text-base leading-7 text-muted-foreground">
                Configure une integration Postgres Vercel Marketplace ou une
                `DATABASE_URL`, puis recharge la page.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {databaseReady && !authenticated ? (
          <Card className="editorial-card rounded-[2rem]">
            <CardHeader>
              <CardTitle className="editorial-title text-3xl text-primary">
                Authentification coach
              </CardTitle>
              <CardDescription>
                Entre le `COACH_ACCESS_CODE` pour acceder a la creation de
                session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:max-w-md" onSubmit={handleLogin}>
                <div className="grid gap-2">
                  <Label htmlFor="coach-access-code">Code d&apos;accès</Label>
                  <Input
                    autoComplete="off"
                    id="coach-access-code"
                    onChange={(event) => setAccessCode(event.target.value)}
                    type="password"
                    value={accessCode}
                  />
                </div>
                <Button className="w-fit rounded-full" disabled={loading}>
                  {loading ? "Connexion..." : "Entrer dans l'espace coach"}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {databaseReady && authenticated ? (
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <Card className="editorial-card rounded-[2rem]">
              <CardHeader>
              <CardTitle className="editorial-title text-3xl text-primary">
                Creer une nouvelle session
              </CardTitle>
              <CardDescription>
                La session genere un lien participant du type `/s/[slug]`.
              </CardDescription>
            </CardHeader>
              <CardContent className="space-y-5">
                <form className="grid gap-5" onSubmit={handleCreateSession}>
                  <div className="grid gap-2">
                    <Label htmlFor="session-title">Titre de session</Label>
                    <Input
                      id="session-title"
                      onChange={(event) => setTitle(event.target.value)}
                      value={title}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="deck-url">URL du support (optionnel)</Label>
                    <Input
                      id="deck-url"
                      onChange={(event) => setDeckUrl(event.target.value)}
                      placeholder="https://..."
                      value={deckUrl}
                    />
                  </div>
                  <Button className="w-fit rounded-full" disabled={loading}>
                    {loading ? "Creation..." : "Creer la session"}
                  </Button>
                </form>

                {createdSession ? (
                  <>
                    <Separator />
                    <div className="grid gap-4 rounded-3xl bg-secondary/60 p-5">
                      <div className="space-y-1">
                        <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
                          Session creee
                        </p>
                        <h2 className="editorial-title text-2xl text-primary">
                          {createdSession.title}
                        </h2>
                      </div>
                      <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                        {`${typeof window === "undefined" ? "" : window.location.origin}${createdSession.joinPath}`}
                      </div>
                      <Button
                        className="w-fit rounded-full"
                        onClick={() => copyLink(createdSession.joinPath)}
                        type="button"
                      >
                        Copier le lien participant
                      </Button>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card className="editorial-card rounded-[2rem]">
              <CardHeader>
              <CardTitle className="editorial-title text-3xl text-primary">
                Sessions recentes
              </CardTitle>
              <CardDescription>
                Les dernieres sessions pitch creees depuis ce projet.
              </CardDescription>
            </CardHeader>
              <CardContent className="space-y-4">
                {recentSessions.length === 0 ? (
                  <p className="text-sm leading-7 text-muted-foreground">
                    Aucune session enregistree pour l&apos;instant.
                  </p>
                ) : (
                  recentSessions.map((session) => (
                    <div
                      className="rounded-3xl border border-border/80 bg-background/75 p-4"
                      key={session.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium text-primary">{session.title}</p>
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            /s/{session.slug}
                          </p>
                        </div>
                        <Button
                          className="rounded-full"
                          onClick={() => copyLink(`/s/${session.slug}`)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Copier le lien
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {message ? (
          <p className="text-sm text-primary">{message}</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </main>
  );
}
