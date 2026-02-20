"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { toYouTubeEmbedUrl } from "@/lib/youtube";

export default function StickyVideoPlayer({ videoUrls }: { videoUrls: string[] }) {
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
      <div className="sticky top-2 z-20 rounded-lg border bg-background p-3">
        <p className="text-sm text-muted-foreground">
          No YouTube videos provided for this application.
        </p>
      </div>
    );
  }

  const current = embeds[currentIndex];

  return (
    <div className="sticky top-2 z-20 rounded-lg border bg-background p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs sm:text-sm font-medium">
          Audition Video {currentIndex + 1} of {embeds.length}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setCurrentIndex((index) => (index - 1 + embeds.length) % embeds.length)
            }
          >
            Prev
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setCurrentIndex((index) => (index + 1) % embeds.length)}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="w-full max-w-[640px] mx-auto aspect-video overflow-hidden rounded-md border bg-black">
        <iframe
          src={current.embed}
          title={`Audition video ${currentIndex + 1}`}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {embeds.map((video, index) => (
          <Button
            key={video.original}
            type="button"
            size="sm"
            variant={index === currentIndex ? "default" : "outline"}
            onClick={() => setCurrentIndex(index)}
            className="h-8 px-2 text-xs"
          >
            Video {index + 1}
          </Button>
        ))}
      </div>

      <a
        href={current.original}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-muted-foreground underline"
      >
        Open current video on YouTube
      </a>
    </div>
  );
}
