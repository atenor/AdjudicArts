"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Criterion = {
  id: string;
  name: string;
  description: string | null;
  order: number;
};

type ExistingScore = {
  criteriaId: string;
  value: number;
  comment: string | null;
};

export default function ScoringForm({
  applicationId,
  criteria,
  existingScores,
  existingFinalComment,
}: {
  applicationId: string;
  criteria: Criterion[];
  existingScores: ExistingScore[];
  existingFinalComment?: string | null;
}) {
  const SCORE_OPTIONS = Array.from({ length: 11 }, (_, value) => value);
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finalComment, setFinalComment] = useState(existingFinalComment ?? "");

  const initialByCriterion = useMemo(
    () => new Map(existingScores.map((score) => [score.criteriaId, score])),
    [existingScores]
  );

  const [values, setValues] = useState<Record<string, string>>(
    () =>
      criteria.reduce<Record<string, string>>((acc, criterion) => {
        const existing = initialByCriterion.get(criterion.id);
        acc[criterion.id] = existing ? String(existing.value) : "";
        return acc;
      }, {})
  );

  const [comments, setComments] = useState<Record<string, string>>(
    () =>
      criteria.reduce<Record<string, string>>((acc, criterion) => {
        const existing = initialByCriterion.get(criterion.id);
        acc[criterion.id] = existing?.comment ?? "";
        return acc;
      }, {})
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    const scores = criteria.map((criterion) => {
      const numericValue = Number(values[criterion.id]);
      return {
        criteriaId: criterion.id,
        value: numericValue,
        comment: comments[criterion.id]?.trim() || null,
      };
    });

    if (
      scores.some(
        (score) =>
          Number.isNaN(score.value) || score.value < 0 || score.value > 10
      )
    ) {
      setServerError("Each criterion must be scored from 0 to 10.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/scoring/${applicationId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scores, finalComment }),
      });

      if (!response.ok) {
        setServerError("Unable to save scores. Please try again.");
        return;
      }

      router.push("/dashboard/scoring");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {criteria.map((criterion) => (
        <div key={criterion.id} className="rounded-lg border p-4 space-y-2">
          <div className="space-y-1">
            <p className="font-medium">
              {criterion.order}. {criterion.name}
            </p>
            {criterion.description && (
              <p className="text-sm text-muted-foreground">{criterion.description}</p>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1 md:col-span-1">
              <Label>Score (tap 0-10)</Label>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {SCORE_OPTIONS.map((score) => {
                  const selected = values[criterion.id] === String(score);
                  return (
                    <Button
                      key={`${criterion.id}-${score}`}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      className="h-8 min-w-8 px-2 text-xs shrink-0"
                      onClick={() =>
                        setValues((current) => ({
                          ...current,
                          [criterion.id]: String(score),
                        }))
                      }
                    >
                      {score}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor={`comment-${criterion.id}`}>Comment (optional)</Label>
              <Textarea
                id={`comment-${criterion.id}`}
                value={comments[criterion.id]}
                onChange={(e) =>
                  setComments((current) => ({
                    ...current,
                    [criterion.id]: e.target.value,
                  }))
                }
                rows={2}
              />
            </div>
          </div>
        </div>
      ))}

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <div className="rounded-lg border p-4 space-y-2">
        <Label htmlFor="final-comment">Final Comments</Label>
        <Textarea
          id="final-comment"
          rows={5}
          placeholder="Overall adjudication comments for this applicant..."
          value={finalComment}
          onChange={(event) => setFinalComment(event.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Scores"}
        </Button>
      </div>
    </form>
  );
}
