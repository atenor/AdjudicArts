export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, ROLE_BADGE_VARIANTS } from "@/lib/roles";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="flex items-center justify-center pt-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back, {session?.user.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {session?.user.role && (
            <Badge variant={ROLE_BADGE_VARIANTS[session.user.role]}>
              {ROLE_LABELS[session.user.role]}
            </Badge>
          )}
          <p className="text-sm text-muted-foreground">More features coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
