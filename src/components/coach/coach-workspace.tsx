"use client";

import { LoaderCircle, SendHorizontal, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import type { WorkshopSessionRecord } from "@/lib/db/schema";
import { readResponsePayload } from "@/lib/http";
import {
  PITCH_CLIENT_ISSUES_FIELD_ID,
  PITCH_COMMERCIAL_FIELD_ID,
  PITCH_FIELDS,
  PITCH_STEP_ID,
  PITCH_STRENGTHS_FIELD_ID,
} from "@/lib/pitch/config";
import type { AnswersState } from "@/lib/workshop/types";

type LearnerProduction = {
  id: string;
  answersJson: AnswersState;
  currentStepId: string;
  lastActiveLabel: string;
  name: string;
  sessionSlug: string;
  sessionTitle: string;
  startup: string;
};

type CoachWorkspaceProps = {
  authenticated: boolean;
  databaseReady: boolean;
  learnerProductions: LearnerProduction[];
  recentSessions: WorkshopSessionRecord[];
};

function joinAnswerBlocks(...values: Array<string | undefined>) {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join("\n\n");
}

function getProductionFieldValue(
  production: LearnerProduction,
  fieldId: string,
) {
  const stepAnswers =
    production.answersJson[PITCH_STEP_ID] ??
    production.answersJson[production.currentStepId] ??
    {};

  if (fieldId === PITCH_STRENGTHS_FIELD_ID) {
    return (
      stepAnswers[PITCH_STRENGTHS_FIELD_ID] ??
      joinAnswerBlocks(stepAnswers.valueResponse, stepAnswers.valueMethod)
    );
  }

  if (fieldId === PITCH_COMMERCIAL_FIELD_ID) {
    return (
      stepAnswers[PITCH_COMMERCIAL_FIELD_ID] ??
      stepAnswers.pitch60 ??
      stepAnswers.pitch30 ??
      ""
    );
  }

  if (fieldId === PITCH_CLIENT_ISSUES_FIELD_ID) {
    return stepAnswers[PITCH_CLIENT_ISSUES_FIELD_ID] ?? "";
  }

  return stepAnswers[fieldId] ?? "";
}

function countFilledFields(production: LearnerProduction) {
  return PITCH_FIELDS.filter((field) =>
    getProductionFieldValue(production, field.id).trim(),
  ).length;
}

export function CoachWorkspace({
  authenticated,
  databaseReady,
  learnerProductions,
  recentSessions,
}: CoachWorkspaceProps) {
  const [accessCode, setAccessCode] = useState("");
  const [title, setTitle] = useState("Atelier pitch startup UPVD");
  const [deckUrl, setDeckUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [productions, setProductions] = useState(learnerProductions);
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [messageStatuses, setMessageStatuses] = useState<
    Record<string, string>
  >({});
  const [sendingMessageId, setSendingMessageId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingProductionId, setDeletingProductionId] = useState<
    string | null
  >(null);
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

  async function handleDeleteProduction(production: LearnerProduction) {
    setError("");
    setMessage("");

    if (pendingDeleteId !== production.id) {
      setPendingDeleteId(production.id);
      setMessage(
        `Confirme la suppression de la sauvegarde de ${production.name}.`,
      );
      return;
    }

    setDeletingProductionId(production.id);

    try {
      const response = await fetch(`/api/coach/workbooks/${production.id}`, {
        method: "DELETE",
      });
      const payload = await readResponsePayload<{ message?: string }>(response);

      if (!response.ok) {
        throw new Error(payload.message ?? "Suppression impossible.");
      }

      setProductions((currentProductions) =>
        currentProductions.filter((item) => item.id !== production.id),
      );
      setPendingDeleteId(null);
      setMessage(`Sauvegarde de ${production.name} supprimee.`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Suppression impossible.",
      );
    } finally {
      setDeletingProductionId(null);
    }
  }

  async function handleSendCoachMessage(production: LearnerProduction) {
    const body = messageDrafts[production.id]?.trim() ?? "";

    setError("");
    setMessage("");

    if (!body) {
      setMessageStatuses((currentStatuses) => ({
        ...currentStatuses,
        [production.id]: "Ecris un conseil avant de l'envoyer.",
      }));
      return;
    }

    setSendingMessageId(production.id);
    setMessageStatuses((currentStatuses) => ({
      ...currentStatuses,
      [production.id]: "",
    }));

    try {
      const response = await fetch(
        `/api/coach/workbooks/${production.id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ body }),
        },
      );
      const payload = await readResponsePayload<{ message?: string }>(response);

      if (!response.ok) {
        throw new Error(payload.message ?? "Message impossible a envoyer.");
      }

      setMessageDrafts((currentDrafts) => ({
        ...currentDrafts,
        [production.id]: "",
      }));
      setMessageStatuses((currentStatuses) => ({
        ...currentStatuses,
        [production.id]:
          "Message envoye. Il apparaitra dans quelques secondes.",
      }));
    } catch (caughtError) {
      setMessageStatuses((currentStatuses) => ({
        ...currentStatuses,
        [production.id]:
          caughtError instanceof Error
            ? caughtError.message
            : "Message impossible a envoyer.",
      }));
    } finally {
      setSendingMessageId(null);
    }
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
                participant et suivre les productions sauvegardees pendant
                l&apos;atelier pitch startup.
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

            <Card className="editorial-card rounded-[2rem] lg:col-span-2">
              <CardHeader>
                <CardTitle className="editorial-title text-3xl text-primary">
                  Productions des apprenants
                </CardTitle>
                <CardDescription>
                  Les dernieres sauvegardes affichees par apprenant, startup et
                  session.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {productions.length === 0 ? (
                  <p className="text-sm leading-7 text-muted-foreground">
                    Aucune production sauvegardee pour l&apos;instant.
                  </p>
                ) : (
                  productions.map((production) => {
                    const filledFields = countFilledFields(production);
                    const deletePending = pendingDeleteId === production.id;
                    const deleting = deletingProductionId === production.id;
                    const messageDraft = messageDrafts[production.id] ?? "";
                    const messageStatus = messageStatuses[production.id];
                    const sendingMessage = sendingMessageId === production.id;

                    return (
                      <article
                        className="rounded-3xl border border-border/80 bg-background/75 p-5"
                        key={production.id}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-medium text-primary">
                                {production.name}
                              </h3>
                              <Badge variant="outline">
                                {production.startup}
                              </Badge>
                            </div>
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              {production.sessionTitle} - /s/
                              {production.sessionSlug} - Derniere activite :{" "}
                              {production.lastActiveLabel}
                            </p>
                          </div>
                          <div className="flex flex-col items-start gap-2 sm:items-end">
                            <Badge className="rounded-full bg-primary/10 text-primary">
                              {filledFields}/{PITCH_FIELDS.length} blocs remplis
                            </Badge>
                            <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
                              <Button
                                className="rounded-full"
                                disabled={deleting}
                                onClick={() => handleDeleteProduction(production)}
                                size="sm"
                                type="button"
                                variant="destructive"
                              >
                                {deleting ? (
                                  <LoaderCircle className="size-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="size-3.5" />
                                )}
                                {deletePending ? "Confirmer" : "Supprimer"}
                              </Button>
                              {deletePending ? (
                                <Button
                                  className="rounded-full"
                                  disabled={deleting}
                                  onClick={() => {
                                    setPendingDeleteId(null);
                                    setMessage("");
                                  }}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  Annuler
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <form
                          className="mt-5 rounded-2xl border border-primary/10 bg-primary/5 p-4"
                          onSubmit={(event) => {
                            event.preventDefault();
                            handleSendCoachMessage(production);
                          }}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-primary/70">
                                Message instantane
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Le conseil apparait dans une bulle temporaire
                                sur l&apos;ecran participant.
                              </p>
                            </div>
                            <Button
                              className="rounded-full"
                              disabled={sendingMessage || !messageDraft.trim()}
                              size="sm"
                              type="submit"
                            >
                              {sendingMessage ? (
                                <LoaderCircle className="size-3.5 animate-spin" />
                              ) : (
                                <SendHorizontal className="size-3.5" />
                              )}
                              Envoyer
                            </Button>
                          </div>
                          <Textarea
                            className="mt-3 min-h-20 bg-background/90"
                            maxLength={500}
                            onChange={(event) =>
                              setMessageDrafts((currentDrafts) => ({
                                ...currentDrafts,
                                [production.id]: event.target.value,
                              }))
                            }
                            placeholder="Exemple : Commence par l'enjeu client avant de parler de ta solution."
                            rows={2}
                            value={messageDraft}
                          />
                          {messageStatus ? (
                            <p className="mt-2 text-sm text-primary">
                              {messageStatus}
                            </p>
                          ) : null}
                        </form>

                        <div className="mt-5 grid gap-3 lg:grid-cols-2">
                          {PITCH_FIELDS.map((field) => {
                            const value = getProductionFieldValue(
                              production,
                              field.id,
                            ).trim();
                            const isPitchField =
                              field.id === PITCH_COMMERCIAL_FIELD_ID;

                            return (
                              <section
                                className={`rounded-2xl border border-border/70 bg-card/70 p-4 ${
                                  isPitchField ? "lg:col-span-2" : ""
                                }`}
                                key={field.id}
                              >
                                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                  {field.label}
                                </p>
                                {value ? (
                                  <p className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                                    {value}
                                  </p>
                                ) : (
                                  <p className="mt-2 text-sm italic text-muted-foreground">
                                    Non renseigne.
                                  </p>
                                )}
                              </section>
                            );
                          })}
                        </div>
                      </article>
                    );
                  })
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
