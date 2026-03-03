"use client";

import { useState } from "react";
import { Role } from "@prisma/client";
import Link from "next/link";
import type { RoundResultsSummary } from "@/lib/db/results";
import RoundGovernancePanel from "@/components/results/round-governance-panel";
import styles from "./round-results-tabs.module.css";

function formatStatus(status: string) {
  if (status === "PENDING_NATIONAL_ACCEPTANCE" || status === "CHAPTER_APPROVED") {
    return "Chapter Winner - Advanced to National Adjudication (Pending Approval)";
  }
  if (status === "DID_NOT_ADVANCE") {
    return "Did Not Advance";
  }
  return status
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function fmt(value: number) {
  return value.toFixed(2);
}

function rankClass(rank: number) {
  if (rank === 1) return styles.rank1;
  if (rank === 2) return styles.rank2;
  if (rank === 3) return styles.rank3;
  return styles.rankRest;
}

function statusClass(status: string) {
  if (
    status === "APPROVED_FOR_CHAPTER_ADJUDICATION" ||
    status === "PENDING_NATIONAL_ACCEPTANCE" ||
    status === "APPROVED_FOR_NATIONAL_ADJUDICATION" ||
    status === "CHAPTER_APPROVED" ||
    status === "NATIONAL_APPROVED" ||
    status === "DECIDED" ||
    status === "ALTERNATE"
  ) {
    return styles.statusApproved;
  }
  if (
    status === "PENDING_APPROVAL" ||
    status === "CORRECTION_REQUIRED" ||
    status === "CHAPTER_REVIEW" ||
    status === "NATIONAL_REVIEW"
  ) {
    return styles.statusReview;
  }
  return styles.statusPending;
}

function chaptersForResults(
  results: Array<{ chapter: string | null }>
) {
  return Array.from(
    new Set(
      results
        .map((result) => result.chapter?.trim() ?? "")
        .filter((chapter): chapter is string => chapter.length > 0)
    )
  ).sort((left, right) => left.localeCompare(right));
}

type ResultsRow = RoundResultsSummary["results"][number];

type Props = {
  eventId: string;
  rounds: RoundResultsSummary[];
  governanceByRound: Record<
    string,
    {
      chairAllocations: Array<{
        applicationId: string;
        applicantName: string;
        label: string;
        amountCents: number | null;
        internalNote: string | null;
        createdByName: string;
        createdAt: string | Date;
      }>;
      judgeSuggestions: Array<{
        applicationId: string;
        applicantName: string;
        judgeName: string;
        label: string;
        amountCents: number | null;
        comment: string | null;
      }>;
      audienceFavorite: Array<{
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
      }>;
    }
  >;
  viewerRole: Role;
  viewerChapter: string | null;
};

function summarizeResults(results: ResultsRow[]) {
  const scores = results.map((result) => result.totalScore);
  const applicationCount = results.length;
  const averageTotalScore =
    applicationCount > 0
      ? scores.reduce((sum, value) => sum + value, 0) / applicationCount
      : 0;
  const highestScore = applicationCount > 0 ? Math.max(...scores) : 0;
  const lowestScore = applicationCount > 0 ? Math.min(...scores) : 0;
  return {
    applicationCount,
    averageTotalScore,
    highestScore,
    lowestScore,
  };
}

export default function RoundResultsTabs({
  eventId,
  rounds,
  governanceByRound,
  viewerRole,
  viewerChapter,
}: Props) {
  const [activeRoundId, setActiveRoundId] = useState(rounds[0]?.roundId ?? "");
  const [selectedChapter, setSelectedChapter] = useState<string>("");

  if (rounds.length === 0) {
    return <p className={styles.emptyText}>No rounds found for this event.</p>;
  }

  const activeRound = rounds.find((round) => round.roundId === activeRoundId) ?? rounds[0];
  const activeGovernance = governanceByRound[activeRound.roundId] ?? {
    chairAllocations: [],
    judgeSuggestions: [],
    audienceFavorite: [],
  };
  const chapterOptions =
    activeRound.roundType === "CHAPTER" ? chaptersForResults(activeRound.results) : [];
  const effectiveChapter =
    activeRound.roundType !== "CHAPTER"
      ? null
      : viewerRole === "CHAPTER_CHAIR"
        ? viewerChapter
        : selectedChapter || chapterOptions[0] || null;
  const filteredResults =
    activeRound.roundType === "CHAPTER" && effectiveChapter
      ? activeRound.results.filter((result) => result.chapter === effectiveChapter)
      : activeRound.results;
  const filteredSummary = summarizeResults(filteredResults);

  return (
    <div className={styles.wrap}>
      <div className={styles.tabList}>
        {rounds.map((round) => {
          const isActive = round.roundId === activeRound.roundId;
          return (
            <button
              key={round.roundId}
              type="button"
              className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
              onClick={() => {
                setActiveRoundId(round.roundId);
                setSelectedChapter("");
              }}
            >
              {round.roundName}
            </button>
          );
        })}
      </div>

      {activeRound.roundType === "CHAPTER" && chapterOptions.length > 0 ? (
        <div className={styles.actionRow}>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#6d5b91]">Chapter:</span>
            {viewerRole === "CHAPTER_CHAIR" ? (
              <span className="rounded-md border border-[#d8cce9] bg-white px-3 py-2 text-sm font-medium text-[#1e1538]">
                {effectiveChapter}
              </span>
            ) : (
              <select
                value={effectiveChapter ?? ""}
                onChange={(event) => setSelectedChapter(event.target.value)}
                className="rounded-md border border-[#d8cce9] bg-white px-3 py-2 text-sm text-[#1e1538]"
              >
                {chapterOptions.map((chapter) => (
                  <option key={chapter} value={chapter}>
                    {chapter}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      ) : null}

      {filteredSummary.applicationCount > 0 ? (
        <div className={styles.summary}>
          <span>
            <strong>{filteredSummary.applicationCount}</strong> applicants scored
          </span>
          <span>
            Avg <strong>{fmt(filteredSummary.averageTotalScore)}</strong>/100
          </span>
          <span>
            High <strong>{fmt(filteredSummary.highestScore)}</strong>
          </span>
          <span>
            Low <strong>{fmt(filteredSummary.lowestScore)}</strong>
          </span>
        </div>
      ) : null}

      <div className={styles.actionRow}>
        <Link
          href={`/api/events/${eventId}/results/export?roundId=${activeRound.roundId}`}
          className={styles.export}
        >
          Export CSV
        </Link>
      </div>

      <RoundGovernancePanel
        key={`${activeRound.roundId}:${effectiveChapter ?? "all"}`}
        eventId={eventId}
        roundId={activeRound.roundId}
        roundType={activeRound.roundType}
        advancementSlots={activeRound.advancementSlots}
        chapterName={effectiveChapter}
        canCertify={viewerRole === "ADMIN" || viewerRole === "NATIONAL_CHAIR"}
        canManageGovernance={viewerRole === "ADMIN" || viewerRole === "NATIONAL_CHAIR"}
        readiness={activeRound.readiness}
        certification={activeRound.certification}
        roster={filteredResults.map((result) => ({
          applicationId: result.applicationId,
          applicantName: result.applicantName,
        }))}
        rankedResults={filteredResults.map((result) => ({
          applicationId: result.applicationId,
          applicantName: result.applicantName,
          rank: result.rank,
          tied: result.tied,
          status: result.status,
          totalScore: result.totalScore,
        }))}
        judgeSuggestions={activeGovernance.judgeSuggestions.filter((suggestion) =>
          filteredResults.some((result) => result.applicationId === suggestion.applicationId)
        )}
        initialAllocations={activeGovernance.chairAllocations.filter((allocation) =>
          filteredResults.some((result) => result.applicationId === allocation.applicationId)
        )}
        initialAudienceEntries={activeGovernance.audienceFavorite.filter((entry) =>
          filteredResults.some((result) => result.applicationId === entry.applicationId)
        )}
      />

      {filteredResults.length === 0 ? (
        <div className={styles.emptyWrap}>
          <div className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>No scored applications yet</p>
          <p className={styles.emptyText}>Scores will appear here once judges submit this round.</p>
        </div>
      ) : (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Applicant</th>
                <th>Voice Part</th>
                <th style={{ textAlign: "right" }}>Total Score</th>
                <th style={{ textAlign: "right" }}>Judges</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((result) => {
                const barWidth = Math.max(0, Math.min(100, (result.totalScore / 100) * 100));
                return (
                  <tr key={result.applicationId}>
                    <td className={`${styles.rank} ${rankClass(result.rank)}`}>
                      {result.tied ? "=" : ""}
                      {result.rank}
                    </td>
                    <td className={styles.name}>{result.applicantName}</td>
                    <td className={styles.voice}>{result.voicePart ?? "—"}</td>
                    <td>
                      <div className={styles.scoreCell}>
                        <span className={styles.scoreBarTrack}>
                          <span className={styles.scoreBarFill} style={{ width: `${barWidth}%` }} />
                        </span>
                        <span className={styles.scoreValue}>{fmt(result.totalScore)}</span>
                      </div>
                    </td>
                    <td className={styles.judges}>{result.judgeCount}</td>
                    <td>
                      <span className={`${styles.status} ${statusClass(result.status)}`}>
                        {formatStatus(result.status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
