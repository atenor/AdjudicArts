import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submission Terms",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-muted/40 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-3xl border border-[#d8cce9] bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#7f6aa9]">
          AdjudicArts
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1e1538]">
          Submission Terms
        </h1>
        <div className="mt-6 space-y-4 text-sm leading-7 text-[#4a3d6b]">
          <p>
            By submitting an application through AdjudicArts, you confirm that the
            information and materials you provide are accurate, complete, and authorized
            for review by the presenting organization and its adjudicators.
          </p>
          <p>
            Submission does not guarantee eligibility, advancement, selection, or award.
            Organizations may disqualify applications that do not satisfy program rules,
            age limits, division requirements, deadlines, or documentation standards.
          </p>
          <p>
            You are responsible for ensuring that linked media, uploaded materials, and
            supporting documents remain accessible and correspond to your submission.
          </p>
          <p>
            Additional program-specific rules may apply and can supersede these general
            submission terms when published by the organization running the event.
          </p>
        </div>
      </div>
    </main>
  );
}
