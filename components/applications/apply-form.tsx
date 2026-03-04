"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  applicantIntakeSchema,
  type ApplicantIntakeValues,
  CITIZENSHIP_STATUS_OPTIONS,
  PRIOR_WIN_DIVISION_OPTIONS,
  VOICE_PART_OPTIONS,
} from "@/lib/validation/apply";

type UploadField = "headshotUrl" | "citizenshipDocumentUrl";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

function getApiErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "Something went wrong. Please try again.";
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string") {
    return record.error;
  }

  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>;
    const fieldErrors = nested.fieldErrors;
    if (fieldErrors && typeof fieldErrors === "object") {
      for (const value of Object.values(fieldErrors as Record<string, unknown>)) {
        if (Array.isArray(value) && typeof value[0] === "string") {
          return value[0];
        }
      }
    }
    if (Array.isArray(nested.formErrors) && typeof nested.formErrors[0] === "string") {
      return nested.formErrors[0];
    }
  }

  return "Something went wrong. Please try again.";
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a7aa9]">
        Section
      </p>
      <h3 className="text-lg font-semibold tracking-wide text-[#2a2147]">{title}</h3>
      {description ? <p className="text-sm leading-6 text-[#7b6e9d]">{description}</p> : null}
    </div>
  );
}

function UploadFieldCard({
  inputId,
  label,
  helperText,
  buttonText,
  isUploading,
  uploadedFile,
  onChange,
}: {
  inputId: string;
  label: string;
  helperText: string;
  buttonText: string;
  isUploading: boolean;
  uploadedFile?: { name: string; url: string };
  onChange: (files: FileList | null) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId} className="text-[#5f4d87]">
        {label}
      </Label>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        onChange={(event) => onChange(event.target.files)}
      />
      <div className="rounded-xl border border-[#d7cde9] bg-white p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label
            htmlFor={inputId}
            className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#efe7ff] px-4 py-2 text-sm font-semibold text-[#4e3195] transition hover:bg-[#e7dcff]"
          >
            {isUploading ? "Uploading..." : buttonText}
          </label>
          <div className="min-w-0 flex-1">
            {uploadedFile ? (
              <>
                <p className="text-sm font-medium text-[#2f7a4b]">
                  Upload complete. This image will be submitted.
                </p>
                <p className="truncate text-sm text-[#4a3d6b]">
                  {uploadedFile.name}
                </p>
              </>
            ) : (
              <p className="text-sm text-[#7b6e9d]">No image uploaded yet.</p>
            )}
          </div>
        </div>
      </div>
      <p className="text-xs text-[#7b6e9d]">{helperText}</p>
    </div>
  );
}

export default function ApplyForm({
  eventId,
  availableChapters,
}: {
  eventId: string;
  availableChapters: string[];
}) {
  const [submitted, setSubmitted] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<UploadField | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<
    Partial<Record<UploadField, { name: string; url: string }>>
  >({});

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ApplicantIntakeValues>({
    resolver: zodResolver(applicantIntakeSchema),
    defaultValues: {
      gender: "",
      schoolName: "",
      schoolCity: "",
      schoolState: "",
      highSchoolName: "",
      collegeName: "",
      major: "",
      parentName: "",
      parentEmail: "",
      hasPriorFirstPrize: false,
      priorFirstPrizeDivision: "",
    },
  });
  const hasPriorFirstPrize = watch("hasPriorFirstPrize");

  async function onSubmit(data: ApplicantIntakeValues) {
    setServerError(null);
    const res = await fetch(`/api/apply/${eventId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      setApplicationId((body as { applicationId?: string }).applicationId ?? null);
      setSubmitted(true);
      return;
    }

    const body = await res.json().catch(() => ({}));
    setServerError(getApiErrorMessage(body));
  }

  async function uploadImage(field: UploadField, file: File) {
    setServerError(null);
    setUploadingField(field);

    const form = new FormData();
    form.append("file", file);

    const uploadField = field === "headshotUrl" ? "headshot" : "citizenship-proof";
    const response = await fetch(
      `/api/uploads?field=${uploadField}&eventId=${encodeURIComponent(eventId)}`,
      {
        method: "POST",
        body: form,
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setUploadingField(null);
      setServerError(getApiErrorMessage(payload));
      return;
    }

    const url =
      payload &&
      typeof payload === "object" &&
      typeof (payload as { url?: unknown }).url === "string"
        ? (payload as { url: string }).url
        : null;

    if (!url) {
      setUploadingField(null);
      setServerError("Upload completed, but no file URL was returned.");
      return;
    }

    setValue(field, url, { shouldValidate: true, shouldDirty: true });
    setUploadedFiles((current) => ({
      ...current,
      [field]: {
        name: file.name,
        url,
      },
    }));
    setUploadingField(null);
  }

  async function onSelectUpload(field: UploadField, fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    await uploadImage(field, file);
  }

  if (submitted) {
    return (
      <Card className="rounded-xl border border-[#d8cce9] bg-white shadow-sm">
        <CardContent className="space-y-3 pt-6 text-center">
          <p className="text-lg font-medium text-[#1e1538]">Application submitted.</p>
          <p className="text-[#7b6e9d]">
            Your application has been submitted and is ready for review.
          </p>
          {applicationId ? (
            <Link
              href={`/status/${applicationId}`}
              className="inline-block text-sm font-medium text-[#5f2ec8] underline underline-offset-4"
            >
              Check your application status
            </Link>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-[1.5rem] border border-[#d8cce9] bg-white shadow-[0_18px_48px_rgba(65,45,110,0.12)]">
      <CardHeader className="border-b border-[#e7def3] bg-[linear-gradient(135deg,#2d1d55_0%,#4e3195_58%,#6b47c7_100%)] px-6 py-6 text-white">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#dbc36d]">
            AdjudicArts Application
          </p>
          <CardTitle className="text-3xl font-semibold tracking-tight text-white">
            Application
          </CardTitle>
          <p className="max-w-2xl text-sm leading-6 text-white/78">
            Submit your materials in one complete intake. Your application will enter
            the live adjudication workflow exactly as reviewers see it.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <section className="space-y-4 rounded-[1.25rem] border border-[#e7def3] bg-[linear-gradient(180deg,#fcfbff_0%,#f8f4ff_100%)] p-5">
            <SectionHeading
              title="Applicant Information"
              description="Applicants must be age 22 or younger as of March 1. Prior first-place winners may not re-enter the same division."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="name" className="text-[#5f4d87]">Full Name *</Label>
                <Input id="name" autoComplete="name" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("name")} />
                <FieldError message={errors.name?.message} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="email" className="text-[#5f4d87]">Email *</Label>
                <Input id="email" type="email" autoComplete="email" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("email")} />
                <FieldError message={errors.email?.message} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="dateOfBirth" className="text-[#5f4d87]">Date of Birth *</Label>
                <Input id="dateOfBirth" type="date" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("dateOfBirth")} />
                <FieldError message={errors.dateOfBirth?.message} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="gender" className="text-[#5f4d87]">Gender / Pronouns</Label>
                <Input id="gender" placeholder="Optional" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("gender")} />
                <FieldError message={errors.gender?.message} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="voicePart" className="text-[#5f4d87]">Voice Part *</Label>
                <select
                  id="voicePart"
                  {...register("voicePart")}
                  className="flex h-9 w-full rounded-md border border-[#d7cde9] bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-[#5f2ec8]"
                >
                  <option value="">Select voice part...</option>
                  {VOICE_PART_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.voicePart?.message} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="chapter" className="text-[#5f4d87]">Chapter *</Label>
                <select
                  id="chapter"
                  {...register("chapter")}
                  className="flex h-9 w-full rounded-md border border-[#d7cde9] bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-[#5f2ec8]"
                >
                  <option value="">Select chapter...</option>
                  {availableChapters.map((chapter) => (
                    <option key={chapter} value={chapter}>
                      {chapter}
                    </option>
                  ))}
                </select>
                {availableChapters.length === 0 ? (
                  <p className="text-xs text-[#7b6e9d]">
                    Chapter options are not available yet for this event. Contact the
                    organization before submitting.
                  </p>
                ) : null}
                <FieldError message={errors.chapter?.message} />
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="hasPriorFirstPrize" className="text-[#5f4d87]">
                  Have you previously won 1st place in this competition? *
                </Label>
                <select
                  id="hasPriorFirstPrize"
                  className="flex h-9 w-full rounded-md border border-[#d7cde9] bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-[#5f2ec8]"
                  {...register("hasPriorFirstPrize", {
                    setValueAs: (value) => value === "true",
                  })}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
                <FieldError message={errors.hasPriorFirstPrize?.message} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="priorFirstPrizeDivision" className="text-[#5f4d87]">
                  If yes, which division?
                </Label>
                <select
                  id="priorFirstPrizeDivision"
                  {...register("priorFirstPrizeDivision")}
                  disabled={!hasPriorFirstPrize}
                  className="flex h-9 w-full rounded-md border border-[#d7cde9] bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-[#5f2ec8] disabled:cursor-not-allowed disabled:bg-[#f5f2fb]"
                >
                  <option value="">Select division...</option>
                  {PRIOR_WIN_DIVISION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.priorFirstPrizeDivision?.message} />
              </div>
            </div>
            <input type="hidden" {...register("headshotUrl")} />
            <input type="hidden" {...register("citizenshipDocumentUrl")} />
          </section>

          <section className="space-y-4 rounded-[1.25rem] border border-[#e7def3] bg-[linear-gradient(180deg,#fcfbff_0%,#f8f4ff_100%)] p-5">
            <SectionHeading title="Contact Information" />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-[#5f4d87]">Phone *</Label>
                <Input id="phone" type="tel" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("phone")} />
                <FieldError message={errors.phone?.message} />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="address" className="text-[#5f4d87]">Street Address *</Label>
                <Input id="address" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("address")} />
                <FieldError message={errors.address?.message} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="city" className="text-[#5f4d87]">City *</Label>
                <Input id="city" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("city")} />
                <FieldError message={errors.city?.message} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="state" className="text-[#5f4d87]">State / Province *</Label>
                <Input id="state" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("state")} />
                <FieldError message={errors.state?.message} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="zip" className="text-[#5f4d87]">ZIP / Postal Code *</Label>
                <Input id="zip" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("zip")} />
                <FieldError message={errors.zip?.message} />
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-[1.25rem] border border-[#e7def3] bg-[linear-gradient(180deg,#fcfbff_0%,#f8f4ff_100%)] p-5">
            <SectionHeading title="Education and Training" />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="schoolName" className="text-[#5f4d87]">School Name</Label>
                <Input id="schoolName" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("schoolName")} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="schoolCity" className="text-[#5f4d87]">School City</Label>
                <Input id="schoolCity" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("schoolCity")} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="schoolState" className="text-[#5f4d87]">School State</Label>
                <Input id="schoolState" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("schoolState")} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="highSchoolName" className="text-[#5f4d87]">High School Name</Label>
                <Input id="highSchoolName" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("highSchoolName")} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="collegeName" className="text-[#5f4d87]">College / University Name</Label>
                <Input id="collegeName" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("collegeName")} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="major" className="text-[#5f4d87]">Major</Label>
                <Input id="major" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("major")} />
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-[1.25rem] border border-[#e7def3] bg-[linear-gradient(180deg,#fcfbff_0%,#f8f4ff_100%)] p-5">
            <SectionHeading
              title="Submission Materials"
              description="Provide three video submissions and your supporting materials."
            />
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="video1Title" className="text-[#5f4d87]">Video 1 Title, Composer, and Poet (if applicable) *</Label>
                  <Input id="video1Title" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("video1Title")} />
                  <FieldError message={errors.video1Title?.message} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="videoUrl1" className="text-[#5f4d87]">Video 1 URL *</Label>
                  <Input id="videoUrl1" placeholder="https://www.youtube.com/watch?v=..." className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("video1Url")} />
                  <FieldError message={errors.video1Url?.message} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="video2Title" className="text-[#5f4d87]">Video 2 Title, Composer, and Poet (if applicable) *</Label>
                  <Input id="video2Title" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("video2Title")} />
                  <FieldError message={errors.video2Title?.message} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="videoUrl2" className="text-[#5f4d87]">Video 2 URL *</Label>
                  <Input id="videoUrl2" placeholder="https://www.youtube.com/watch?v=..." className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("video2Url")} />
                  <FieldError message={errors.video2Url?.message} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="video3Title" className="text-[#5f4d87]">Video 3 Title, Composer, and Poet (if applicable) *</Label>
                  <Input id="video3Title" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("video3Title")} />
                  <FieldError message={errors.video3Title?.message} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="videoUrl3" className="text-[#5f4d87]">Video 3 URL *</Label>
                  <Input id="videoUrl3" placeholder="https://www.youtube.com/watch?v=..." className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("video3Url")} />
                  <FieldError message={errors.video3Url?.message} />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <UploadFieldCard
                    inputId="headshotFile"
                    label="Headshot Image Upload *"
                    helperText="One image only. JPG, PNG, WEBP, or HEIC up to 10MB."
                    buttonText="Choose Headshot"
                    isUploading={uploadingField === "headshotUrl"}
                    uploadedFile={uploadedFiles.headshotUrl}
                    onChange={(files) => void onSelectUpload("headshotUrl", files)}
                  />
                  <FieldError message={errors.headshotUrl?.message} />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-[1.25rem] border border-[#e7def3] bg-[linear-gradient(180deg,#fcfbff_0%,#f8f4ff_100%)] p-5">
            <SectionHeading title="Written Responses" />
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="bio" className="text-[#5f4d87]">Biography *</Label>
                <Textarea id="bio" rows={5} className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("bio")} />
                <FieldError message={errors.bio?.message} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="careerPlans" className="text-[#5f4d87]">Future Career Plans *</Label>
                <Textarea id="careerPlans" rows={4} className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("careerPlans")} />
                <FieldError message={errors.careerPlans?.message} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="scholarshipUse" className="text-[#5f4d87]">How will you use the scholarship funds? *</Label>
                <Textarea id="scholarshipUse" rows={4} className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("scholarshipUse")} />
                <FieldError message={errors.scholarshipUse?.message} />
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-[1.25rem] border border-[#e7def3] bg-[linear-gradient(180deg,#fcfbff_0%,#f8f4ff_100%)] p-5">
            <SectionHeading title="Parent / Guardian Information" description="Required for applicants under 18." />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="parentName" className="text-[#5f4d87]">Parent / Guardian Name</Label>
                <Input id="parentName" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("parentName")} />
                <FieldError message={errors.parentName?.message} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="parentEmail" className="text-[#5f4d87]">Parent / Guardian Email</Label>
                <Input id="parentEmail" type="email" className="border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]" {...register("parentEmail")} />
                <FieldError message={errors.parentEmail?.message} />
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-[1.25rem] border border-[#e7def3] bg-[linear-gradient(180deg,#fcfbff_0%,#f8f4ff_100%)] p-5">
            <SectionHeading title="Eligibility and Supporting Documents" />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="citizenshipStatus" className="text-[#5f4d87]">Citizenship / Residency Status *</Label>
                <select
                  id="citizenshipStatus"
                  {...register("citizenshipStatus")}
                  className="flex h-9 w-full rounded-md border border-[#d7cde9] bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-[#5f2ec8]"
                >
                  <option value="">Select status...</option>
                  {CITIZENSHIP_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.citizenshipStatus?.message} />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="citizenshipDocumentFile" className="text-[#5f4d87]">Citizenship / Residency Proof Image *</Label>
                <UploadFieldCard
                  inputId="citizenshipDocumentFile"
                  label="Citizenship / Residency Proof Image *"
                  helperText="One image only. Upload a single image of your citizenship or residency proof."
                  buttonText="Choose Proof Image"
                  isUploading={uploadingField === "citizenshipDocumentUrl"}
                  uploadedFile={uploadedFiles.citizenshipDocumentUrl}
                  onChange={(files) =>
                    void onSelectUpload("citizenshipDocumentUrl", files)
                  }
                />
                <FieldError message={errors.citizenshipDocumentUrl?.message} />
              </div>

            </div>
          </section>

          <section className="space-y-3 rounded-[1.25rem] border border-[#e7def3] bg-[linear-gradient(180deg,#fcfbff_0%,#f8f4ff_100%)] p-5">
            <SectionHeading title="Review Before Submit" />
            <label className="flex items-start gap-3 text-sm text-[#4a3d6b]">
              <input type="checkbox" className="mt-1 h-4 w-4 rounded border-[#bca9df]" {...register("mediaRelease")} />
              <span>
                I grant AdjudicArts and the presenting organization permission to review,
                use, and share my submitted media for adjudication, administrative review,
                and program communications.
              </span>
            </label>
            <FieldError message={errors.mediaRelease?.message} />

            <label className="flex items-start gap-3 text-sm text-[#4a3d6b]">
              <input type="checkbox" className="mt-1 h-4 w-4 rounded border-[#bca9df]" {...register("certifyDateOfBirth")} />
              <span>
                I certify that my date of birth is accurate and understand eligibility is determined
                from age on March 1.
              </span>
            </label>
            <FieldError message={errors.certifyDateOfBirth?.message} />

            <label className="flex items-start gap-3 text-sm text-[#4a3d6b]">
              <input type="checkbox" className="mt-1 h-4 w-4 rounded border-[#bca9df]" {...register("certifyAccuracy")} />
              <span>I certify that the information in this application is accurate.</span>
            </label>
            <FieldError message={errors.certifyAccuracy?.message} />

            <label className="flex items-start gap-3 text-sm text-[#4a3d6b]">
              <input type="checkbox" className="mt-1 h-4 w-4 rounded border-[#bca9df]" {...register("acceptPrivacyPolicy")} />
              <span>
                I acknowledge the{" "}
                <Link href="/privacy" className="font-medium text-[#5f2ec8] underline underline-offset-4">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            <FieldError message={errors.acceptPrivacyPolicy?.message} />

            <label className="flex items-start gap-3 text-sm text-[#4a3d6b]">
              <input type="checkbox" className="mt-1 h-4 w-4 rounded border-[#bca9df]" {...register("acceptTerms")} />
              <span>
                I agree to the{" "}
                <Link href="/terms" className="font-medium text-[#5f2ec8] underline underline-offset-4">
                  Submission Terms
                </Link>
                {" "}and understand materials may be reviewed by program staff and adjudicators.
              </span>
            </label>
            <FieldError message={errors.acceptTerms?.message} />
          </section>

          {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

          <div className="rounded-[1.25rem] border border-[#e7def3] bg-[#fffaf0] p-4">
            <p className="text-sm text-[#6b5a23]">
              Review every section before submitting. This intake becomes the official
              application record for adjudicators and administrators.
            </p>
          </div>

          <Button
            type="submit"
            className="h-11 w-full rounded-xl bg-[linear-gradient(135deg,#c8a74a_0%,#d9bf62_100%)] text-base font-semibold text-[#1d1433] shadow-[0_12px_24px_rgba(201,168,72,0.28)] hover:brightness-[0.98]"
            disabled={isSubmitting || uploadingField !== null}
          >
            {isSubmitting ? "Submitting..." : uploadingField ? "Uploading..." : "Submit Application"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
