"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
}: {
  applicationId: string;
  criteria: Criterion[];
  existingScores: ExistingScore[];
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        body: JSON.stringify({ scores }),
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
              <Label htmlFor={`score-${criterion.id}`}>Score (0-10)</Label>
              <Input
                id={`score-${criterion.id}`}
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={values[criterion.id]}
                onChange={(e) =>
                  setValues((current) => ({
                    ...current,
                    [criterion.id]: e.target.value,
                  }))
                }
                required
              />
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
                rows={3}
              />
            </div>
          </div>
        </div>
      ))}

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Scores"}
        </Button>
      </div>
    </form>
  );
}
