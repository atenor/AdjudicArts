"use client";

import { useState } from "react";
import Link from "next/link";
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
  videoUrl1: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  videoUrl2: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  videoUrl3: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  headshotUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  citizenshipDocumentUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  resourceUrl1: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  resourceUrl2: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

type ApplyFormValues = z.infer<typeof applySchema>;

export default function ApplyForm({ eventId }: { eventId: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
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
      const body = await res.json().catch(() => ({}));
      setApplicationId((body as { applicationId?: string }).applicationId ?? null);
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
        <CardContent className="pt-6 text-center space-y-3">
          <p className="text-lg font-medium">Application submitted!</p>
          <p className="text-muted-foreground">
            Your application has been submitted. You&apos;ll hear from us with
            updates as your application is reviewed.
          </p>
          {applicationId && (
            <Link
              href={`/status/${applicationId}`}
              className="inline-block text-sm text-primary underline underline-offset-4"
            >
              Check your application status
            </Link>
          )}
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

          <div className="space-y-1">
            <Label htmlFor="videoUrl1">YouTube Video 1</Label>
            <Input
              id="videoUrl1"
              placeholder="https://www.youtube.com/watch?v=..."
              {...register("videoUrl1")}
            />
            {errors.videoUrl1 && (
              <p className="text-xs text-destructive">{errors.videoUrl1.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="videoUrl2">YouTube Video 2</Label>
            <Input
              id="videoUrl2"
              placeholder="https://www.youtube.com/watch?v=..."
              {...register("videoUrl2")}
            />
            {errors.videoUrl2 && (
              <p className="text-xs text-destructive">{errors.videoUrl2.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="videoUrl3">YouTube Video 3</Label>
            <Input
              id="videoUrl3"
              placeholder="https://www.youtube.com/watch?v=..."
              {...register("videoUrl3")}
            />
            {errors.videoUrl3 && (
              <p className="text-xs text-destructive">{errors.videoUrl3.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="headshotUrl">Headshot URL</Label>
            <Input
              id="headshotUrl"
              placeholder="https://... (image link)"
              {...register("headshotUrl")}
            />
            {errors.headshotUrl && (
              <p className="text-xs text-destructive">{errors.headshotUrl.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="citizenshipDocumentUrl">Citizenship Document URL</Label>
            <Input
              id="citizenshipDocumentUrl"
              placeholder="https://... (passport/birth certificate)"
              {...register("citizenshipDocumentUrl")}
            />
            {errors.citizenshipDocumentUrl && (
              <p className="text-xs text-destructive">{errors.citizenshipDocumentUrl.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="resourceUrl1">Additional Resource URL 1</Label>
            <Input
              id="resourceUrl1"
              placeholder="https://..."
              {...register("resourceUrl1")}
            />
            {errors.resourceUrl1 && (
              <p className="text-xs text-destructive">{errors.resourceUrl1.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="resourceUrl2">Additional Resource URL 2</Label>
            <Input
              id="resourceUrl2"
              placeholder="https://..."
              {...register("resourceUrl2")}
            />
            {errors.resourceUrl2 && (
              <p className="text-xs text-destructive">{errors.resourceUrl2.message}</p>
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
