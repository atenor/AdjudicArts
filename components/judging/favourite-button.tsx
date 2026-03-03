"use client";

import { useState } from "react";

export default function JudgeBookmarkButton({
  applicationId,
  initialActive,
}: {
  applicationId: string;
  initialActive: boolean;
}) {
  const [active, setActive] = useState(initialActive);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onToggle() {
    setError(null);
    setIsSaving(true);
    const nextActive = !active;

    try {
      const response = await fetch(`/api/scoring/${applicationId}/bookmark`, {
        method: nextActive ? "POST" : "DELETE",
      });

      if (!response.ok) {
        setError("Unable to update bookmark.");
        return;
      }

      setActive(nextActive);
    } catch {
      setError("Unable to update bookmark.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gap: "0.22rem",
      }}
    >
      <button
        type="button"
        aria-label={active ? "Remove judge bookmark" : "Add judge bookmark"}
        title={active ? "Remove judge bookmark" : "Add judge bookmark"}
        disabled={isSaving}
        onClick={onToggle}
        style={{
          border: "1px solid rgba(201,168,76,0.24)",
          cursor: isSaving ? "wait" : "pointer",
          padding: "0.28rem 0.55rem",
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "center",
          gap: "0.32rem",
          borderRadius: "999px",
          boxShadow: active
            ? "0 0 0 1px rgba(201,168,76,0.4), 0 2px 10px rgba(201,168,76,0.22)"
            : "0 0 0 1px rgba(201,168,76,0.24)",
          background: active ? "rgba(201,168,76,0.14)" : "rgba(201,168,76,0.06)",
          transition: "all 160ms ease",
          opacity: isSaving ? 0.75 : 1,
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill={active ? "#E0C070" : "none"}
          stroke={active ? "#C9A84C" : "rgba(201,168,76,0.9)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            color: active ? "#6b560f" : "#7a6630",
            letterSpacing: "0.03em",
          }}
        >
          {active ? "Bookmarked" : "Judge bookmark"}
        </span>
      </button>
      {error ? (
        <span
          style={{
            fontSize: "0.68rem",
            color: "#9d2c2c",
            fontWeight: 600,
          }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
