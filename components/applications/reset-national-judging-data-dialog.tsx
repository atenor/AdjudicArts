"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ResetSummary = {
  nationalRoundCount: number;
  nationalJudgeCount: number;
  nationalScoreCount: number;
  nationalSubmissionCount: number;
  finalizedSubmissionCount: number;
  nationalSubmissionEventCount: number;
  nationalPrizeSuggestionCount: number;
  nationalBookmarkCount: number;
};

type ResetResult = {
  deleted: {
    scores: number;
    submissions: number;
    submissionEvents: number;
    prizeSuggestions: number;
    bookmarks: number;
  };
  after: ResetSummary;
};

const CONFIRMATION_TEXT = "RESET NATIONAL TEST DATA";

function summaryItems(summary: ResetSummary) {
  return [
    { label: "National scores", value: summary.nationalScoreCount },
    { label: "Judge submissions", value: summary.nationalSubmissionCount },
    { label: "Finalized submissions", value: summary.finalizedSubmissionCount },
    { label: "Submission events", value: summary.nationalSubmissionEventCount },
    { label: "Prize suggestions", value: summary.nationalPrizeSuggestionCount },
    { label: "National judge bookmarks", value: summary.nationalBookmarkCount },
  ];
}

export default function ResetNationalJudgingDataDialog({
  initialSummary,
}: {
  initialSummary: ResetSummary;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResetResult | null>(null);

  const hasAnythingToReset = useMemo(
    () =>
      initialSummary.nationalScoreCount > 0 ||
      initialSummary.nationalSubmissionCount > 0 ||
      initialSummary.nationalSubmissionEventCount > 0 ||
      initialSummary.nationalPrizeSuggestionCount > 0 ||
      initialSummary.nationalBookmarkCount > 0,
    [initialSummary]
  );

  async function onReset() {
    setError(null);
    setResult(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/scoring/reset-national-test-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmationText }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; result?: ResetResult }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to reset national judging test data.");
        return;
      }

      if (!payload?.result) {
        setError("Reset completed but no result payload was returned.");
        return;
      }

      setResult(payload.result);
      setConfirmationText("");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  const displaySummary = result?.after ?? initialSummary;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setConfirmationText("");
          setError(null);
          setResult(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="border-[#d7cde9] text-[#4a3d6b] hover:bg-[#f7f1ff]"
        >
          Reset National Test Data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl border-[#d8cce9] bg-white p-0">
        <div className="rounded-t-lg bg-[#f7f3ff] px-6 py-4">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-2 text-[#b42318]">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.24em]">
                Admin Reset
              </span>
            </div>
            <DialogTitle className="text-xl text-[#1e1538]">
              Reset National Judging Test Data
            </DialogTitle>
            <DialogDescription className="text-sm text-[#6d5b91]">
              This clears national judge scoring artifacts only. It does not delete applicants or
              change application workflow statuses, and it does not send notifications.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {summaryItems(displaySummary).map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[#e5dbf3] bg-[#faf7ff] px-4 py-3"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a79b1]">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-[#1e1538]">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[#e8debc] bg-[#fffaf0] px-4 py-3 text-sm text-[#6b5a23]">
            {hasAnythingToReset
              ? "Use this only after test adjudication. It will wipe national scores, submissions, submission history, prize suggestions, and national-judge bookmarks."
              : "There is currently no national judging test data to clear."}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="reset-national-test-data-confirmation"
              className="text-sm font-semibold text-[#3d2d72]"
            >
              Type <span className="font-mono">{CONFIRMATION_TEXT}</span> to confirm
            </label>
            <Input
              id="reset-national-test-data-confirmation"
              value={confirmationText}
              onChange={(event) => setConfirmationText(event.target.value)}
              placeholder={CONFIRMATION_TEXT}
              className="border-[#d7cde9] focus-visible:ring-[#5f2ec8]"
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-[#f2b2b2] bg-[#fff2f2] px-3 py-2 text-sm font-medium text-[#b42318]">
              {error}
            </p>
          ) : null}

          {result ? (
            <p className="rounded-lg border border-[#bbe4d2] bg-[#f1fbf6] px-3 py-2 text-sm font-medium text-[#166a46]">
              Reset complete. Removed {result.deleted.scores} national scores,{" "}
              {result.deleted.submissions} submissions, {result.deleted.submissionEvents} events,{" "}
              {result.deleted.prizeSuggestions} prize suggestions, and{" "}
              {result.deleted.bookmarks} national-judge bookmarks.
            </p>
          ) : null}
        </div>

        <DialogFooter className="border-t border-[#eee8f8] px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="border-[#d7cde9] text-[#4a3d6b] hover:bg-[#f7f1ff]"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            disabled={
              isSubmitting ||
              !hasAnythingToReset ||
              confirmationText !== CONFIRMATION_TEXT
            }
            className="bg-[#b42318] text-white hover:bg-[#9f1f16]"
            onClick={onReset}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            {isSubmitting ? "Resetting..." : "Reset National Test Data"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
