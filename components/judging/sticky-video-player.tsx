"use client";

import { useMemo, useState } from "react";
import { toYouTubeEmbedUrl } from "@/lib/youtube";
import styles from "./sticky-video-player.module.css";

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
        <iframe
          src={current.embed}
          title={`Audition video ${currentIndex + 1}`}
          className={styles.frame}
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

      <a href={current.original} target="_blank" rel="noreferrer" className={styles.link}>
        Open current video on YouTube
      </a>
    </div>
  );
}
