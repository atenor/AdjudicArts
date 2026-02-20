export const dynamic = "force-dynamic";

import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import { getJudgeScoringQueue } from "@/lib/db/scores";
import ApplicationStatusBadge from "@/components/applications/application-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatVoicePart(raw: string | null) {
  if (!raw) return "—";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default async function ScoringQueuePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasRole(session, "CHAPTER_JUDGE", "NATIONAL_JUDGE")) {
    redirect("/dashboard");
  }

  const queue = await getJudgeScoringQueue(
    session.user.id,
    session.user.organizationId,
    session.user.role
  );

  const totalApplications = queue.reduce((sum, round) => sum + round.totalCount, 0);
  const totalScored = queue.reduce((sum, round) => sum + round.scoredCount, 0);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Scoring Queue</h1>
        <p className="text-sm text-muted-foreground">
          {totalScored} of {totalApplications} applications scored
        </p>
      </div>

      {queue.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No assigned rounds are currently open for scoring.
        </p>
      ) : (
        <div className="space-y-6">
          {queue.map((roundQueue) => (
            <section key={roundQueue.round.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="font-medium">{roundQueue.round.name}</h2>
                <Badge variant="outline">
                  {roundQueue.round.type.toLowerCase()} round
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {roundQueue.event.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({roundQueue.scoredCount}/{roundQueue.totalCount} scored)
                </span>
              </div>

              {roundQueue.applications.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No applications are currently in this scoring stage.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Voice Part</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roundQueue.applications.map((application) => (
                      <TableRow key={application.id}>
                        <TableCell>
                          <Link
                            href={`/dashboard/scoring/${application.id}`}
                            className="font-medium hover:underline"
                          >
                            {application.applicant.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {application.applicant.email}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatVoicePart(application.voicePart)}
                        </TableCell>
                        <TableCell>
                          <ApplicationStatusBadge status={application.status} />
                        </TableCell>
                        <TableCell>
                          {application.isScored ? (
                            <Badge variant="default">Scored</Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
