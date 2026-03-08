export const dynamic = 'force-dynamic';

import {
  getPublicEventForApply,
  createPublicApplication,
  findPriorDivisionFirstPlace,
  hasExistingApplication,
} from "@/lib/db/applications";
import { EventStatus } from "@prisma/client";
import { sendApplicationConfirmation } from "@/lib/email";
import { notifyApplicationSubmitted } from "@/lib/db/notifications";
import { applicantIntakeSchema } from "@/lib/validation/apply";
import { getCompetitionCutoffDate, resolveApplicationDivision } from "@/lib/application-division";

export async function POST(
  request: Request,
  { params }: { params: { eventId: string } }
) {
  const event = await getPublicEventForApply(params.eventId);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.status !== EventStatus.OPEN) {
    return Response.json(
      { error: "Applications are currently closed" },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = applicantIntakeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const {
    name,
    email,
    dateOfBirth,
    gender,
    phone,
    address,
    city,
    state,
    zip,
    chapter,
    schoolName,
    schoolCity,
    schoolState,
    highSchoolName,
    collegeName,
    major,
    voicePart,
    video1PieceTitle,
    video1Composer,
    video1Poet,
    video1Language,
    video1Style,
    video1Url,
    video2PieceTitle,
    video2Composer,
    video2Poet,
    video2Language,
    video2Style,
    video2Url,
    video3PieceTitle,
    video3Composer,
    video3Poet,
    video3Language,
    video3Style,
    video3Url,
    headshotUrl,
    bio,
    careerPlans,
    scholarshipUse,
    parentName,
    parentEmail,
    citizenshipStatus,
    citizenshipDocumentUrl,
    mediaRelease,
    certifyDateOfBirth,
    hasPriorFirstPrize,
    priorFirstPrizeDivision,
    prizeWinnerCertification,
    acceptPrivacyPolicy,
    acceptTerms,
  } =
    parsed.data;

  function composeVideoLabel(title: string, composer: string, poet?: string | null) {
    const base = `${title.trim()} - ${composer.trim()}`;
    const cleanedPoet = poet?.trim();
    if (!cleanedPoet) return base;
    return `${base} (Poem by ${cleanedPoet})`;
  }

  const currentDivision = resolveApplicationDivision({
    dateOfBirth: new Date(dateOfBirth),
    competitionDate: getCompetitionCutoffDate({
      openAt: event.openAt,
      closeAt: event.closeAt,
    }),
  });

  if (
    hasPriorFirstPrize &&
    priorFirstPrizeDivision &&
    currentDivision &&
    priorFirstPrizeDivision === currentDivision
  ) {
    return Response.json(
      {
        error:
          "Applicants may not re-enter a division where they have already won first place.",
      },
      { status: 409 }
    );
  }

  const alreadyApplied = await hasExistingApplication(event.id, email);
  if (alreadyApplied) {
    return Response.json(
      { error: "An application with this email already exists for this event" },
      { status: 409 }
    );
  }

  const priorDivisionWin = await findPriorDivisionFirstPlace({
    organizationId: event.organizationId,
    currentEventId: event.id,
    email,
    dateOfBirth: new Date(dateOfBirth),
    currentDivision,
  });

  if (priorDivisionWin) {
    return Response.json(
      {
        error: `Previous first-place winners may not compete again in Division ${priorDivisionWin.division}. Prior result: ${priorDivisionWin.eventName}.`,
      },
      { status: 409 }
    );
  }

  const application = await createPublicApplication({
    eventId: event.id,
    organizationId: event.organizationId,
    name,
    email,
    chapter,
    dateOfBirth: new Date(dateOfBirth),
    gender: gender || null,
    voicePart,
    phone,
    address,
    city,
    state,
    zip,
    schoolName: schoolName || null,
    schoolCity: schoolCity || null,
    schoolState: schoolState || null,
    highSchoolName: highSchoolName || null,
    collegeName: collegeName || null,
    major: major || null,
    video1Title: composeVideoLabel(video1PieceTitle, video1Composer, video1Poet),
    video1Url,
    video2Title: composeVideoLabel(video2PieceTitle, video2Composer, video2Poet),
    video2Url,
    video3Title: composeVideoLabel(video3PieceTitle, video3Composer, video3Poet),
    video3Url,
    headshotUrl: headshotUrl || null,
    bio,
    careerPlans,
    scholarshipUse,
    parentName: parentName || null,
    parentEmail: parentEmail || null,
    citizenshipStatus,
    citizenshipDocumentUrl: citizenshipDocumentUrl || null,
    mediaRelease,
    certifyDateOfBirth,
    hasPriorFirstPrize,
    priorFirstPrizeDivision: priorFirstPrizeDivision || null,
    prizeWinnerCertification,
    videoLanguages: [video1Language, video2Language, video3Language],
    videoStyles: [video1Style, video2Style, video3Style],
    acceptPrivacyPolicy,
    acceptTerms,
  });

  const statusUrl = `${process.env.NEXTAUTH_URL ?? ""}/status/${application.id}`;
  try {
    await sendApplicationConfirmation(email, name, event.name, application.id, statusUrl);
  } catch {
    // Email failure must never break the submission flow
  }

  notifyApplicationSubmitted({
    organizationId: event.organizationId,
    applicationId: application.id,
    applicantName: name,
    applicantEmail: email,
    chapter,
    eventName: event.name,
  }).catch(() => {
    // Notification failure must never break the submission flow
  });

  return Response.json({ success: true, applicationId: application.id }, { status: 201 });
}
