import { Role } from "@prisma/client";
import { Session } from "next-auth";

export function requireRole(session: Session, ...roles: Role[]): void {
  if (!roles.includes(session.user.role)) {
    throw new Error("Unauthorized");
  }
}

export function hasRole(session: Session, ...roles: Role[]): boolean {
  return roles.includes(session.user.role);
}
