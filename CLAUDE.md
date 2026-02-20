# AdjudicArts — Claude Code Reference

This document is the authoritative source for architecture decisions, conventions,
and patterns used in AdjudicArts. Every future Claude Code session should read this
file before writing any code.

---

## Project Overview

AdjudicArts is a web application for managing arts adjudication programs end-to-end.
It handles the full lifecycle: applicants submit, chapter judges score at a regional
level, national judges score at a national level, and chairs make final decisions.

The initial deployment targets a single national classical voice scholarship competition.
The architecture is designed for future multi-tenancy.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Database | PostgreSQL (Railway) |
| ORM | Prisma 5 (`prisma-client-js`) |
| Auth | NextAuth.js v4 |
| UI Components | shadcn/ui |
| Styling | Tailwind CSS |
| Hosting | Vercel |
| Repo | github.com/atenor/AdjudicArts (dev branch → main) |

---

## Folder Structure

```
/
├── app/                      # Next.js App Router
│   ├── api/
│   │   └── auth/[...nextauth]/route.ts   # NextAuth catch-all
│   ├── (auth)/               # Auth-required layout group (future)
│   │   └── dashboard/
│   ├── login/                # Public login page (future)
│   └── layout.tsx
├── components/               # All React components
│   ├── ui/                   # shadcn/ui primitives (auto-generated, do not edit)
│   ├── auth/                 # Auth-specific components
│   ├── events/               # Event management components
│   ├── applications/         # Application components
│   ├── judging/              # Scoring/judging components
│   └── shared/               # Cross-feature shared components
├── lib/                      # Server-side utilities and singletons
│   ├── auth.ts               # NextAuth config (authOptions)
│   ├── prisma.ts             # PrismaClient singleton
│   ├── generated/
│   │   └── prisma/           # Auto-generated Prisma client (gitignored)
│   └── db/                   # All Prisma query functions
│       ├── users.ts
│       ├── events.ts
│       ├── applications.ts
│       ├── scores.ts
│       └── ...
├── prisma/
│   ├── schema.prisma         # Data model
│   ├── migrations/           # Migration history
│   └── seed.ts               # Seed data
├── types/
│   └── next-auth.d.ts        # NextAuth session type augmentation
├── prisma.config.ts          # Prisma 7 datasource config (reads DATABASE_URL)
├── .env                      # DATABASE_URL for Prisma CLI (gitignored)
├── .env.local                # NEXTAUTH_* vars (gitignored)
├── .env.example              # Template — safe to commit
├── CLAUDE.md                 # This file
└── SPEC.md                   # Product spec and data model
```

---

## Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Files | kebab-case | `event-card.tsx`, `use-session.ts` |
| Components | PascalCase | `EventCard`, `ApplicationTable` |
| Prisma query files | kebab-case in `/lib/db/` | `events.ts` |
| API routes | Next.js file-based | `app/api/events/route.ts` |
| Env vars | UPPER_SNAKE_CASE | `DATABASE_URL`, `NEXTAUTH_SECRET` |
| DB columns | camelCase (Prisma default) | `organizationId`, `passwordHash` |
| CSS classes | Tailwind utilities only | no custom CSS classes |

---

## Architecture Decisions

### 1. Server Components by Default
Use React Server Components unless interactivity requires it. Client components are
marked with `"use client"` at the top of the file. Data fetching happens in server
components; client components receive data as props or use SWR/tanstack-query for
client-side mutations.

### 2. Prisma Query Layer in /lib/db/
All Prisma calls are in `/lib/db/*.ts` files — never inline in components or API
routes. This keeps the data layer testable and co-located by domain. Each file
exports async functions (e.g., `getEventById`, `listEventsByOrg`).

### 3. JWT Sessions (No Database Sessions)
NextAuth is configured with `strategy: "jwt"`. Sessions are stored in a signed
HttpOnly cookie. The JWT payload includes `id`, `role`, and `organizationId`.
This avoids needing a `Session` table and reduces DB reads per request.

**Rationale:** Credentials-only auth (no OAuth), small user base, role rarely
changes — JWT is sufficient. If OAuth providers are added later, reconsider.

### 4. No Prisma Adapter for NextAuth
We use a custom `authorize` callback instead of `@next-auth/prisma-adapter`.
This is because:
- Credentials-only flow doesn't need the adapter's OAuth account handling
- Avoids Prisma 7 / NextAuth v4 adapter compatibility uncertainty
- Simpler code; we control exactly what hits the database on sign-in

### 5. Prisma 5 (`prisma-client-js`)
The generated client lives in `node_modules/@prisma/client` (standard location).
Always import from `@prisma/client`.

The datasource URL is `env("DATABASE_URL")` in `schema.prisma`. The `.env` file
is used by the Prisma CLI and read by Next.js at runtime.

**Why not Prisma 7?** Prisma 7's new TypeScript-native client removed direct
database connections in favor of driver adapters. This added unnecessary complexity
for a time-constrained project. Prisma 5 is battle-tested and works exactly as
expected with NextAuth v4 and standard PostgreSQL.

### 6. Multi-Tenancy Ready
Every model has `organizationId`. The initial deployment is single-tenant,
but all queries should filter by `organizationId`. Row-level security can be
added at the PostgreSQL layer later without schema changes.

### 7. shadcn/ui Primitives
Files in `components/ui/` are owned by shadcn and should not be edited
manually — re-run `npx shadcn add <component>` to update them. Feature
components live in `components/<feature>/`.

### 8. Environment Variables
- `DATABASE_URL` — in `.env` (read by Prisma CLI and Next.js runtime)
- `NEXTAUTH_SECRET` — in `.env.local` (Next.js only)
- `NEXTAUTH_URL` — in `.env.local` (Next.js only)
- `RESEND_API_KEY` — must be added to Vercel environment variables before emails will send; get key at resend.com
- Production values set in Vercel dashboard; never committed to git

### 9. Strict TypeScript
`tsconfig.json` uses `"strict": true`. Avoid `any`; prefer `unknown` and
type narrowing. All Prisma query return types are inferred — do not re-declare.

### 10. API Route Convention
- All API routes: `app/api/<resource>/route.ts` (collection) and
  `app/api/<resource>/[id]/route.ts` (single item)
- Return `Response` objects (Next.js 14 native), not `NextResponse` where possible
- Authenticate with `getServerSession(authOptions)` at the top of every handler

---

## Role Permission Matrix

| Action | ADMIN | NAT_CHAIR | CH_CHAIR | CH_JUDGE | NAT_JUDGE | APPLICANT |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Manage org/users | ✓ | | | | | |
| Create/edit Events | ✓ | ✓ | | | | |
| Advance Event status | ✓ | ✓ | | | | |
| Manage chapter rounds | ✓ | ✓ | ✓ | | | |
| Submit application | | | | | | ✓ |
| View own application | | | | | | ✓ |
| Score (chapter) | | | | ✓ | | |
| Score (national) | | | | | ✓ | |
| View chapter scores | ✓ | ✓ | ✓ | ✓* | | |
| View national scores | ✓ | ✓ | | | ✓* | |
| Make final decision | ✓ | ✓ | | | | |

*Judges see only scores they submitted.

---

## Common Patterns

### Getting the session in a Server Component
```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const session = await getServerSession(authOptions);
if (!session) redirect("/login");
```

### Prisma query in /lib/db/
```ts
// lib/db/events.ts
import { prisma } from "@/lib/prisma";

export async function getEventsByOrg(organizationId: string) {
  return prisma.event.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}
```

### Authorization guard helper (future: lib/auth-guards.ts)
```ts
export function requireRole(session: Session, ...roles: Role[]) {
  if (!roles.includes(session.user.role)) {
    throw new Error("Unauthorized");
  }
}
```
