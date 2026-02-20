export const dynamic = "force-dynamic";

import Link from "next/link";
import { getPublicApplicationById } from "@/lib/db/applications";
import { parseApplicationMetadata } from "@/lib/application-metadata";
import { ApplicationStatus } from "@prisma/client";

const STATUS_MESSAGES: Record<ApplicationStatus, string> = {
  SUBMITTED:
    "Your application has been received and is awaiting review.",
  CHAPTER_REVIEW:
    "Your application is currently under chapter review.",
  CHAPTER_APPROVED:
    "Congratulations! Your application has been approved to advance to national review.",
  CHAPTER_REJECTED:
    "Thank you for applying. Unfortunately your application was not selected to advance at this time.",
  NATIONAL_REVIEW:
    "Your application is under national review.",
  NATIONAL_APPROVED:
    "Congratulations! Your application has been approved.",
  NATIONAL_REJECTED:
    "Thank you for applying. Unfortunately your application was not selected.",
  DECIDED:
    "A final decision has been made. Please check your email for details.",
};

type StepState = "complete" | "active" | "pending" | "rejected";

interface Step {
  label: string;
  state: StepState;
}

function getSteps(status: ApplicationStatus): Step[] {
  const steps: Step[] = [
    { label: "Submitted", state: "pending" },
    { label: "Chapter Review", state: "pending" },
    { label: "National Review", state: "pending" },
    { label: "Decision", state: "pending" },
  ];

  switch (status) {
    case "SUBMITTED":
      steps[0].state = "active";
      break;
    case "CHAPTER_REVIEW":
      steps[0].state = "complete";
      steps[1].state = "active";
      break;
    case "CHAPTER_APPROVED":
      steps[0].state = "complete";
      steps[1].state = "complete";
      steps[2].state = "pending";
      break;
    case "CHAPTER_REJECTED":
      steps[0].state = "complete";
      steps[1].state = "rejected";
      steps[2].state = "pending";
      steps[3].state = "pending";
      break;
    case "NATIONAL_REVIEW":
      steps[0].state = "complete";
      steps[1].state = "complete";
      steps[2].state = "active";
      break;
    case "NATIONAL_APPROVED":
      steps[0].state = "complete";
      steps[1].state = "complete";
      steps[2].state = "complete";
      steps[3].state = "pending";
      break;
    case "NATIONAL_REJECTED":
      steps[0].state = "complete";
      steps[1].state = "complete";
      steps[2].state = "rejected";
      steps[3].state = "pending";
      break;
    case "DECIDED":
      steps[0].state = "complete";
      steps[1].state = "complete";
      steps[2].state = "complete";
      steps[3].state = "complete";
      break;
  }

  return steps;
}

function StepIndicator({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex items-start gap-0 w-full">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const { state, label } = step;

        const circleClass =
          state === "complete"
            ? "bg-primary text-primary-foreground"
            : state === "active"
            ? "border-2 border-primary text-primary"
            : state === "rejected"
            ? "border-2 border-destructive text-destructive"
            : "border-2 border-muted-foreground/30 text-muted-foreground/30";

        const labelClass =
          state === "active"
            ? "text-primary font-medium"
            : state === "complete"
            ? "text-foreground"
            : state === "rejected"
            ? "text-destructive"
            : "text-muted-foreground/50";

        return (
          <li key={label} className={`flex flex-col items-center ${isLast ? "flex-none" : "flex-1"}`}>
            <div className="flex items-center w-full">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${circleClass}`}
              >
                {state === "complete" ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : state === "rejected" ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              {!isLast && (
                <div
                  className={`flex-1 h-0.5 ${
                    state === "complete" ? "bg-primary" : "bg-muted-foreground/20"
                  }`}
                />
              )}
            </div>
            <span className={`mt-2 text-xs text-center ${labelClass}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatVoicePart(notes: string | null) {
  const { voicePart } = parseApplicationMetadata(notes);
  if (!voicePart) return null;
  return voicePart.charAt(0).toUpperCase() + voicePart.slice(1);
}

export default async function StatusPage({
  params,
}: {
  params: { applicationId: string };
}) {
  const application = await getPublicApplicationById(params.applicationId);

  if (!application) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-semibold">Application not found</h1>
          <p className="text-muted-foreground text-sm">
            We couldn&apos;t find an application with that ID. Please check your link and try again.
          </p>
          <Link href="/" className="text-sm text-primary underline underline-offset-4">
            Return to home
          </Link>
        </div>
      </div>
    );
  }

  const steps = getSteps(application.status);
  const voicePart = formatVoicePart(application.notes);

  return (
    <div className="flex min-h-screen items-start justify-center bg-muted/40 p-6 pt-12">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Application Status</h1>
          <p className="text-muted-foreground text-sm mt-1">{application.event.name}</p>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Applicant</dt>
              <dd className="font-medium mt-0.5">{application.applicant.name}</dd>
            </div>
            {voicePart && (
              <div>
                <dt className="text-muted-foreground">Voice Part</dt>
                <dd className="font-medium mt-0.5">{voicePart}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Submitted</dt>
              <dd className="font-medium mt-0.5">{formatDate(application.submittedAt)}</dd>
            </div>
          </dl>

          <hr />

          <StepIndicator steps={steps} />

          <div className="rounded-md bg-muted px-4 py-3 text-sm">
            {STATUS_MESSAGES[application.status]}
          </div>
        </div>
      </div>
    </div>
  );
}
