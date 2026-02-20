import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, ROLE_BADGE_VARIANTS } from "@/lib/roles";
import SignOutButton from "@/components/shared/sign-out-button";

export default async function NavHeader() {
  const session = await getServerSession(authOptions);
  const canViewEvents =
    session?.user.role === "ADMIN" ||
    session?.user.role === "NATIONAL_CHAIR";
  const canViewApplications =
    session?.user.role === "ADMIN" ||
    session?.user.role === "NATIONAL_CHAIR";
  const canImportApplications = session?.user.role === "ADMIN";
  const canViewScoring =
    session?.user.role === "CHAPTER_JUDGE" ||
    session?.user.role === "NATIONAL_JUDGE";

  return (
    <header className="border-b bg-background">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:h-14 sm:flex-nowrap sm:justify-between sm:px-6 sm:py-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 sm:gap-6">
          <span className="font-semibold text-lg tracking-tight">AdjudicArts</span>
          {canViewEvents && (
            <Link
              href="/dashboard/events"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Events
            </Link>
          )}
          {canViewApplications && (
            <Link
              href="/dashboard/applications"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Applications
            </Link>
          )}
          {canImportApplications && (
            <Link
              href="/dashboard/import"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Import Applications
            </Link>
          )}
          {canViewScoring && (
            <Link
              href="/dashboard/scoring"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Scoring
            </Link>
          )}
        </div>
        {session?.user && (
          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="max-w-[7.5rem] truncate text-xs text-muted-foreground sm:max-w-none sm:text-sm">
              {session.user.name}
            </span>
            <Badge className="text-xs sm:text-sm" variant={ROLE_BADGE_VARIANTS[session.user.role]}>
              {ROLE_LABELS[session.user.role]}
            </Badge>
            <SignOutButton />
          </div>
        )}
      </div>
    </header>
  );
}
