"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./scoring-form.module.css";

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

  const scoreSummary = useMemo(() => {
    const numericScores = criteria
      .map((criterion) => Number(values[criterion.id]))
      .filter((value) => !Number.isNaN(value));
    const total = numericScores.reduce((sum, value) => sum + value, 0);
    const filled = numericScores.length;
    const max = criteria.length * 10;
    const average = filled > 0 ? total / filled : 0;
    const normalizedTotal = max > 0 ? Math.round((total / max) * 100) : 0;

    return { total, filled, max, average, normalizedTotal };
  }, [criteria, values]);

  const aggregatedNotes = useMemo(
    () =>
      criteria
        .map((criterion) => ({
          criteriaId: criterion.id,
          criterionName: criterion.name,
          value: values[criterion.id] === "" ? null : Number(values[criterion.id]),
          comment: comments[criterion.id]?.trim() || "",
        }))
        .filter((item) => item.comment.length > 0),
    [comments, criteria, values]
  );

  const aggregatedPreview = useMemo(() => {
    const noteLines = aggregatedNotes.map(
      (item) => `${item.criterionName}: ${item.comment}`
    );
    const finalLine = finalComment.trim()
      ? `Final comments: ${finalComment.trim()}`
      : "";
    return [...noteLines, finalLine].filter(Boolean).join("\n");
  }, [aggregatedNotes, finalComment]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    const trimmedFinalComment = finalComment.trim();

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
    if (!trimmedFinalComment) {
      setServerError("Final comments are required before saving.");
      return;
    }

    let compiledFinalComment = trimmedFinalComment;

    setIsSubmitting(true);
    try {
      if (aggregatedNotes.length > 0) {
        try {
          const compileResponse = await fetch(`/api/scoring/${applicationId}/compile`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              notes: aggregatedNotes.map((item) => ({
                criteriaId: item.criteriaId,
                value: item.value,
                comment: item.comment,
              })),
              existingFinalComment: trimmedFinalComment,
            }),
          });

          if (compileResponse.ok) {
            const data = (await compileResponse.json()) as { compiledComment?: string };
            if (data.compiledComment?.trim()) {
              compiledFinalComment = data.compiledComment.trim();
            }
          }
        } catch {
          // If compile service fails, still allow score submission with judge-entered final comment.
        }
      }

      const response = await fetch(`/api/scoring/${applicationId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scores, finalComment: compiledFinalComment }),
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
    <form onSubmit={onSubmit} className={styles.form}>
      <div className={styles.summaryBand}>
        <div>
          <p className={styles.summaryLabel}>Running Total</p>
          <p className={styles.summaryValue}>
            Filled {scoreSummary.filled}/{criteria.length} · Avg {scoreSummary.average.toFixed(2)}
          </p>
        </div>
        <p className={styles.summaryTotal}>{scoreSummary.normalizedTotal}/100</p>
      </div>

      {criteria.map((criterion) => {
        const selectedValue = values[criterion.id] === "" ? null : Number(values[criterion.id]);

        return (
          <section key={criterion.id} className={styles.criterion}>
            <div>
              <p className={styles.criterionTitle}>
                <span className={styles.criterionName}>
                  {criterion.order}. {criterion.name}
                </span>
                {criterion.description ? (
                  <span className={styles.criterionInlineHelp}>
                    ({criterion.description})
                  </span>
                ) : null}
              </p>
            </div>

            <div className={styles.scoreGrid}>
              {SCORE_OPTIONS.map((score) => {
                const isSelected = selectedValue === score;
                const isFilled = selectedValue !== null && score <= selectedValue;
                return (
                  <button
                    key={`${criterion.id}-${score}`}
                    type="button"
                    className={`${styles.scoreChip} ${isFilled ? styles.scoreChipFilled : ""} ${
                      isSelected ? styles.scoreChipSelected : ""
                    }`}
                    onClick={() =>
                      setValues((current) => ({
                        ...current,
                        [criterion.id]: String(score),
                      }))
                    }
                  >
                    {score}
                  </button>
                );
              })}
            </div>

            <div className={styles.stack}>
              <input
                id={`comment-${criterion.id}`}
                className={styles.quickNote}
                value={comments[criterion.id]}
                onChange={(e) =>
                  setComments((current) => ({
                    ...current,
                    [criterion.id]: e.target.value,
                  }))
                }
                placeholder="Quick note"
                aria-label={`Quick note for ${criterion.name}`}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </section>
        );
      })}

      <section className={styles.finalWrap}>
        <p className={styles.label}>Final Comments</p>
        <textarea
          id="final-comment"
          className={styles.noteBox}
          rows={5}
          placeholder="Final comments (required)"
          value={finalComment}
          onChange={(event) => setFinalComment(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </section>

      <section className={styles.aggregateWrap}>
        <p className={styles.label}>Aggregated Rubric Notes</p>
        <textarea
          id="aggregated-rubric-notes"
          className={styles.noteBox}
          rows={5}
          readOnly
          value={aggregatedPreview}
          placeholder="Will aggregate rubric quick notes and final comments when you save."
        />
      </section>
      {serverError ? <p className={styles.error}>{serverError}</p> : null}

      <button className={styles.submit} type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save Scores"}
      </button>
    </form>
  );
}
