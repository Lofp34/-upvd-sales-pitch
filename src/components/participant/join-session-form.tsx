"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

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
import { readResponsePayload } from "@/lib/http";
import {
  getPersonaLabel,
  PITCH_PERSONAS,
  type PitchPersona,
} from "@/lib/pitch/workflow";

type JoinSessionFormProps = {
  slug: string;
  sessionTitle: string;
};

export function JoinSessionForm({
  slug,
  sessionTitle,
}: JoinSessionFormProps) {
  const [name, setName] = useState("");
  const [startup, setStartup] = useState("");
  const [email, setEmail] = useState("");
  const [persona, setPersona] = useState<PitchPersona>("founder");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/session/${slug}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, startup, email, persona }),
      });

      const payload = await readResponsePayload<{
        message?: string;
        atelierPath?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.message ?? "Impossible de rejoindre la session.");
      }

      window.location.href = payload.atelierPath ?? "";
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Impossible de rejoindre la session.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="editorial-card rounded-[2rem]">
      <CardHeader className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
            Session atelier
          </p>
          <CardTitle className="editorial-title text-3xl text-primary">
            {sessionTitle}
          </CardTitle>
        </div>
        <CardDescription className="max-w-xl text-base leading-7">
          Identifie-toi avec ton prenom, ton projet et ton role dans
          l&apos;atelier. Ton espace pitch sera sauvegarde automatiquement et
          restera accessible avec ton lien personnel de reprise.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5 md:max-w-lg" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="participant-name">Prenom / nom</Label>
            <Input
              id="participant-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex. Lea Martin"
              value={name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="participant-startup">Startup</Label>
            <Input
              id="participant-startup"
              onChange={(event) => setStartup(event.target.value)}
              placeholder="Ex. NovaFlow"
              value={startup}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="participant-email">Email optionnel</Label>
            <Input
              id="participant-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Pour preparer l'envoi du lien de reprise"
              type="email"
              value={email}
            />
          </div>
          <div className="grid gap-2">
            <Label>Ton point de vue</Label>
            <div className="grid gap-2">
              {PITCH_PERSONAS.map((personaOption) => {
                const selected = persona === personaOption;

                return (
                  <button
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background/80 text-foreground hover:bg-muted"
                    }`}
                    key={personaOption}
                    onClick={() => setPersona(personaOption)}
                    type="button"
                  >
                    <span>{getPersonaLabel(personaOption)}</span>
                    {selected ? <CheckCircle2 className="size-4" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <Button className="w-fit rounded-full" disabled={loading}>
            {loading ? "Ouverture de l'atelier..." : "Entrer dans l'atelier"}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
