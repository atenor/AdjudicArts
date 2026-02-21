"use client";

import { useMemo, useState } from "react";
import { toYouTubeEmbedUrl } from "@/lib/youtube";
import styles from "./sticky-video-player.module.css";

function extractVideoId(embedUrl: string): string {
  // embed URL is https://www.youtube.com/embed/VIDEOID[?params]
  const path = embedUrl.split("?")[0];
  return path.split("/").pop() ?? "";
}

export default function StickyVideoPlayer({
  videoUrls,
}: {
  videoUrls: string[];
}) {
  const embeds = useMemo(
    () =>
      videoUrls
        .map((url) => ({ original: url, embed: toYouTubeEmbedUrl(url) }))
        .filter((video): video is { original: string; embed: string } => Boolean(video.embed)),
    [videoUrls]
  );
  const [currentIndex, setCurrentIndex] = useState(0);

  if (embeds.length === 0) {
    return (
      <div className={styles.player}>
        <p className={styles.empty}>No YouTube videos provided for this application.</p>
      </div>
    );
  }

  const current = embeds[currentIndex];
  const videoId = extractVideoId(current.embed);
  const thumbnailSrc = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  return (
    <div className={styles.player}>
      <div className={styles.headerRow}>
        <p className={styles.title}>
          Audition Video {currentIndex + 1} of {embeds.length}
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
        <a
          href={current.original}
          target="_blank"
          rel="noreferrer noopener"
          className={styles.thumbnailLink}
          aria-label={`Open audition video ${currentIndex + 1} on YouTube`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailSrc}
            alt={`Audition video ${currentIndex + 1} thumbnail`}
            className={styles.thumbnail}
          />
          <span className={styles.playBtn} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </a>
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

      <a href={current.original} target="_blank" rel="noreferrer" className={styles.link}>
        Open on YouTube ↗
      </a>
    </div>
  );
}
