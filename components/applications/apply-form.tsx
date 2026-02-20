"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const VOICE_PARTS = [
  { value: "soprano", label: "Soprano" },
  { value: "mezzo", label: "Mezzo-Soprano" },
  { value: "tenor", label: "Tenor" },
  { value: "baritone", label: "Baritone" },
  { value: "bass", label: "Bass" },
] as const;

const applySchema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Enter a valid email address"),
  voicePart: z.enum(["soprano", "mezzo", "tenor", "baritone", "bass"]),
  repertoire: z.string().min(1, "Please describe your repertoire"),
});

type ApplyFormValues = z.infer<typeof applySchema>;

export default function ApplyForm({ eventId }: { eventId: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ApplyFormValues>({
    resolver: zodResolver(applySchema),
  });

  async function onSubmit(data: ApplyFormValues) {
    setServerError(null);
    const res = await fetch(`/api/apply/${eventId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setSubmitted(true);
    } else {
      const body = await res.json().catch(() => ({}));
      setServerError(
        (body as { error?: string }).error ??
          "Something went wrong. Please try again."
      );
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-2">
          <p className="text-lg font-medium">Application submitted!</p>
          <p className="text-muted-foreground">
            Your application has been submitted. You will be contacted with next
            steps.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Application</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1">
            <Label htmlFor="name">Full Name *</Label>
            <Input id="name" autoComplete="name" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="voicePart">Voice Part *</Label>
            <select
              id="voicePart"
              {...register("voicePart")}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            >
              <option value="">Select voice part…</option>
              {VOICE_PARTS.map((vp) => (
                <option key={vp.value} value={vp.value}>
                  {vp.label}
                </option>
              ))}
            </select>
            {errors.voicePart && (
              <p className="text-xs text-destructive">
                {errors.voicePart.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="repertoire">Repertoire *</Label>
            <Textarea
              id="repertoire"
              rows={4}
              placeholder="Describe the pieces you plan to perform…"
              {...register("repertoire")}
            />
            {errors.repertoire && (
              <p className="text-xs text-destructive">
                {errors.repertoire.message}
              </p>
            )}
          </div>

          {serverError && (
            <p className="text-sm text-destructive">{serverError}</p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit Application"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
