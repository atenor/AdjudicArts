"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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

function buildConfettiBurst(count = 96): ConfettiPiece[] {
  return Array.from({ length: count }).map((_, index) => ({
    burstX: -840 + Math.random() * 1680,
    burstY: -560 + Math.random() * 680,
    driftX: -480 + Math.random() * 960,
    swayX: 22 + Math.random() * 38,
    fallY: 92 + Math.random() * 20,
    size: 10 + Math.random() * 12,
    spin: -1960 + Math.random() * 3920,
    delay: Math.random() * 700,
    duration: 6480 + Math.random() * 2340,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  }));
}

export default function ApproveForAdjudicationButton({
  applicationId,
  disabled = false,
  className = "",
}: {
  applicationId: string;
  disabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiBurst, setConfettiBurst] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  async function onApprove() {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Approve application for chapter adjudication?\n\nThis will move the applicant out of Pending Approval."
      );
      if (!confirmed) return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessNote(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED_FOR_CHAPTER_ADJUDICATION" }),
      });
      if (!response.ok) {
        let message = "Unable to approve application.";
        try {
          const data = (await response.json()) as { error?: string };
          if (typeof data.error === "string" && data.error.trim()) message = data.error;
        } catch {
          // no-op
        }
        setError(message);
        return;
      }
      setShowConfetti(true);
      setConfettiPieces(buildConfettiBurst());
      setConfettiBurst(false);
      setSuccessNote("Approved for chapter adjudication.");
      if (typeof window !== "undefined") {
        window.setTimeout(() => setConfettiBurst(true), 10);
        window.setTimeout(() => {
          setShowConfetti(false);
          router.refresh();
        }, 10800);
      } else {
        router.refresh();
      }
    } catch {
      setError("Unable to approve application.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative space-y-1.5">
      <Button
        type="button"
        onClick={() => void onApprove()}
        disabled={disabled || isSubmitting}
        className={`w-full bg-[#147a58] text-white hover:bg-[#0f6047] disabled:bg-[#8bc7b3] ${className}`}
      >
        {isSubmitting ? "Approving..." : "Approve"}
      </Button>
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
                animationName: confettiBurst ? "approve-confetti-pop-fall" : undefined,
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
            @keyframes approve-confetti-pop-fall {
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
              99% {
                opacity: 0.65;
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
      {successNote ? <p className="text-xs font-medium text-[#0d7b5f]">{successNote}</p> : null}
      {error ? <p className="text-xs font-medium text-[#b42318]">{error}</p> : null}
    </div>
  );
}
