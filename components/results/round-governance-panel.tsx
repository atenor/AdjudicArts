"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Readiness = {
  assignedJudgeCount: number;
  requiredFinalizations: number;
  finalizedCount: number;
  missingCount: number;
};

type Certification = {
  certifiedAt: string | Date;
  certifiedByName: string;
} | null;

type ResultRosterEntry = {
  applicationId: string;
  applicantName: string;
};

type RankedResultEntry = {
  applicationId: string;
  applicantName: string;
  rank: number;
  tied: boolean;
  status: string;
  totalScore: number;
};

type JudgeSuggestion = {
  applicationId: string;
  applicantName: string;
  judgeName: string;
  label: string;
  amountCents: number | null;
  comment: string | null;
};

type ChairAllocation = {
  applicationId: string;
  applicantName: string;
  label: string;
  amountCents: number | null;
  internalNote: string | null;
  createdByName: string;
  createdAt: string | Date;
};

type AudienceEntry = {
  applicationId: string;
  applicantName: string;
  baselineViews: number;
  endViews: number;
  delta: number;
  rank: number | null;
  dispositionStatus: "ELIGIBLE" | "FLAGGED" | "DISQUALIFIED";
  dispositionNote: string | null;
  dispositionActorName: string | null;
  dispositionActedAt: string | Date | null;
};

type AllocationDraft = {
  applicationId: string;
  label: string;
  amount: string;
};

function formatTimestamp(value: string | Date | null | undefined) {
  if (!value) return "--";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
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

export default function RoundGovernancePanel({
  eventId,
  roundId,
  roundType,
  advancementSlots,
  chapterName,
  canCertify,
  canManageGovernance,
  readiness,
  certification,
  roster,
  rankedResults,
  judgeSuggestions,
  initialAllocations,
  initialAudienceEntries,
}: {
  eventId: string;
  roundId: string;
  roundType: string;
  advancementSlots: number | null;
  chapterName: string | null;
  canCertify: boolean;
  canManageGovernance: boolean;
  readiness: Readiness;
  certification: Certification;
  roster: ResultRosterEntry[];
  rankedResults: RankedResultEntry[];
  judgeSuggestions: JudgeSuggestion[];
  initialAllocations: ChairAllocation[];
  initialAudienceEntries: AudienceEntry[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCertifying, setIsCertifying] = useState(false);
  const [isSavingAllocations, setIsSavingAllocations] = useState(false);
  const [isSavingBaseline, setIsSavingBaseline] = useState(false);
  const [isSavingEnd, setIsSavingEnd] = useState(false);
  const [savingDispositionId, setSavingDispositionId] = useState<string | null>(null);
  const [isClosingOutChapter, setIsClosingOutChapter] = useState(false);
  const [winnerIds, setWinnerIds] = useState<string[]>(() =>
    rankedResults
      .filter((result) =>
        result.status === "PENDING_NATIONAL_ACCEPTANCE" ||
        result.status === "CHAPTER_APPROVED"
      )
      .map((result) => result.applicationId)
      .slice(0, advancementSlots ?? undefined)
  );
  const [alternateId, setAlternateId] = useState<string>(() => {
    const currentAlternate = rankedResults.find((result) => result.status === "ALTERNATE");
    return currentAlternate?.applicationId ?? "";
  });

  const [allocationRows, setAllocationRows] = useState<AllocationDraft[]>(
    initialAllocations.length > 0
      ? initialAllocations.map((allocation) => ({
          applicationId: allocation.applicationId,
          label: allocation.label,
          amount: centsToDisplay(allocation.amountCents),
        }))
      : [{ applicationId: roster[0]?.applicationId ?? "", label: "", amount: "" }]
  );
  const [allocationNote, setAllocationNote] = useState(initialAllocations[0]?.internalNote ?? "");

  const initialAudienceByApplication = useMemo(
    () =>
      new Map(
        initialAudienceEntries.map((entry) => [
          entry.applicationId,
          {
            baselineViews: String(entry.baselineViews),
            endViews: String(entry.endViews),
            dispositionStatus: entry.dispositionStatus,
            dispositionNote: entry.dispositionNote ?? "",
          },
        ])
      ),
    [initialAudienceEntries]
  );

  const [baselineInputs, setBaselineInputs] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        roster.map((entry) => [
          entry.applicationId,
          initialAudienceByApplication.get(entry.applicationId)?.baselineViews ?? "0",
        ])
      )
  );
  const [endInputs, setEndInputs] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        roster.map((entry) => [
          entry.applicationId,
          initialAudienceByApplication.get(entry.applicationId)?.endViews ?? "0",
        ])
      )
  );
  const [dispositionState, setDispositionState] = useState<
    Record<string, { status: "ELIGIBLE" | "FLAGGED" | "DISQUALIFIED"; note: string }>
  >(() =>
    Object.fromEntries(
      roster.map((entry) => [
        entry.applicationId,
        {
          status: initialAudienceByApplication.get(entry.applicationId)?.dispositionStatus ?? "ELIGIBLE",
          note: initialAudienceByApplication.get(entry.applicationId)?.dispositionNote ?? "",
        },
      ])
    )
  );

  const isLocked = Boolean(certification);

  const suggestionsByApplication = useMemo(() => {
    const grouped = new Map<string, JudgeSuggestion[]>();
    for (const suggestion of judgeSuggestions) {
      const existing = grouped.get(suggestion.applicationId) ?? [];
      existing.push(suggestion);
      grouped.set(suggestion.applicationId, existing);
    }
    return grouped;
  }, [judgeSuggestions]);

  const canUseChapterCloseout =
    roundType === "CHAPTER" && typeof advancementSlots === "number" && advancementSlots > 0;

  function clearMessages() {
    setError(null);
    setSuccess(null);
  }

  function updateAllocationRow(index: number, patch: Partial<AllocationDraft>) {
    setAllocationRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    );
  }

  function addAllocationRow() {
    setAllocationRows((current) => [
      ...current,
      { applicationId: roster[0]?.applicationId ?? "", label: "", amount: "" },
    ]);
  }

  function removeAllocationRow(index: number) {
    setAllocationRows((current) =>
      current.length === 1
        ? [{ applicationId: roster[0]?.applicationId ?? "", label: "", amount: "" }]
        : current.filter((_, rowIndex) => rowIndex !== index)
    );
  }

  function toggleWinner(applicationId: string) {
    setWinnerIds((current) => {
      if (current.includes(applicationId)) {
        return current.filter((id) => id !== applicationId);
      }
      if (typeof advancementSlots === "number" && advancementSlots > 0 && current.length >= advancementSlots) {
        return current;
      }
      return [...current, applicationId];
    });
    if (alternateId === applicationId) {
      setAlternateId("");
    }
  }

  async function onFinalizeChapterCloseout() {
    clearMessages();

    if (!canUseChapterCloseout || !chapterName) {
      setError("Configure the chapter round advancement count before closing out this chapter.");
      return;
    }
    if (winnerIds.length !== advancementSlots) {
      setError(`Select exactly ${advancementSlots} advancing applicant${advancementSlots === 1 ? "" : "s"}.`);
      return;
    }

    const winnerNames = rankedResults
      .filter((result) => winnerIds.includes(result.applicationId))
      .sort((left, right) => left.rank - right.rank)
      .map((result) => result.applicantName);
    const suggestedAlternate =
      alternateId
        ? rankedResults.find((result) => result.applicationId === alternateId)
        : rankedResults.find((result) => !winnerIds.includes(result.applicationId));

    const confirmationMessage = [
      `You have selected ${winnerNames.join(" and ")} to advance to national adjudication for ${chapterName}.`,
      suggestedAlternate
        ? `The system will also mark ${suggestedAlternate.applicantName} as Alternate and mark all remaining ranked applicants as Did Not Advance.`
        : "The system will mark all remaining ranked applicants as Did Not Advance.",
      "Is that correct?",
    ].join(" ");

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setIsClosingOutChapter(true);
    try {
      const response = await fetch(
        `/api/events/${eventId}/rounds/${roundId}/chapter-closeout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chapter: chapterName,
            winnerApplicationIds: winnerIds,
            alternateApplicationId: suggestedAlternate?.applicationId ?? null,
          }),
        }
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Unable to close out chapter results.");
        return;
      }

      setSuccess("Chapter winners recorded. Remaining applicants have been closed out for this chapter.");
      router.refresh();
    } finally {
      setIsClosingOutChapter(false);
    }
  }

  async function onCertify() {
    clearMessages();
    setIsCertifying(true);
    try {
      const response = await fetch(
        `/api/events/${eventId}/rounds/${roundId}/certify`,
        { method: "POST" }
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Unable to certify this round.");
        return;
      }

      setSuccess("Round certified. Scores, feedback, prize allocations, and Audience Favorite controls are now locked.");
      router.refresh();
    } finally {
      setIsCertifying(false);
    }
  }

  async function onSaveAllocations() {
    clearMessages();

    const allocations: Array<{
      applicationId: string;
      label: string;
      amountCents: number | null;
    }> = [];
    for (const row of allocationRows) {
      const hasAnyValue =
        row.applicationId.trim().length > 0 || row.label.trim().length > 0 || row.amount.trim().length > 0;
      if (!hasAnyValue) continue;

      if (!row.applicationId.trim() || !row.label.trim()) {
        setError("Each final prize allocation must include an applicant and prize label.");
        return;
      }

      const amountCents = displayToCents(row.amount);
      if (Number.isNaN(amountCents)) {
        setError("Prize allocation amounts must be valid non-negative dollar amounts.");
        return;
      }

      allocations.push({
        applicationId: row.applicationId,
        label: row.label.trim(),
        amountCents,
      });
    }

    setIsSavingAllocations(true);
    try {
      const response = await fetch(
        `/api/events/${eventId}/rounds/${roundId}/prize-allocations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            allocations,
            internalNote: allocationNote.trim() || null,
          }),
        }
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Unable to save final prize allocations.");
        return;
      }

      setSuccess("Final prize allocations saved.");
      router.refresh();
    } finally {
      setIsSavingAllocations(false);
    }
  }

  async function onSaveSnapshot(snapshotType: "BASELINE" | "END") {
    clearMessages();

    const source = snapshotType === "BASELINE" ? baselineInputs : endInputs;
    const entries: Array<{ applicationId: string; viewCount: number }> = [];

    for (const rosterEntry of roster) {
      const raw = (source[rosterEntry.applicationId] ?? "0").trim();
      const viewCount = Number(raw === "" ? "0" : raw);
      if (!Number.isInteger(viewCount) || viewCount < 0) {
        setError("Audience Favorite snapshot values must be whole non-negative numbers.");
        return;
      }
      entries.push({
        applicationId: rosterEntry.applicationId,
        viewCount,
      });
    }

    const setLoading = snapshotType === "BASELINE" ? setIsSavingBaseline : setIsSavingEnd;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/events/${eventId}/rounds/${roundId}/audience-favorite/snapshots`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            snapshotType,
            entries,
          }),
        }
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Unable to save Audience Favorite snapshot.");
        return;
      }

      setSuccess(
        snapshotType === "BASELINE"
          ? "Audience Favorite baseline snapshot saved."
          : "Audience Favorite end-of-window snapshot saved."
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function onSaveDisposition(applicationId: string) {
    clearMessages();
    const current = dispositionState[applicationId];
    if (!current.note.trim()) {
      setError("A chair note is required when updating an Audience Favorite integrity status.");
      return;
    }

    setSavingDispositionId(applicationId);
    try {
      const response = await fetch(
        `/api/events/${eventId}/rounds/${roundId}/audience-favorite/disposition`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            applicationId,
            status: current.status,
            note: current.note.trim(),
          }),
        }
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Unable to save Audience Favorite integrity status.");
        return;
      }

      setSuccess("Audience Favorite integrity status updated.");
      router.refresh();
    } finally {
      setSavingDispositionId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-[#d8cce9] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1e1538]">Round Governance</h2>
          <p className="mt-1 text-sm text-[#6d5b91]">
            Winston 2026 governance requires complete judge scorecards, chair certification, clear
            prize authority, and auditable Audience Favorite handling.
          </p>
        </div>
        {certification ? (
          <div className="rounded-lg border border-[#bbe4d2] bg-[#f1fbf6] px-3 py-2 text-sm font-semibold text-[#166a46]">
            Certified {formatTimestamp(certification.certifiedAt)} by {certification.certifiedByName}
          </div>
        ) : (
          <div className="rounded-lg border border-[#e2d8f0] bg-[#faf7ff] px-3 py-2 text-sm text-[#5a4d7f]">
            {readiness.finalizedCount}/{readiness.requiredFinalizations} scorecards complete
          </div>
        )}
      </div>

      {error ? (
        <p className="rounded-lg border border-[#f2b2b2] bg-[#fff2f2] px-3 py-2 text-sm font-medium text-[#b42318]">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-lg border border-[#bbe4d2] bg-[#f1fbf6] px-3 py-2 text-sm font-medium text-[#166a46]">
          {success}
        </p>
      ) : null}

      {roundType === "CHAPTER" ? (
        <article className="rounded-lg border border-[#d7cde9] bg-[#faf7ff] p-3">
          <h3 className="text-base font-semibold text-[#1e1538]">Chapter Closeout</h3>
          {canUseChapterCloseout ? (
            <>
              <p className="mt-1 text-sm text-[#6d5b91]">
                Select the chapter winners who should advance. When the final slot is filled, the
                system will confirm the selection, suggest the next-ranked applicant as alternate,
                and mark all remaining ranked applicants as Did Not Advance.
              </p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#7b6e9d]">
                {chapterName ?? "Chapter"} · {advancementSlots} advancing slot
                {advancementSlots === 1 ? "" : "s"}
              </p>

              <div className="mt-3 space-y-2">
                {rankedResults.map((result) => {
                  const isWinner = winnerIds.includes(result.applicationId);
                  const isAlternate = alternateId === result.applicationId;
                  return (
                    <div
                      key={`closeout-${result.applicationId}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#ddd2ee] bg-white px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#1e1538]">
                          #{result.rank} {result.applicantName}
                          {result.tied ? " (tie)" : ""}
                        </p>
                        <p className="text-xs text-[#6d5b91]">
                          Score {result.totalScore.toFixed(2)} · Current status: {result.status.replaceAll("_", " ")}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-[#1e1538]">
                          <input
                            type="checkbox"
                            checked={isWinner}
                            disabled={
                              isLocked ||
                              isClosingOutChapter ||
                              (!isWinner &&
                                typeof advancementSlots === "number" &&
                                winnerIds.length >= advancementSlots)
                            }
                            onChange={() => toggleWinner(result.applicationId)}
                          />
                          Advance
                        </label>
                        <label className="flex items-center gap-2 text-sm text-[#1e1538]">
                          <input
                            type="radio"
                            name={`alternate-${roundId}-${chapterName ?? "chapter"}`}
                            checked={isAlternate}
                            disabled={isLocked || isClosingOutChapter || isWinner}
                            onChange={() => setAlternateId(result.applicationId)}
                          />
                          Alternate
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!isLocked ? (
                <button
                  type="button"
                  disabled={isClosingOutChapter || winnerIds.length !== advancementSlots}
                  className="mt-3 rounded-lg border border-[#4d2d91] bg-[#5f2ec8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#5327b2] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={onFinalizeChapterCloseout}
                >
                  {isClosingOutChapter ? "Closing Out..." : "Confirm Chapter Winners"}
                </button>
              ) : null}
            </>
          ) : (
            <p className="mt-1 text-sm text-[#6d5b91]">
              Configure how many applicants advance from this chapter round before closing out the
              chapter results.
            </p>
          )}
        </article>
      ) : null}

      {canManageGovernance ? (
      <>
      <article className="rounded-lg border border-[#e2d8f0] bg-[#faf7ff] p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[#1e1538]">Round Certification</h3>
            <p className="mt-1 text-sm text-[#6d5b91]">
              Certification is blocked until every assigned judge has completed every applicant
              scorecard. Certification then locks scores, feedback, prize allocations, and
              Audience Favorite controls.
            </p>
          </div>
          {!certification && canCertify ? (
            <button
              type="button"
              disabled={isCertifying || readiness.missingCount > 0}
              className="rounded-lg border border-[#4d2d91] bg-[#5f2ec8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#5327b2] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onCertify}
            >
              {isCertifying ? "Certifying..." : "Certify Round"}
            </button>
          ) : null}
        </div>

        {readiness.missingCount > 0 && !certification && canCertify ? (
          <p className="mt-3 text-sm font-medium text-[#9d2c2c]">
            Certification blocked: {readiness.missingCount} required judge scorecard
            {readiness.missingCount === 1 ? "" : "s"} still missing.
          </p>
        ) : null}
      </article>

      <article className="rounded-lg border border-[#e2d8f0] bg-[#faf7ff] p-3">
        <h3 className="text-base font-semibold text-[#1e1538]">Final Prize Allocation</h3>
        <p className="mt-1 text-sm text-[#6d5b91]">
          Judges submit recommendations only. The chair sets final prize allocations here.
        </p>

        <div className="mt-3 space-y-3">
          {allocationRows.map((row, index) => (
            <div
              key={`allocation-${index}`}
              className="grid gap-2 rounded-lg border border-[#ddd2ee] bg-white p-3 md:grid-cols-[minmax(0,1fr),minmax(0,1fr),10rem,auto]"
            >
              <select
                className="rounded-lg border border-[#d0c2e7] bg-white px-3 py-2 text-sm text-[#1e1538]"
                value={row.applicationId}
                disabled={isLocked}
                onChange={(event) => updateAllocationRow(index, { applicationId: event.target.value })}
              >
                <option value="">Select applicant</option>
                {roster.map((entry) => (
                  <option key={entry.applicationId} value={entry.applicationId}>
                    {entry.applicantName}
                  </option>
                ))}
              </select>
              <input
                className="rounded-lg border border-[#d0c2e7] bg-white px-3 py-2 text-sm text-[#1e1538]"
                placeholder="Prize label"
                value={row.label}
                disabled={isLocked}
                onChange={(event) => updateAllocationRow(index, { label: event.target.value })}
              />
              <input
                className="rounded-lg border border-[#d0c2e7] bg-white px-3 py-2 text-sm text-[#1e1538]"
                placeholder="Amount"
                inputMode="decimal"
                value={row.amount}
                disabled={isLocked}
                onChange={(event) => updateAllocationRow(index, { amount: event.target.value })}
              />
              {!isLocked ? (
                <button
                  type="button"
                  className="rounded-lg border border-[#d0c2e7] bg-white px-3 py-2 text-sm font-semibold text-[#5f2ec8] hover:bg-[#f6f0ff]"
                  onClick={() => removeAllocationRow(index)}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>

        {!isLocked ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-[#d0c2e7] bg-white px-3 py-2 text-sm font-semibold text-[#5f2ec8] hover:bg-[#f6f0ff]"
              onClick={addAllocationRow}
            >
              Add Allocation
            </button>
          </div>
        ) : null}

        <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-[#7b6e9d]">
          Chair Internal Note
        </label>
        <textarea
          className="mt-2 min-h-[92px] w-full rounded-lg border border-[#d0c2e7] bg-white px-3 py-2 text-sm text-[#1e1538]"
          placeholder="Required when modifying prize structure or amounts."
          value={allocationNote}
          disabled={isLocked}
          onChange={(event) => setAllocationNote(event.target.value)}
        />

        {!isLocked ? (
          <button
            type="button"
            disabled={isSavingAllocations}
            className="mt-3 rounded-lg border border-[#4d2d91] bg-[#5f2ec8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#5327b2] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onSaveAllocations}
          >
            {isSavingAllocations ? "Saving..." : "Save Final Prize Allocations"}
          </button>
        ) : null}

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7b6e9d]">
            Judge Prize Suggestions
          </p>
          {roster.map((entry) => {
            const suggestions = suggestionsByApplication.get(entry.applicationId) ?? [];
            return (
              <div key={`suggestions-${entry.applicationId}`} className="rounded-lg border border-[#ddd2ee] bg-white p-3">
                <p className="text-sm font-semibold text-[#1e1538]">{entry.applicantName}</p>
                {suggestions.length === 0 ? (
                  <p className="mt-1 text-sm text-[#6d5b91]">No judge recommendations recorded.</p>
                ) : (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#5b4d7f]">
                    {suggestions.map((suggestion, index) => (
                      <li key={`${suggestion.applicationId}-${suggestion.judgeName}-${index}`}>
                        {suggestion.judgeName}: {suggestion.label}
                        {typeof suggestion.amountCents === "number"
                          ? ` ($${(suggestion.amountCents / 100).toFixed(2)})`
                          : ""}
                        {suggestion.comment ? ` - ${suggestion.comment}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </article>

      <article className="rounded-lg border border-[#e2d8f0] bg-[#faf7ff] p-3">
        <h3 className="text-base font-semibold text-[#1e1538]">Audience Favorite Integrity</h3>
        <p className="mt-1 text-sm text-[#6d5b91]">
          Integrity clause: Audience Favorite is ranked by the change in verified engagement during
          the official award window, not raw lifetime views.
        </p>

        {roster.length === 0 ? (
          <p className="mt-3 text-sm text-[#6d5b91]">
            No scored applicants are available yet for Audience Favorite tracking.
          </p>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto rounded-lg border border-[#ddd2ee] bg-white">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#f4effb] text-left text-xs uppercase tracking-wide text-[#7b6e9d]">
                    <th className="px-3 py-2">Applicant</th>
                    <th className="px-3 py-2">Baseline</th>
                    <th className="px-3 py-2">End</th>
                    <th className="px-3 py-2">Delta</th>
                    <th className="px-3 py-2">Rank</th>
                    <th className="px-3 py-2">Integrity Status</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((entry) => {
                    const leaderboardEntry = initialAudienceEntries.find(
                      (candidate) => candidate.applicationId === entry.applicationId
                    );
                    const currentDisposition = dispositionState[entry.applicationId] ?? {
                      status: "ELIGIBLE",
                      note: "",
                    };

                    return (
                      <tr key={`audience-${entry.applicationId}`} className="border-t border-[#eee6fa] align-top">
                        <td className="px-3 py-3 font-medium text-[#1e1538]">{entry.applicantName}</td>
                        <td className="px-3 py-3">
                          <input
                            className="w-24 rounded-lg border border-[#d0c2e7] bg-white px-2 py-1.5 text-sm text-[#1e1538]"
                            inputMode="numeric"
                            disabled={isLocked}
                            value={baselineInputs[entry.applicationId] ?? "0"}
                            onChange={(event) =>
                              setBaselineInputs((current) => ({
                                ...current,
                                [entry.applicationId]: event.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            className="w-24 rounded-lg border border-[#d0c2e7] bg-white px-2 py-1.5 text-sm text-[#1e1538]"
                            inputMode="numeric"
                            disabled={isLocked}
                            value={endInputs[entry.applicationId] ?? "0"}
                            onChange={(event) =>
                              setEndInputs((current) => ({
                                ...current,
                                [entry.applicationId]: event.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className="px-3 py-3 text-[#3e2d69]">
                          {leaderboardEntry?.delta ?? 0}
                        </td>
                        <td className="px-3 py-3 text-[#3e2d69]">
                          {leaderboardEntry?.rank ?? "--"}
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-2">
                            <select
                              className="rounded-lg border border-[#d0c2e7] bg-white px-2 py-1.5 text-sm text-[#1e1538]"
                              disabled={isLocked}
                              value={currentDisposition.status}
                              onChange={(event) =>
                                setDispositionState((current) => ({
                                  ...current,
                                  [entry.applicationId]: {
                                    ...current[entry.applicationId],
                                    status: event.target.value as
                                      | "ELIGIBLE"
                                      | "FLAGGED"
                                      | "DISQUALIFIED",
                                  },
                                }))
                              }
                            >
                              <option value="ELIGIBLE">Eligible</option>
                              <option value="FLAGGED">Flagged</option>
                              <option value="DISQUALIFIED">Disqualified</option>
                            </select>
                            <textarea
                              className="min-h-[72px] w-full rounded-lg border border-[#d0c2e7] bg-white px-2 py-2 text-sm text-[#1e1538]"
                              placeholder="Required chair note"
                              disabled={isLocked}
                              value={currentDisposition.note}
                              onChange={(event) =>
                                setDispositionState((current) => ({
                                  ...current,
                                  [entry.applicationId]: {
                                    ...current[entry.applicationId],
                                    note: event.target.value,
                                  },
                                }))
                              }
                            />
                            {!isLocked ? (
                              <button
                                type="button"
                                disabled={savingDispositionId === entry.applicationId}
                                className="rounded-lg border border-[#d0c2e7] bg-white px-3 py-1.5 text-sm font-semibold text-[#5f2ec8] hover:bg-[#f6f0ff] disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => onSaveDisposition(entry.applicationId)}
                              >
                                {savingDispositionId === entry.applicationId
                                  ? "Saving..."
                                  : "Save Status"}
                              </button>
                            ) : null}
                            {leaderboardEntry?.dispositionNote ? (
                              <p className="text-xs text-[#6d5b91]">
                                Recorded by {leaderboardEntry.dispositionActorName ?? "chair"} on{" "}
                                {formatTimestamp(leaderboardEntry.dispositionActedAt)}:{" "}
                                {leaderboardEntry.dispositionNote}
                              </p>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!isLocked ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isSavingBaseline}
                  className="rounded-lg border border-[#d0c2e7] bg-white px-3 py-2 text-sm font-semibold text-[#5f2ec8] hover:bg-[#f6f0ff] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onSaveSnapshot("BASELINE")}
                >
                  {isSavingBaseline ? "Saving..." : "Save Baseline Snapshot"}
                </button>
                <button
                  type="button"
                  disabled={isSavingEnd}
                  className="rounded-lg border border-[#4d2d91] bg-[#5f2ec8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#5327b2] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onSaveSnapshot("END")}
                >
                  {isSavingEnd ? "Saving..." : "Save End Snapshot"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </article>
      </>
      ) : null}
    </section>
  );
}
