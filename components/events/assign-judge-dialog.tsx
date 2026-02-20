"use client";

import { useMemo, useState } from "react";
import { Role, RoundType } from "@prisma/client";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/roles";

type JudgeOption = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

type Assignment = {
  judge: JudgeOption;
};

type AssignJudgeDialogProps = {
  eventId: string;
  roundId: string;
  roundType: RoundType;
  judges: JudgeOption[];
  assignedJudges: Assignment[];
};

export default function AssignJudgeDialog({
  eventId,
  roundId,
  roundType,
  judges,
  assignedJudges,
}: AssignJudgeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>(assignedJudges);

  const filteredJudges = useMemo(() => {
    const requiredRole =
      roundType === "CHAPTER" ? Role.CHAPTER_JUDGE : Role.NATIONAL_JUDGE;
    const assignedIds = new Set(assignments.map((assignment) => assignment.judge.id));

    return judges.filter(
      (judge) => judge.role === requiredRole && !assignedIds.has(judge.id)
    );
  }, [assignments, judges, roundType]);

  async function assignJudge() {
    if (!selectedJudgeId) return;

    setServerError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/rounds/${roundId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judgeId: selectedJudgeId }),
      });

      if (!res.ok) {
        setServerError("Unable to assign judge. Please try again.");
        return;
      }

      const updatedAssignments = (await res.json()) as Assignment[];
      setAssignments(updatedAssignments);
      setSelectedJudgeId("");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function unassignJudge(judgeId: string) {
    setServerError(null);
    const res = await fetch(`/api/events/${eventId}/rounds/${roundId}/assign`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ judgeId }),
    });

    if (!res.ok) {
      setServerError("Unable to remove judge. Please try again.");
      return;
    }

    const updatedAssignments = (await res.json()) as Assignment[];
    setAssignments(updatedAssignments);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setServerError(null);
          setAssignments(assignedJudges);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Assign Judge
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Judge</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Assigned Judges</p>
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No judges assigned yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {assignments.map((assignment) => (
                  <Badge key={assignment.judge.id} variant="secondary" className="gap-1">
                    <span>{assignment.judge.name}</span>
                    <button
                      type="button"
                      onClick={() => void unassignJudge(assignment.judge.id)}
                      className="rounded-sm hover:bg-muted p-0.5"
                      aria-label={`Remove ${assignment.judge.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Available Judges</p>
            <Select value={selectedJudgeId} onValueChange={setSelectedJudgeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a judge" />
              </SelectTrigger>
              <SelectContent>
                {filteredJudges.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    No available {ROLE_LABELS[roundType === "CHAPTER" ? Role.CHAPTER_JUDGE : Role.NATIONAL_JUDGE].toLowerCase()}s
                  </SelectItem>
                ) : (
                  filteredJudges.map((judge) => (
                    <SelectItem key={judge.id} value={judge.id}>
                      {judge.name} ({judge.email})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => void assignJudge()}
              disabled={!selectedJudgeId || isSubmitting}
            >
              {isSubmitting ? "Assigning..." : "Assign Judge"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
