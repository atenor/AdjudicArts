"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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

type PrizeSuggestion = {
  label: string;
  amountCents: number | null;
  comment: string | null;
};

type SubmissionEvent = {
  id: string;
  eventType: "FINALIZED" | "REOPENED";
  reason: string | null;
  createdAt: string | Date;
  actorRole: string;
  actor: {
    id: string;
    name: string | null;
    email: string;
  };
};

type SubmissionState = {
  status: "DRAFT" | "FINALIZED";
  finalizedAt: string | Date | null;
  events: SubmissionEvent[];
} | null;

type CertificationState = {
  certifiedAt: string | Date;
  certifiedBy: {
    id: string;
    name: string | null;
    email: string;
  };
} | null;

type SuggestionDraft = {
  label: string;
  amount: string;
  comment: string;
};

type ConfettiPiece = {
  burstX: number;
  burstY: number;
  driftX: number;
  swayX: number;
  fallY: number;
  size: number;
  spin: number;
  delay: number;
  duration: number;
  color: string;
};

const CONFETTI_COLORS = ["#5f2ec8", "#dbc36d", "#0d7b5f", "#d6f6e8", "#b18ae5"] as const;

function buildConfettiBurst(count = 84): ConfettiPiece[] {
  return Array.from({ length: count }).map((_, index) => ({
    burstX: -720 + Math.random() * 1440,
    burstY: -520 + Math.random() * 640,
    driftX: -420 + Math.random() * 840,
    swayX: 20 + Math.random() * 34,
    fallY: 88 + Math.random() * 18,
    size: 8 + Math.random() * 10,
    spin: -1800 + Math.random() * 3600,
    delay: Math.random() * 520,
    duration: 5200 + Math.random() * 1800,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  }));
}

function formatTimestamp(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-US");
}

function centsToDisplay(amountCents: number | null | undefined) {
  if (typeof amountCents !== "number") return "";
  return (amountCents / 100).toFixed(2);
}

function displayToCents(raw: string) {
  const normalized = raw.trim();
  if (!normalized) return null;
  const numeric = Number(normalized.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(numeric) || numeric < 0) return NaN;
  return Math.round(numeric * 100);
}

function parseScoreValue(raw: string) {
  const normalized = raw.trim();
  if (!normalized) return null;

  const numeric = Number(normalized);
  if (Number.isNaN(numeric)) return null;
  return numeric;
}

export default function ScoringForm({
  applicationId,
  applicantName,
  judgeName,
  canSuggestPrizes,
  previousApplicantHref,
  nextApplicantHref,
  criteria,
  existingScores,
  existingFinalComment,
  submission,
  certification,
  initialPrizeSuggestions,
}: {
  applicationId: string;
  applicantName: string;
  judgeName: string;
  canSuggestPrizes: boolean;
  previousApplicantHref: string | null;
  nextApplicantHref: string | null;
  criteria: Criterion[];
  existingScores: ExistingScore[];
  existingFinalComment?: string | null;
  submission: SubmissionState;
  certification: CertificationState;
  initialPrizeSuggestions: PrizeSuggestion[];
}) {
  const SCORE_OPTIONS = Array.from({ length: 11 }, (_, value) => value);
  const router = useRouter();
  const formRef = useRef<HTMLDivElement | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiBurst, setConfettiBurst] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);
  const [finalComment, setFinalComment] = useState(existingFinalComment ?? "");
  const [compiledFeedback, setCompiledFeedback] = useState("");

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

  const [prizeSuggestions, setPrizeSuggestions] = useState<SuggestionDraft[]>(
    () =>
      initialPrizeSuggestions.length > 0
        ? initialPrizeSuggestions.map((suggestion) => ({
            label: suggestion.label,
            amount: centsToDisplay(suggestion.amountCents),
            comment: suggestion.comment ?? "",
          }))
        : [{ label: "", amount: "", comment: "" }]
  );

  const isLocked = Boolean(certification);

  const scoreSummary = useMemo(() => {
    const numericScores = criteria
      .map((criterion) => parseScoreValue(values[criterion.id]))
      .filter((value): value is number => value !== null);
    const total = numericScores.reduce((sum, value) => sum + value, 0);
    const filled = numericScores.length;
    const max = criteria.length * 10;
    const average = filled > 0 ? total / filled : 0;
    const normalizedTotal = max > 0 ? Math.round((total / max) * 100) : 0;

    return { total, filled, max, average, normalizedTotal };
  }, [criteria, values]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("adjudicarts:score-summary", {
        detail: {
          filled: scoreSummary.filled,
          totalCriteria: criteria.length,
          average: Math.round(scoreSummary.average),
          normalizedTotal: scoreSummary.normalizedTotal,
        },
      })
    );
  }, [criteria.length, scoreSummary.average, scoreSummary.filled, scoreSummary.normalizedTotal]);

  // Measure the fixed video panel and NavHeader heights so the form starts
  // below them. The video panel is position:fixed on mobile — it floats
  // independently of the body scroll, so iOS cannot push it off-screen
  // when the keyboard opens (the panel contains no inputs).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 979px)").matches) return;
    const page = document.querySelector("[data-scoring-page]") as HTMLElement | null;
    const videoPanel = page?.querySelector("aside") as HTMLElement | null;
    const header = document.querySelector("header") as HTMLElement | null;
    if (!page || !videoPanel) return;

    function measure() {
      const headerH = header ? header.getBoundingClientRect().height : 44;
      page!.style.setProperty("--header-height", `${headerH}px`);
      // Wait a frame for the video panel to reflow with the header offset
      requestAnimationFrame(() => {
        const panelH = videoPanel!.getBoundingClientRect().height;
        page!.style.setProperty("--video-panel-height", `${headerH + panelH}px`);
      });
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

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

  function toSentence(text: string) {
    const trimmed = text.replace(/\s+/g, " ").trim();
    if (!trimmed) return "";
    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  }

  const fallbackAggregatedPreview = useMemo(() => {
    const opening = toSentence(
      "Thank you for sharing your performance. The following adjudication feedback reflects your rubric notes and final comments."
    );
    const rubricParagraph = aggregatedNotes
      .map((item) => {
        const scorePart =
          typeof item.value === "number" && !Number.isNaN(item.value)
            ? ` (${item.value}/10)`
            : "";
        return `${item.criterionName}${scorePart}: ${toSentence(item.comment)}`;
      })
      .join(" ");
    const closing = toSentence(finalComment.trim());

    return [
      `Dear ${applicantName},`,
      "",
      opening,
      rubricParagraph,
      closing,
      `Prepared by: ${judgeName}.`,
    ]
      .filter((line) => line.trim().length > 0)
      .join("\n\n");
  }, [aggregatedNotes, applicantName, finalComment, judgeName]);

  useEffect(() => {
    let cancelled = false;

    async function compilePreview() {
      if (aggregatedNotes.length === 0 || !finalComment.trim()) {
        setCompiledFeedback("");
        return;
      }

      try {
        const response = await fetch(`/api/scoring/${applicationId}/compile`, {
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
            existingFinalComment: finalComment.trim(),
          }),
        });

        if (!response.ok) return;
        const data = (await response.json()) as { compiledComment?: string };
        if (!cancelled) {
          setCompiledFeedback(data.compiledComment?.trim() ?? "");
        }
      } catch {
        if (!cancelled) {
          setCompiledFeedback("");
        }
      }
    }

    compilePreview();
    return () => {
      cancelled = true;
    };
  }, [aggregatedNotes, applicationId, finalComment]);

  function updateSuggestion(index: number, patch: Partial<SuggestionDraft>) {
    setPrizeSuggestions((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    );
  }

  function addSuggestionRow() {
    setPrizeSuggestions((current) => [...current, { label: "", amount: "", comment: "" }]);
  }

  function removeSuggestionRow(index: number) {
    setPrizeSuggestions((current) =>
      current.length === 1
        ? [{ label: "", amount: "", comment: "" }]
        : current.filter((_, rowIndex) => rowIndex !== index)
    );
  }

  function buildPayload(requireSuggestions: boolean) {
    const trimmedFinalComment = finalComment.trim();

    const scores = criteria.map((criterion) => {
      const numericValue = parseScoreValue(values[criterion.id]);
      return {
        criteriaId: criterion.id,
        value: numericValue,
        comment: comments[criterion.id]?.trim() || null,
      };
    });

    if (scores.some((score) => score.value === null)) {
      return { error: "Complete every rubric score before saving this submission." };
    }

    if (
      scores.some(
        (score) =>
          score.value === null || Number.isNaN(score.value) || score.value < 0 || score.value > 10
      )
    ) {
      return { error: "Each criterion must be scored from 0 to 10." };
    }
    if (!trimmedFinalComment) {
      return { error: "Final comments are required before saving." };
    }

    const normalizedSuggestions: Array<{
      label: string;
      amountCents: number | null;
      comment: string | null;
    }> = [];
    for (const suggestion of prizeSuggestions) {
      const label = suggestion.label.trim();
      const comment = suggestion.comment.trim();
      const hasAnyValue =
        label.length > 0 || suggestion.amount.trim().length > 0 || comment.length > 0;
      if (!hasAnyValue) continue;

      const amountCents = displayToCents(suggestion.amount);
      if (Number.isNaN(amountCents)) {
        return { error: "Prize suggestion amounts must be valid non-negative dollar amounts." };
      }

      if (!label) {
        return { error: "Each prize suggestion must include a prize label." };
      }

      normalizedSuggestions.push({
        label,
        amountCents,
        comment: comment || null,
      });
    }

    if (canSuggestPrizes && requireSuggestions && normalizedSuggestions.length === 0) {
      return { error: "At least one prize suggestion is required before finalizing." };
    }

    return {
      scores: scores.map((score) => ({
        criteriaId: score.criteriaId,
        value: score.value as number,
        comment: score.comment,
      })),
      finalComment: trimmedFinalComment,
      prizeSuggestions: canSuggestPrizes ? normalizedSuggestions : [],
    };
  }

  async function onSaveDraft() {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Are you sure you want to submit scores?\n\nYou can come back and edit anytime until you finalize and submit your final scores in the Adjudication List."
      );
      if (!confirmed) return;
    }

    setServerError(null);
    setSuccessMessage(null);

    const payload = buildPayload(false);
    if ("error" in payload) {
      setServerError(payload.error ?? "Unable to save the draft.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/scoring/${applicationId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setServerError(data?.error ?? "Unable to save the draft. Please try again.");
        return;
      }

      setSuccessMessage("Scores saved. You can keep editing until the round is certified.");
      setShowConfetti(true);
      setConfettiPieces(buildConfettiBurst());
      setConfettiBurst(false);
      if (typeof window !== "undefined") {
        window.setTimeout(() => setConfettiBurst(true), 10);
        window.setTimeout(() => setShowConfetti(false), 6400);
      }
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  function isInputLike(node: EventTarget | null) {
    return node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement;
  }

  function broadcastScoringInputFocus(active: boolean) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("adjudicarts:scoring-input-focus", {
        detail: { active },
      })
    );
  }

  function handleFormFocusCapture(event: React.FocusEvent<HTMLDivElement>) {
    if (!isInputLike(event.target)) return;
    broadcastScoringInputFocus(true);
  }

  function handleFormBlurCapture() {
    if (typeof window === "undefined") return;
    window.setTimeout(() => {
      const activeElement = document.activeElement;
      const insideForm = Boolean(
        formRef.current &&
          activeElement instanceof HTMLElement &&
          formRef.current.contains(activeElement)
      );
      const stillInput = isInputLike(activeElement);
      if (insideForm && stillInput) {
        broadcastScoringInputFocus(true);
        return;
      }

      const viewport = window.visualViewport;
      const keyboardLikelyOpen = Boolean(
        viewport && viewport.height < window.innerHeight * 0.86
      );
      if (!keyboardLikelyOpen) {
        broadcastScoringInputFocus(false);
      }
    }, 80);
  }

  function handleScoringFieldFocus() {
    broadcastScoringInputFocus(true);
  }

  function handleScoringFieldBlur() {
    handleFormBlurCapture();
  }

  return (
    <div
      ref={formRef}
      className={styles.form}
      data-scoring-form="true"
      onFocusCapture={handleFormFocusCapture}
      onBlurCapture={handleFormBlurCapture}
    >
      <h2 className={styles.scorecardTitle}>Scorecard</h2>
      {certification ? (
        <section className={`${styles.banner} ${styles.bannerSuccess}`}>
          <p className={styles.bannerTitle}>Certified Round Lock</p>
          <p className={styles.bannerText}>
            This round was certified and all scoring, feedback, and prize decisions are locked.
          </p>
          <p className={styles.bannerMeta}>
            Certified {formatTimestamp(certification.certifiedAt)} by{" "}
            {certification.certifiedBy.name ?? certification.certifiedBy.email}
          </p>
        </section>
      ) : null}

      {submission?.events.length ? (
        <section className={`${styles.banner} ${styles.bannerNeutral}`}>
          <p className={styles.bannerTitle}>Submission History</p>
          <ol className={styles.eventList}>
            {submission.events.map((event) => (
              <li key={event.id}>
                {event.eventType === "FINALIZED" ? "Marked complete" : "Reopened"} by{" "}
                {event.actor.name ?? event.actor.email} ({event.actorRole}) on{" "}
                {formatTimestamp(event.createdAt)}
                {event.reason ? ` - ${event.reason}` : ""}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

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
                    disabled={isLocked}
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
                disabled={isLocked}
                onChange={(e) =>
                  setComments((current) => ({
                    ...current,
                    [criterion.id]: e.target.value,
                  }))
                }
                placeholder="Quick note (optional)"
                aria-label={`Quick note for ${criterion.name}`}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onFocus={handleScoringFieldFocus}
                onBlur={handleScoringFieldBlur}
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
          disabled={isLocked}
          onChange={(event) => setFinalComment(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onFocus={handleScoringFieldFocus}
          onBlur={handleScoringFieldBlur}
        />
      </section>

      {canSuggestPrizes ? (
        <section className={styles.prizeWrap}>
        <p className={styles.label}>Prize Suggestions</p>
        <p className={styles.helperText}>
          Prize suggestions are recommendations only. Final prize decisions are made separately by
          the chair.
        </p>

        {prizeSuggestions.map((suggestion, index) => (
          <div key={`prize-suggestion-${index}`} className={styles.prizeRow}>
            <div className={styles.prizeTopRow}>
              <input
                className={styles.smallInput}
                placeholder="Prize suggestion label"
                value={suggestion.label}
                disabled={isLocked}
                onChange={(event) => updateSuggestion(index, { label: event.target.value })}
                onFocus={handleScoringFieldFocus}
                onBlur={handleScoringFieldBlur}
              />
              <input
                className={styles.smallInput}
                placeholder="Amount (optional)"
                inputMode="decimal"
                value={suggestion.amount}
                disabled={isLocked}
                onChange={(event) => updateSuggestion(index, { amount: event.target.value })}
                onFocus={handleScoringFieldFocus}
                onBlur={handleScoringFieldBlur}
              />
            </div>
            <textarea
              className={styles.noteBox}
              rows={2}
              placeholder="Reason for this recommendation (optional)"
              value={suggestion.comment}
              disabled={isLocked}
              onChange={(event) => updateSuggestion(index, { comment: event.target.value })}
              onFocus={handleScoringFieldFocus}
              onBlur={handleScoringFieldBlur}
            />
            {!isLocked ? (
              <div className={styles.inlineActions}>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonSecondary}`}
                  onClick={() => removeSuggestionRow(index)}
                >
                  Remove suggestion
                </button>
              </div>
            ) : null}
          </div>
        ))}

        {!isLocked ? (
          <div className={styles.inlineActions}>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={addSuggestionRow}
            >
              Add suggestion
            </button>
          </div>
        ) : null}
        </section>
      ) : null}

      <details className={styles.aggregateDisclosure}>
        <summary className={styles.aggregateSummary}>
          Applicant Feedback Preview
        </summary>
        <section className={styles.aggregateWrap}>
          <div className={styles.aggregateHeader}>
            <p className={styles.label}>Aggregated Applicant Feedback</p>
            <span className={styles.aggregateBadge}>No Judge Action Needed</span>
          </div>
          <p className={styles.aggregateHelper}>
            Auto-generated from your rubric notes and final comments.
          </p>
          <textarea
            id="aggregated-rubric-notes"
            className={`${styles.noteBox} ${styles.aggregatePreview}`}
            rows={5}
            readOnly
            value={compiledFeedback || fallbackAggregatedPreview}
            placeholder="On save, this will be compiled into a polished applicant-facing feedback message."
          />
        </section>
      </details>

      {serverError ? <p className={styles.error}>{serverError}</p> : null}
      {successMessage ? <p className={styles.success}>{successMessage}</p> : null}

      {!isLocked ? (
        <>
          <div className={styles.actionRow}>
            <div className={styles.actionSlotLeft}>
              {previousApplicantHref ? (
                <Link
                  href={previousApplicantHref}
                  className={`${styles.button} ${styles.buttonSecondary} ${styles.navAction}`}
                >
                  <span className={styles.navActionLabel}>Previous Singer</span>
                  <span className={styles.navActionArrow}>←</span>
                </Link>
              ) : null}
            </div>
            <div className={styles.actionSlotCenter}>
              <button
                className={`${styles.button} ${styles.buttonPrimary} ${styles.saveAction}`}
                type="button"
                disabled={isSubmitting}
                onClick={onSaveDraft}
              >
                {isSubmitting ? "Saving..." : "Save Scores"}
              </button>
            </div>
            <div className={styles.actionSlotRight}>
              {nextApplicantHref ? (
                <Link
                  href={nextApplicantHref}
                  className={`${styles.button} ${styles.buttonSecondary} ${styles.navAction}`}
                >
                  <span className={styles.navActionLabel}>Next Singer</span>
                  <span className={styles.navActionArrow}>→</span>
                </Link>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {showConfetti ? (
        <div className="pointer-events-none fixed inset-0 z-[120] overflow-hidden">
          {confettiPieces.map((piece, index) => (
            <span
              key={`${piece.burstX}-${piece.burstY}-${index}`}
              className="absolute left-1/2 top-[14vh] rounded-sm opacity-0"
              style={{
                width: `${piece.size}px`,
                height: `${Math.max(3, piece.size * 0.55)}px`,
                backgroundColor: piece.color,
                opacity: 0.88,
                animationName: confettiBurst ? "score-save-confetti-pop-fall" : undefined,
                animationDuration: `${piece.duration}ms`,
                animationTimingFunction: "linear",
                animationFillMode: "forwards",
                animationDelay: `${piece.delay}ms`,
                ["--burst-x" as string]: `${piece.burstX}px`,
                ["--burst-y" as string]: `${piece.burstY}px`,
                ["--drift-x" as string]: `${piece.driftX}px`,
                ["--sway-x" as string]: `${piece.swayX}px`,
                ["--fall-y" as string]: `${piece.fallY}vh`,
                ["--spin" as string]: `${piece.spin}deg`,
              }}
            />
          ))}
          <style>{`
            @keyframes score-save-confetti-pop-fall {
              0% {
                opacity: 0;
                transform: translate(-50%, 0) rotate(0deg);
              }
              6% {
                opacity: 0.92;
              }
              12% {
                transform: translate(
                  calc(-50% + var(--burst-x)),
                  var(--burst-y)
                ) rotate(calc(var(--spin) * 0.35));
              }
              97% {
                opacity: 0.9;
              }
              100% {
                opacity: 0;
                transform: translate(
                  calc(-50% + var(--burst-x) + var(--drift-x) + var(--sway-x)),
                  calc(var(--burst-y) + var(--fall-y))
                ) rotate(var(--spin));
              }
            }
          `}</style>
        </div>
      ) : null}
    </div>
  );
}
