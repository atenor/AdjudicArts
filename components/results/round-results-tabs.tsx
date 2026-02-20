"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RoundResultsSummary } from "@/lib/db/results";

function statusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "CHAPTER_APPROVED":
    case "NATIONAL_APPROVED":
    case "DECIDED":
      return "default";
    case "CHAPTER_REJECTED":
    case "NATIONAL_REJECTED":
      return "destructive";
    default:
      return "secondary";
  }
}

function formatStatus(status: string) {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function fmt(n: number) {
  return n.toFixed(2);
}

type Props = {
  eventId: string;
  rounds: RoundResultsSummary[];
};

export default function RoundResultsTabs({ eventId, rounds }: Props) {
  if (rounds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No rounds found for this event.
      </p>
    );
  }

  return (
    <Tabs defaultValue={rounds[0].roundId}>
      <TabsList>
        {rounds.map((round) => (
          <TabsTrigger key={round.roundId} value={round.roundId}>
            {round.roundName}
          </TabsTrigger>
        ))}
      </TabsList>

      {rounds.map((round) => (
        <TabsContent key={round.roundId} value={round.roundId} className="mt-4">
          {/* Summary stats */}
          {round.applicationCount > 0 && (
            <div className="flex flex-wrap gap-4 mb-4 text-sm text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">
                  {round.applicationCount}
                </span>{" "}
                applicant{round.applicationCount !== 1 ? "s" : ""} scored
              </span>
              <span>
                Avg:{" "}
                <span className="font-medium text-foreground">
                  {fmt(round.averageTotalScore)}
                </span>
                /100
              </span>
              <span>
                High:{" "}
                <span className="font-medium text-foreground">
                  {fmt(round.highestScore)}
                </span>
              </span>
              <span>
                Low:{" "}
                <span className="font-medium text-foreground">
                  {fmt(round.lowestScore)}
                </span>
              </span>
            </div>
          )}

          {/* Export button */}
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/api/events/${eventId}/results/export?roundId=${round.roundId}`}
              >
                Export CSV
              </Link>
            </Button>
          </div>

          {round.results.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No scored applications for this round yet.
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Rank</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Voice Part</TableHead>
                    <TableHead className="text-right">Total Score</TableHead>
                    <TableHead className="text-right">Judges</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {round.results.map((result) => (
                    <TableRow key={result.applicationId}>
                      <TableCell className="font-medium">
                        {result.tied ? "=" : ""}
                        {result.rank}
                      </TableCell>
                      <TableCell>{result.applicantName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {result.voicePart ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fmt(result.totalScore)}
                        <span className="text-muted-foreground text-xs">
                          /100
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {result.judgeCount}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(result.status)}>
                          {formatStatus(result.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
