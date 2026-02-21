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

    return { total, filled, max, average };
  }, [criteria, values]);

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
    <form onSubmit={onSubmit} className={styles.form}>
      <div className={styles.summaryBand}>
        <div>
          <p className={styles.summaryLabel}>Running Total</p>
          <p className={styles.summaryValue}>
            Filled {scoreSummary.filled}/{criteria.length} · Avg {scoreSummary.average.toFixed(2)}
          </p>
        </div>
        <p className={styles.summaryTotal}>{scoreSummary.total.toFixed(1)}</p>
      </div>

      {criteria.map((criterion) => {
        const selectedValue = values[criterion.id] === "" ? null : Number(values[criterion.id]);

        return (
          <section key={criterion.id} className={styles.criterion}>
            <div>
              <p className={styles.criterionTitle}>
                {criterion.order}. {criterion.name}
              </p>
              {criterion.description ? (
                <p className={styles.criterionDescription}>{criterion.description}</p>
              ) : null}
            </div>

            <div className={styles.stack}>
              <p className={styles.label}>Score (tap 0-10)</p>
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
            </div>

            <div className={styles.stack}>
              <p className={styles.label}>Comment (optional)</p>
              <textarea
                id={`comment-${criterion.id}`}
                className={styles.comment}
                value={comments[criterion.id]}
                onChange={(e) =>
                  setComments((current) => ({
                    ...current,
                    [criterion.id]: e.target.value,
                  }))
                }
                rows={3}
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
          className={styles.comment}
          rows={5}
          placeholder="Overall adjudication comments for this applicant..."
          value={finalComment}
          onChange={(event) => setFinalComment(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </section>

      {serverError ? <p className={styles.error}>{serverError}</p> : null}

      <button className={styles.submit} type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save Scores"}
      </button>
    </form>
  );
}
