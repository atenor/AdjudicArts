"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Submission = {
  id: string;
  status: "DRAFT" | "FINALIZED";
  finalizedAt: string | Date | null;
  judge: {
    id: string;
    name: string | null;
    email: string;
  };
  round: {
    id: string;
    name: string;
    type: string;
  };
  events: Array<{
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
  }>;
};

function formatTimestamp(value: string | Date | null | undefined) {
  if (!value) return "--";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("en-US");
}

export default function JudgeSubmissionGovernancePanel({
  applicationId,
  submissions,
  canReopen,
}: {
  applicationId: string;
  submissions: Submission[];
  canReopen: boolean;
}) {
  const router = useRouter();
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onReopen(submission: Submission) {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError("A written reason is required before reopening a finalized judge submission.");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/scoring/${applicationId}/reopen`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roundId: submission.round.id,
          judgeId: submission.judge.id,
          reason: trimmedReason,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Unable to reopen this judge submission.");
        return;
      }

      setSuccess(
        `Reopened ${submission.judge.name ?? submission.judge.email}'s finalized submission for ${submission.round.name}.`
      );
      setActiveSubmissionId(null);
      setReason("");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#d8cce9] bg-white p-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#1e1538]">Judge Submission Governance</h2>
        <span className="text-xs font-semibold uppercase tracking-wide text-[#7b6e9d]">
          Winston 2026
        </span>
      </div>

      <p className="mt-2 text-sm text-[#6d5b91]">
        Finalized judge submissions can only be reopened by authorized chair/admin users and every
        reopen action requires a written reason.
      </p>

      {error ? (
        <p className="mt-3 rounded-lg border border-[#f2b2b2] bg-[#fff2f2] px-3 py-2 text-sm font-medium text-[#b42318]">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-3 rounded-lg border border-[#bbe4d2] bg-[#f1fbf6] px-3 py-2 text-sm font-medium text-[#166a46]">
          {success}
        </p>
      ) : null}

      <div className="mt-3 space-y-3">
        {submissions.length === 0 ? (
          <div className="rounded-lg border border-[#e2d8f0] bg-[#faf7ff] p-3 text-sm text-[#6d5b91]">
            No judge submissions exist yet for this application.
          </div>
        ) : (
          submissions.map((submission) => {
            const isOpen = activeSubmissionId === submission.id;
            return (
              <article
                key={submission.id}
                className="rounded-lg border border-[#e2d8f0] bg-[#faf7ff] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1e1538]">
                      {submission.judge.name ?? submission.judge.email}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-[#7b6e9d]">
                      {submission.round.name} · {submission.round.type.toLowerCase()} round
                    </p>
                    <p className="mt-1 text-xs text-[#6d5b91]">
                      Status:{" "}
                      <span className="font-semibold text-[#3e2d69]">
                        {submission.status === "FINALIZED" ? "Finalized" : "Draft"}
                      </span>
                      {submission.finalizedAt ? ` · ${formatTimestamp(submission.finalizedAt)}` : ""}
                    </p>
                  </div>

                  {canReopen && submission.status === "FINALIZED" ? (
                    <button
                      type="button"
                      className="rounded-lg border border-[#d6b9b9] bg-white px-3 py-1.5 text-xs font-semibold text-[#9d2c2c] hover:bg-[#fff5f5]"
                      onClick={() => {
                        setError(null);
                        setSuccess(null);
                        setActiveSubmissionId(isOpen ? null : submission.id);
                        setReason("");
                      }}
                    >
                      {isOpen ? "Cancel" : "Reopen"}
                    </button>
                  ) : null}
                </div>

                {submission.events.length > 0 ? (
                  <ol className="mt-3 list-disc space-y-1 pl-5 text-xs leading-relaxed text-[#5b4d7f]">
                    {submission.events.map((event) => (
                      <li key={event.id}>
                        {event.eventType === "FINALIZED" ? "Finalized" : "Reopened"} by{" "}
                        {event.actor.name ?? event.actor.email} ({event.actorRole}) on{" "}
                        {formatTimestamp(event.createdAt)}
                        {event.reason ? ` · ${event.reason}` : ""}
                      </li>
                    ))}
                  </ol>
                ) : null}

                {canReopen && isOpen ? (
                  <div className="mt-3 space-y-2 border-t border-[#e5dbf3] pt-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[#7b6e9d]">
                      Reopen Reason
                    </label>
                    <textarea
                      className="min-h-[96px] w-full rounded-lg border border-[#d0c2e7] bg-white px-3 py-2 text-sm text-[#1e1538] outline-none focus:border-[#6b4baa]"
                      placeholder="Enter the chair/admin reason for reopening this finalized submission."
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                    <button
                      type="button"
                      disabled={isSubmitting}
                      className="rounded-lg border border-[#d6b9b9] bg-[#fff5f5] px-3 py-2 text-sm font-semibold text-[#9d2c2c] hover:bg-[#ffefef] disabled:cursor-not-allowed disabled:opacity-70"
                      onClick={() => onReopen(submission)}
                    >
                      {isSubmitting ? "Reopening..." : "Confirm Reopen"}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
