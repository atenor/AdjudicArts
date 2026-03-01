import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "sa-session";
const IMPERSONATION_COOKIE = "sa-impersonation";
const SECRET = process.env.SUPERADMIN_SECRET ?? "superadmin-dev-secret-change-in-prod";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours
const IMPERSONATION_MAX_AGE = 60 * 60; // 1 hour

export interface SATokenPayload {
  id: string;
  email: string;
  name: string;
  iat: number;
  exp: number;
}

export interface ImpersonationPayload {
  superAdminId: string;
  targetUserId: string;
  orgId: string;
  orgName: string;
  iat: number;
  exp: number;
}

function sign(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verify<T>(token: string): T | null {
  try {
    const dotIdx = token.lastIndexOf(".");
    if (dotIdx === -1) return null;
    const data = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);
    const expected = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as T & { exp: number };
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSAToken(id: string, email: string, name: string): string {
  const now = Math.floor(Date.now() / 1000);
  return sign({ id, email, name, iat: now, exp: now + SESSION_MAX_AGE });
}

export function createImpersonationToken(
  superAdminId: string,
  targetUserId: string,
  orgId: string,
  orgName: string
): string {
  const now = Math.floor(Date.now() / 1000);
  return sign({ superAdminId, targetUserId, orgId, orgName, iat: now, exp: now + IMPERSONATION_MAX_AGE });
}

export function setSASessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export function clearSASessionCookie() {
  cookies().set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
}

export function setImpersonationCookie(token: string) {
  cookies().set(IMPERSONATION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: IMPERSONATION_MAX_AGE,
    path: "/",
  });
}

export function clearImpersonationCookie() {
  cookies().set(IMPERSONATION_COOKIE, "", { maxAge: 0, path: "/" });
}

export async function getServerSuperAdmin() {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verify<SATokenPayload>(token);
  if (!payload) return null;
  return prisma.superAdmin.findUnique({ where: { id: payload.id } });
}

export function getSATokenPayload(): SATokenPayload | null {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verify<SATokenPayload>(token);
}

export function getImpersonationPayload(): ImpersonationPayload | null {
  const cookieStore = cookies();
  const token = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  if (!token) return null;
  return verify<ImpersonationPayload>(token);
}
