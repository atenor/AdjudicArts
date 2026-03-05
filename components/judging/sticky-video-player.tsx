"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import { toYouTubeEmbedUrl } from "@/lib/youtube";
import type { RepertoireEntry } from "@/lib/repertoire";
import styles from "./sticky-video-player.module.css";

type ScoreSummary = {
  filled: number;
  totalCriteria: number;
  average: number;
  normalizedTotal: number;
};

export default function StickyVideoPlayer({
  videoUrls,
  videoTitles = [],
  repertoireEntries = [],
  initialScoreSummary,
  performerName,
  performerMeta,
}: {
  videoUrls: string[];
  videoTitles?: string[];
  repertoireEntries?: RepertoireEntry[];
  initialScoreSummary: ScoreSummary;
  performerName: string;
  performerMeta: string;
}) {
  const embeds = useMemo(
    () =>
      videoUrls
        .map((url) => ({ original: url, embed: toYouTubeEmbedUrl(url) }))
        .filter((video): video is { original: string; embed: string } => Boolean(video.embed)),
    [videoUrls]
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary>(initialScoreSummary);

  useEffect(() => {
    function handleScoreSummary(event: Event) {
      const customEvent = event as CustomEvent<ScoreSummary>;
      if (!customEvent.detail) return;
      setScoreSummary(customEvent.detail);
    }

    window.addEventListener("adjudicarts:score-summary", handleScoreSummary as EventListener);
    return () => {
      window.removeEventListener(
        "adjudicarts:score-summary",
        handleScoreSummary as EventListener
      );
    };
  }, []);

  if (embeds.length === 0) {
    return (
      <div className={styles.player}>
        <p className={styles.empty}>No YouTube videos provided for this application.</p>
      </div>
    );
  }

  const current = embeds[currentIndex];
  const currentTitle =
    videoTitles[currentIndex]?.trim() || `Audition Video ${currentIndex + 1}`;
  const currentPiece = repertoireEntries[currentIndex] ?? null;

  return (
    <div className={styles.player}>
      <div className={styles.headerRow}>
        <p className={styles.title}>
          {performerName} · {performerMeta} · Video {currentIndex + 1} of {embeds.length}
        </p>
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => setCurrentIndex((index) => (index - 1 + embeds.length) % embeds.length)}
          >
            Prev
          </button>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => setCurrentIndex((index) => (index + 1) % embeds.length)}
          >
            Next
          </button>
        </div>
      </div>

      <div className={styles.frameWrap}>
        <iframe
          key={current.embed}
          src={current.embed}
          title={`Audition video ${currentIndex + 1}`}
          className={styles.frame}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      <div className={styles.tabs}>
        {embeds.map((video, index) => {
          const isActive = index === currentIndex;
          return (
            <button
              key={video.original}
              type="button"
              className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
              onClick={() => setCurrentIndex(index)}
            >
              Video {index + 1}
            </button>
          );
        })}
      </div>

      <section className={styles.repertoireCard}>
        <div className={styles.repertoireTopRow}>
          <div className={styles.repertoireInfo}>
            <p className={styles.repertoireLabel}>Repertoire</p>
            <p className={styles.repertoireTitle}>{currentPiece?.title || currentTitle}</p>
          </div>
          <div className={styles.totalCard}>
            <p className={styles.totalLabel}>Running Total</p>
            <p className={styles.totalValue}>{scoreSummary.normalizedTotal}/100</p>
          </div>
        </div>

        {currentPiece?.composer || currentPiece?.poet || currentPiece?.detail ? (
          <p className={styles.repertoireMeta}>
            {currentPiece.composer ? `Composer: ${currentPiece.composer}` : ""}
            {currentPiece.poet
              ? `${currentPiece.composer ? " · " : ""}Poet: ${currentPiece.poet}`
              : ""}
            {currentPiece.detail
              ? `${currentPiece.composer || currentPiece.poet ? " · " : ""}${currentPiece.detail}`
              : ""}
          </p>
        ) : null}
      </section>
    </div>
  );
}
