"use client";

import Link from "next/link";
import { useState } from "react";

type ViewKey = "admin" | "judge" | "results";

const VIEW_CONTENT: Record<
  ViewKey,
  { title: string; description: string; points: string[] }
> = {
  admin: {
    title: "Admin Dashboard",
    description:
      "Create events, assign judges, and monitor chapter and national progress in one place.",
    points: [
      "Create events and rounds in minutes",
      "Assign chapter and national judges",
      "Track application volume and stage counts",
    ],
  },
  judge: {
    title: "Judge Scoring",
    description:
      "Score audition videos against all 10 rubric criteria with fast mobile-friendly controls.",
    points: [
      "Sticky audition video panel",
      "Tap-to-score 0–10 rubric chips",
      "Final adjudication comments and save workflow",
    ],
  },
  results: {
    title: "Results & Rankings",
    description:
      "Review ranked outcomes, per-criterion averages, and export adjudication summaries.",
    points: [
      "Round-based ranking tables",
      "Judge coverage and aggregate totals",
      "CSV export for board reporting",
    ],
  },
};

export default function MarketingHomepage() {
  const [activeView, setActiveView] = useState<ViewKey>("admin");
  const active = VIEW_CONTENT[activeView];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-6 sm:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-2xl font-semibold tracking-tight">
            Adjudic<span className="font-light italic text-amber-300">Arts</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-amber-300 hover:text-amber-200"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-200"
            >
              Start Free Trial
            </Link>
          </div>
        </header>

        <main className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-center">
          <section className="space-y-5">
            <p className="inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs uppercase tracking-[0.14em] text-amber-200">
              Classical Voice Adjudication
            </p>
            <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
              Be judgy. <span className="text-amber-300">We&apos;ll handle the rest.</span>
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-300">
              AdjudicArts centralizes applicant intake, chapter review, national scoring,
              decisions, and exports for scholarship competitions.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-md bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-amber-200"
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-slate-700 px-5 py-3 text-sm font-medium text-slate-100 hover:border-amber-300 hover:text-amber-200"
              >
                Sign In
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveView("admin")}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  activeView === "admin"
                    ? "bg-amber-300 text-slate-900"
                    : "border border-slate-700 text-slate-300"
                }`}
              >
                Admin Dashboard
              </button>
              <button
                type="button"
                onClick={() => setActiveView("judge")}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  activeView === "judge"
                    ? "bg-amber-300 text-slate-900"
                    : "border border-slate-700 text-slate-300"
                }`}
              >
                Judge Scoring
              </button>
              <button
                type="button"
                onClick={() => setActiveView("results")}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  activeView === "results"
                    ? "bg-amber-300 text-slate-900"
                    : "border border-slate-700 text-slate-300"
                }`}
              >
                Results
              </button>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/80 p-5">
              <h2 className="text-xl font-semibold text-slate-100">{active.title}</h2>
              <p className="text-sm leading-6 text-slate-300">{active.description}</p>
              <ul className="space-y-2 text-sm text-slate-200">
                {active.points.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
