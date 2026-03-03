export const dynamic = 'force-dynamic';

import type { Metadata } from "next";
import {
  getPublicEventForApply,
  listPublicApplicationChapters,
} from "@/lib/db/applications";

export const metadata: Metadata = { title: "Apply" };
import { EventStatus } from "@prisma/client";
import ApplyForm from "@/components/applications/apply-form";

export default async function ApplyPage({
  params,
}: {
  params: { eventId: string };
}) {
  const event = await getPublicEventForApply(params.eventId);

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <div className="rounded-xl border border-[#d8cce9] bg-white px-8 py-10 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#7f6aa9]">
            AdjudicArts
          </p>
          <p className="mt-4 text-base text-muted-foreground">Event not found.</p>
        </div>
      </div>
    );
  }

  if (event.status !== EventStatus.OPEN) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-xl rounded-xl border border-[#d8cce9] bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#7f6aa9]">
            AdjudicArts
          </p>
          <h1 className="mt-4 text-2xl font-semibold text-[#1e1538]">{event.name}</h1>
          <p className="mt-2 text-muted-foreground">Applications are currently closed.</p>
        </div>
      </div>
    );
  }

  const availableChapters = await listPublicApplicationChapters(event.organizationId);

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="rounded-xl border border-[#d8cce9] bg-white shadow-sm">
          <div className="border-b border-[#e7def3] px-6 py-5 sm:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#7f6aa9]">
              AdjudicArts
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#1e1538]">
              {event.name}
            </h1>
            {event.description ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {event.description}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 px-6 py-5 sm:px-8 lg:grid-cols-3">
            <div className="rounded-lg border border-[#e7def3] bg-[#faf8ff] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7f6aa9]">
                Submission
              </p>
              <p className="mt-2 text-sm text-[#4a3d6b]">
                Complete the full applicant profile in one sitting.
              </p>
            </div>
            <div className="rounded-lg border border-[#e7def3] bg-[#faf8ff] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7f6aa9]">
                Materials
              </p>
              <p className="mt-2 text-sm text-[#4a3d6b]">
                Prepare three video links, a headshot, and citizenship or residency proof.
              </p>
            </div>
            <div className="rounded-lg border border-[#e7def3] bg-[#faf8ff] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7f6aa9]">
                Eligibility
              </p>
              <p className="mt-2 text-sm text-[#4a3d6b]">
                Applicants must be 22 or younger as of March 1 and prior first-place
                winners may not re-enter the same division.
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-4xl">
          <ApplyForm eventId={event.id} availableChapters={availableChapters} />
        </div>
      </div>
    </div>
  );
}
