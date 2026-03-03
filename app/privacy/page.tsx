import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-muted/40 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-3xl border border-[#d8cce9] bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#7f6aa9]">
          AdjudicArts
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1e1538]">
          Privacy Policy
        </h1>
        <div className="mt-6 space-y-4 text-sm leading-7 text-[#4a3d6b]">
          <p>
            AdjudicArts collects the information you submit through application forms,
            including contact information, eligibility documents, written responses,
            and media links or uploaded files, so organizations can administer their
            programs and adjudicators can review submissions.
          </p>
          <p>
            Submitted materials may be accessed by authorized program administrators,
            chapter or national reviewers, judges, and platform support personnel when
            necessary to operate the service, assist customers, or troubleshoot issues.
          </p>
          <p>
            Information is retained as part of the official application record for the
            applicable event or program. Organizations using AdjudicArts are responsible
            for their own program-specific retention and eligibility requirements.
          </p>
          <p>
            Do not submit information you are not authorized to share. If you have
            privacy questions about a specific program, contact the organization running
            that program directly.
          </p>
        </div>
      </div>
    </main>
  );
}
