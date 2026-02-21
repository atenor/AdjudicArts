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

const FEATURES = [
  {
    icon: "🎼",
    title: "Centralized Intake",
    body: "Applicants submit once. Admins and judges see everything in one organized place.",
  },
  {
    icon: "⭐",
    title: "10-Point Rubric Scoring",
    body: "Judges score each criterion with tap-friendly chips. Comments auto-save per criterion.",
  },
  {
    icon: "🏆",
    title: "Live Rankings",
    body: "Aggregate scores, rank tables, and CSV exports update the moment scores are submitted.",
  },
];

export default function MarketingHomepage() {
  const [activeView, setActiveView] = useState<ViewKey>("admin");
  const active = VIEW_CONTENT[activeView];

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(160deg, #0e0a1a 0%, #1e1538 60%, #2d1f5e 100%)",
        color: "#f0ebff",
      }}
    >
      {/* Nav */}
      <nav
        style={{
          background: "#462B7C",
          height: "52px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 2rem",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-cormorant), Georgia, serif",
            fontSize: "1.35rem",
            lineHeight: 1,
          }}
        >
          <span style={{ color: "#ffffff", fontWeight: 700 }}>Adjudic</span>
          <span style={{ color: "#e0c070", fontWeight: 300, fontStyle: "italic" }}>
            arts
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Link
            href="/login"
            style={{
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: "6px",
              padding: "0.4rem 0.9rem",
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.85)",
              textDecoration: "none",
            }}
          >
            Sign In
          </Link>
          <Link
            href="/login"
            style={{
              background: "#C9A84C",
              borderRadius: "6px",
              padding: "0.4rem 0.9rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "#1a1538",
              textDecoration: "none",
            }}
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "4rem 2rem 3rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "3rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "700px" }}>
          <p
            style={{
              display: "inline-block",
              border: "1px solid rgba(201,168,76,0.35)",
              background: "rgba(201,168,76,0.1)",
              borderRadius: "999px",
              padding: "0.3rem 1rem",
              fontSize: "0.7rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#e0c070",
              marginBottom: "1.25rem",
            }}
          >
            Classical Voice Adjudication
          </p>
          <h1
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontSize: "clamp(2.6rem, 6vw, 4rem)",
              fontWeight: 700,
              lineHeight: 1.1,
              color: "#ffffff",
              margin: "0 0 1rem",
            }}
          >
            Be judgy.{" "}
            <span
              style={{
                color: "#e0c070",
                fontStyle: "italic",
                fontWeight: 300,
              }}
            >
              We&apos;ll handle the rest.
            </span>
          </h1>
          <p
            style={{
              fontSize: "1rem",
              lineHeight: 1.7,
              color: "rgba(240,235,255,0.75)",
              maxWidth: "520px",
              margin: "0 auto 2rem",
            }}
          >
            AdjudicArts centralizes applicant intake, chapter review, national
            scoring, decisions, and exports for scholarship competitions.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "center",
            }}
          >
            <Link
              href="/login"
              style={{
                background: "#C9A84C",
                borderRadius: "8px",
                padding: "0.75rem 1.75rem",
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "#1a1538",
                textDecoration: "none",
              }}
            >
              Get Started
            </Link>
            <Link
              href="/login"
              style={{
                border: "1px solid rgba(255,255,255,0.22)",
                borderRadius: "8px",
                padding: "0.75rem 1.75rem",
                fontSize: "0.9rem",
                fontWeight: 500,
                color: "rgba(255,255,255,0.85)",
                textDecoration: "none",
              }}
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Interactive feature panel */}
        <div
          style={{
            maxWidth: "640px",
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "16px",
            padding: "1.25rem",
            boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginBottom: "1rem",
            }}
          >
            {(["admin", "judge", "results"] as ViewKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveView(key)}
                style={{
                  borderRadius: "999px",
                  padding: "0.35rem 0.9rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border:
                    activeView === key
                      ? "none"
                      : "1px solid rgba(255,255,255,0.2)",
                  background: activeView === key ? "#C9A84C" : "transparent",
                  color: activeView === key ? "#1a1538" : "rgba(255,255,255,0.7)",
                }}
              >
                {key === "admin"
                  ? "Admin"
                  : key === "judge"
                  ? "Judge Scoring"
                  : "Results"}
              </button>
            ))}
          </div>
          <div
            style={{
              background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px",
              padding: "1.1rem",
            }}
          >
            <h2
              style={{
                margin: "0 0 0.5rem",
                color: "#ffffff",
                fontSize: "1.05rem",
                fontWeight: 700,
              }}
            >
              {active.title}
            </h2>
            <p
              style={{
                margin: "0 0 0.75rem",
                color: "rgba(240,235,255,0.7)",
                fontSize: "0.85rem",
                lineHeight: 1.6,
              }}
            >
              {active.description}
            </p>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "grid",
                gap: "0.4rem",
              }}
            >
              {active.points.map((point) => (
                <li
                  key={point}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.5rem",
                    fontSize: "0.82rem",
                    color: "rgba(240,235,255,0.85)",
                  }}
                >
                  <span
                    style={{
                      marginTop: "0.3rem",
                      width: "6px",
                      height: "6px",
                      borderRadius: "999px",
                      background: "#C9A84C",
                      flexShrink: 0,
                    }}
                  />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "0 2rem 4rem",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1rem",
          }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "16px",
                padding: "1.5rem",
              }}
            >
              <div style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>
                {f.icon}
              </div>
              <h3
                style={{
                  margin: "0 0 0.4rem",
                  color: "#ffffff",
                  fontSize: "1rem",
                  fontWeight: 700,
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  margin: 0,
                  color: "rgba(240,235,255,0.65)",
                  fontSize: "0.85rem",
                  lineHeight: 1.6,
                }}
              >
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.1)",
          padding: "1.5rem 2rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-cormorant), Georgia, serif",
            fontSize: "1.1rem",
            marginBottom: "0.4rem",
          }}
        >
          <span style={{ color: "#ffffff", fontWeight: 700 }}>Adjudic</span>
          <span style={{ color: "#e0c070", fontWeight: 300, fontStyle: "italic" }}>
            arts
          </span>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          Arts adjudication, simplified.
        </p>
      </footer>
    </div>
  );
}
