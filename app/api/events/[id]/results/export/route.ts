export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import { getEventById } from "@/lib/db/events";
import { getRankedResultsForRound } from "@/lib/db/results";

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!hasRole(session, "ADMIN", "NATIONAL_CHAIR")) {
    return new Response("Forbidden", { status: 403 });
  }

  const event = await getEventById(params.id, session.user.organizationId);
  if (!event) {
    return new Response("Not Found", { status: 404 });
  }

  const url = new URL(request.url);
  const roundId = url.searchParams.get("roundId");

  // Find the requested round (must belong to this event)
  const round = roundId
    ? event.rounds.find((r) => r.id === roundId)
    : event.rounds[0];

  if (!round) {
    return new Response("Round not found", { status: 404 });
  }

  const results = await getRankedResultsForRound(round.id);

  // Build CSV header row — static columns + dynamic criterion columns
  const criterionColumns =
    results.length > 0
      ? results[0].criterionAverages.map((c) => c.criteriaName)
      : [];

  const headers = [
    "Rank",
    "Tied",
    "Applicant Name",
    "Voice Part",
    "Status",
    "Total Score (/100)",
    "Judge Count",
    ...criterionColumns,
  ];

  const rows = results.map((r) => [
    r.rank,
    r.tied ? "=" : "",
    r.applicantName,
    r.voicePart ?? "",
    r.status,
    r.totalScore.toFixed(2),
    r.judgeCount,
    ...r.criterionAverages.map((c) => c.average.toFixed(2)),
  ]);

  const csvLines = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ];

  const csv = csvLines.join("\n");

  const safeEventName = event.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const safeRoundName = round.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const filename = `results_${safeEventName}_${safeRoundName}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
