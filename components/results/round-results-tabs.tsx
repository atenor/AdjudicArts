"use client";

import { useState } from "react";
import Link from "next/link";
import type { RoundResultsSummary } from "@/lib/db/results";
import styles from "./round-results-tabs.module.css";

function formatStatus(status: string) {
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
  if (status === "CHAPTER_APPROVED" || status === "NATIONAL_APPROVED" || status === "DECIDED") {
    return styles.statusApproved;
  }
  if (status === "CHAPTER_REVIEW" || status === "NATIONAL_REVIEW") {
    return styles.statusReview;
  }
  return styles.statusPending;
}

type Props = {
  eventId: string;
  rounds: RoundResultsSummary[];
};

export default function RoundResultsTabs({ eventId, rounds }: Props) {
  const [activeRoundId, setActiveRoundId] = useState(rounds[0]?.roundId ?? "");

  if (rounds.length === 0) {
    return <p className={styles.emptyText}>No rounds found for this event.</p>;
  }

  const activeRound = rounds.find((round) => round.roundId === activeRoundId) ?? rounds[0];

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
              onClick={() => setActiveRoundId(round.roundId)}
            >
              {round.roundName}
            </button>
          );
        })}
      </div>

      {activeRound.applicationCount > 0 ? (
        <div className={styles.summary}>
          <span>
            <strong>{activeRound.applicationCount}</strong> applicants scored
          </span>
          <span>
            Avg <strong>{fmt(activeRound.averageTotalScore)}</strong>/100
          </span>
          <span>
            High <strong>{fmt(activeRound.highestScore)}</strong>
          </span>
          <span>
            Low <strong>{fmt(activeRound.lowestScore)}</strong>
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

      {activeRound.results.length === 0 ? (
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
              {activeRound.results.map((result) => {
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
