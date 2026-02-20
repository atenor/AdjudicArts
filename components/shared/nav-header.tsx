import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, ROLE_BADGE_VARIANTS } from "@/lib/roles";
import SignOutButton from "@/components/shared/sign-out-button";

export default async function NavHeader() {
  const session = await getServerSession(authOptions);

  return (
    <header className="border-b bg-background">
      <div className="flex h-14 items-center justify-between px-6">
        <span className="font-semibold text-lg tracking-tight">AdjudicArts</span>
        {session?.user && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{session.user.name}</span>
            <Badge variant={ROLE_BADGE_VARIANTS[session.user.role]}>
              {ROLE_LABELS[session.user.role]}
            </Badge>
            <SignOutButton />
          </div>
        )}
      </div>
    </header>
  );
}
