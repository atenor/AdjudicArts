"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// ─── Exported types ────────────────────────────────────────────────────────────

export type ProfileData = {
  applicantName: string;
  applicantEmail: string;
  chapter: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  schoolName: string;
  schoolCity: string;
  schoolState: string;
  highSchoolName: string;
  collegeName: string;
  major: string;
  bio: string;
  careerPlans: string;
  scholarshipUse: string;
  parentName: string;
  parentEmail: string;
  headshotUrl: string;
  voicePart: string;
  citizenshipStatus: string;
  citizenshipDocumentUrl: string;
  repertoire: string;
  adminNote: string;
  video1Title: string;
  video1Url: string;
  video2Title: string;
  video2Url: string;
  video3Title: string;
  video3Url: string;
};

export type ProfileViewUrls = {
  headshot?: string;
  citizenshipDocument?: string;
};

// ─── Internal types ────────────────────────────────────────────────────────────

type EditorState = ProfileData;

type SectionKey = "contact" | "education" | "bio" | "videos" | "documents" | "adminNote";

const SECTION_FIELDS: Record<SectionKey, (keyof EditorState)[]> = {
  contact: [
    "applicantName", "applicantEmail", "chapter", "dateOfBirth", "gender",
    "voicePart", "phone", "address", "city", "state", "zip", "parentName", "parentEmail",
  ],
  education: ["schoolName", "schoolCity", "schoolState", "highSchoolName", "collegeName", "major"],
  bio: ["bio", "careerPlans", "scholarshipUse"],
  videos: ["video1Title", "video1Url", "video2Title", "video2Url", "video3Title", "video3Url"],
  documents: ["headshotUrl", "citizenshipStatus", "citizenshipDocumentUrl"],
  adminNote: ["adminNote"],
};

// Sections that start collapsed
const COLLAPSIBLE_SECTIONS: SectionKey[] = ["contact", "education", "documents", "adminNote"];

// ─── Sub-components ─────────────────────────────────────────────────────────────

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-[#8b7ab5]">
        {label}
      </label>
      {children}
    </div>
  );
}

function SectionActions({
  sectionKey,
  editingSection,
  isSaving,
  serverError,
  onSave,
  onCancel,
}: {
  sectionKey: SectionKey;
  editingSection: SectionKey | null;
  isSaving: boolean;
  serverError: string | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (editingSection !== sectionKey) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#e5dbf3] pt-3">
      {serverError ? (
        <p className="text-sm font-medium text-[#b42318]">{serverError}</p>
      ) : (
        <span />
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-[#d7cde9] text-[#5f2ec8] hover:bg-[#f4effb]"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="bg-[#5f2ec8] text-white hover:bg-[#4f26a8]"
        >
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function valueOrDash(value: string | null | undefined) {
  if (!value || value.trim().length === 0) return "--";
  return value;
}

function formatDate(value: string) {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTraditionalPhone(value: string | null | undefined) {
  if (!value) return "--";
  const trimmed = value.trim();
  if (!trimmed) return "--";
  if (trimmed.includes("@")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return trimmed;
}

function formatPhoneOrEmail(value: string | null | undefined) {
  if (!value) return "--";
  const trimmed = value.trim();
  if (!trimmed) return "--";
  if (trimmed.includes("@")) return trimmed;
  const parts = trimmed.split(/[/,;]/).map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length === 0) return "--";
  return parts.map((p) => formatTraditionalPhone(p)).join(" / ");
}

function cx(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

const inputCls = "border-[#d7cde9] focus-visible:ring-[#5f2ec8]";

// ─── Main component ─────────────────────────────────────────────────────────────

export default function ApplicationProfileEditor({
  applicationId,
  canEdit,
  data,
  viewUrls,
  citizenshipVerificationNote,
  schoolStatus,
  altContact,
  altPhoneOrEmail,
  mediaRelease,
  hasMediaConsent,
  intakeResourceUrls,
  youtubePlaylist,
}: {
  applicationId: string;
  canEdit: boolean;
  data: ProfileData;
  viewUrls: ProfileViewUrls;
  citizenshipVerificationNote?: string | null;
  schoolStatus: string;
  altContact: string;
  altPhoneOrEmail: string;
  mediaRelease: string;
  hasMediaConsent: boolean;
  intakeResourceUrls: string[];
  youtubePlaylist: string;
}) {
  const router = useRouter();

  const [form, setForm] = useState<EditorState>({ ...data });
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedSection, setSavedSection] = useState<SectionKey | null>(null);

  function updateField<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleSection(key: SectionKey) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function startEditing(key: SectionKey) {
    setEditingSection(key);
    setExpandedSections((prev) => { const next = new Set(prev); next.add(key); return next; });
    setServerError(null);
    setSavedSection(null);
  }

  function cancelSection(key: SectionKey) {
    const fields = SECTION_FIELDS[key];
    const reset: Partial<EditorState> = {};
    for (const field of fields) {
      (reset as Record<string, unknown>)[field] = data[field];
    }
    setForm((current) => ({ ...current, ...reset }));
    setEditingSection(null);
    setServerError(null);
  }

  async function saveSectionFields(key: SectionKey) {
    setIsSaving(true);
    setServerError(null);

    const fields = SECTION_FIELDS[key];
    const body: Record<string, string> = {};
    const trimmedFields: Partial<EditorState> = {};
    for (const field of fields) {
      const trimmed = (form[field] as string).trim();
      body[field] = trimmed;
      (trimmedFields as Record<string, unknown>)[field] = trimmed;
    }

    try {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let message = "Unable to save changes.";
        try {
          const responseData = (await response.json()) as { error?: string };
          if (typeof responseData.error === "string" && responseData.error.trim()) {
            message = responseData.error;
          }
        } catch { /* no-op */ }
        setServerError(message);
        return;
      }

      setForm((current) => ({ ...current, ...trimmedFields }));
      setSavedSection(key);
      setEditingSection(null);
      router.refresh();
      setTimeout(() => setSavedSection((prev) => (prev === key ? null : prev)), 3000);
    } catch {
      setServerError("Unable to save changes.");
    } finally {
      setIsSaving(false);
    }
  }

  function editButton(key: SectionKey): ReactNode {
    if (!canEdit || editingSection !== null) return null;
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); startEditing(key); }}
        className="shrink-0 rounded-md border border-[#c7b6e5] px-2.5 py-1 text-xs font-semibold text-[#5f2ec8] hover:bg-[#f3ecff]"
      >
        Edit
      </button>
    );
  }

  const videos = [
    { title: form.video1Title, url: form.video1Url, num: 1 },
    { title: form.video2Title, url: form.video2Url, num: 2 },
    { title: form.video3Title, url: form.video3Url, num: 3 },
  ];

  // ── Collapsible section wrapper ────────────────────────────────────────────
  function Accordion({
    sectionKey,
    title,
    children,
  }: {
    sectionKey: SectionKey;
    title: string;
    children: ReactNode;
  }) {
    const isOpen = expandedSections.has(sectionKey) || editingSection === sectionKey;
    return (
      <div className="rounded-xl border border-[#d8cce9] bg-white">
        <div className="flex items-center justify-between p-3.5">
          <button
            type="button"
            onClick={() => toggleSection(sectionKey)}
            className="flex min-w-0 items-center gap-2 text-left"
          >
            <span className="text-[10px] text-[#9284b0]">{isOpen ? "▼" : "▶"}</span>
            <span className="text-sm font-bold tracking-wide text-[#5f2ec8]">{title}</span>
            {savedSection === sectionKey ? (
              <span className="ml-1 text-xs font-medium text-[#0d7b5f]">✓ Saved</span>
            ) : null}
          </button>
          {editButton(sectionKey)}
        </div>
        {isOpen ? (
          <div className="border-t border-[#e5dbf3] p-3.5">{children}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* ── PERFORMANCE VIDEOS ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#d8cce9] bg-white p-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-wide text-[#5f2ec8]">PERFORMANCE VIDEOS</h2>
          <div className="flex items-center gap-2">
            {youtubePlaylist ? (
              <a
                href={youtubePlaylist}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-[#4d2d91] bg-[#5f2ec8] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#5327b2]"
              >
                Playlist
              </a>
            ) : null}
            {editButton("videos")}
          </div>
        </div>

        {editingSection === "videos" ? (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {[
                { num: 1, titleKey: "video1Title" as const, urlKey: "video1Url" as const },
                { num: 2, titleKey: "video2Title" as const, urlKey: "video2Url" as const },
                { num: 3, titleKey: "video3Title" as const, urlKey: "video3Url" as const },
              ].map(({ num, titleKey, urlKey }) => (
                <div key={num} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#7b6e9d]">
                    Video {num}
                  </p>
                  <Field label="Title / Label" htmlFor={`video${num}-title`}>
                    <Input
                      id={`video${num}-title`}
                      value={form[titleKey]}
                      onChange={(e) => updateField(titleKey, e.target.value)}
                      className={inputCls}
                      placeholder="Title, Composer, Poet…"
                    />
                  </Field>
                  <Field label="YouTube URL" htmlFor={`video${num}-url`}>
                    <Input
                      id={`video${num}-url`}
                      value={form[urlKey]}
                      onChange={(e) => updateField(urlKey, e.target.value)}
                      className={inputCls}
                      placeholder="https://youtube.com/…"
                    />
                  </Field>
                </div>
              ))}
            </div>
            <SectionActions
              sectionKey="videos"
              editingSection={editingSection}
              isSaving={isSaving}
              serverError={serverError}
              onSave={() => void saveSectionFields("videos")}
              onCancel={() => cancelSection("videos")}
            />
          </>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {videos.map((video) => (
              <div
                key={video.num}
                className={cx(
                  "rounded-xl border p-3 space-y-1.5",
                  video.title || video.url
                    ? "border-[#d7cde9] bg-[#f8f4ff]"
                    : "border-dashed border-[#e2d8f0] bg-[#faf7ff]"
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[#9284b0]">
                  Video {video.num}
                </p>
                {video.title ? (
                  <p className="text-sm font-medium leading-snug text-[#1e1538]">{video.title}</p>
                ) : (
                  <p className="text-sm text-[#b0a0cc]">No title</p>
                )}
                {video.url ? (
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-xs text-[#5f2ec8] underline hover:text-[#4f26a8]"
                  >
                    {video.url}
                  </a>
                ) : (
                  <p className="text-xs text-[#b42318]">No URL</p>
                )}
              </div>
            ))}
          </div>
        )}
        {savedSection === "videos" ? (
          <p className="mt-2 text-sm font-medium text-[#0d7b5f]">Saved</p>
        ) : null}
      </div>

      {/* ── BIO & WRITTEN RESPONSES ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#d8cce9] bg-white p-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-wide text-[#5f2ec8]">BIO & WRITTEN RESPONSES</h2>
          {editButton("bio")}
        </div>

        {editingSection === "bio" ? (
          <>
            <div className="mt-4 space-y-4">
              <Field label="Bio" htmlFor="bio">
                <Textarea id="bio" rows={6} value={form.bio} onChange={(e) => updateField("bio", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Career Plans" htmlFor="career-plans">
                <Textarea id="career-plans" rows={5} value={form.careerPlans} onChange={(e) => updateField("careerPlans", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Use of Scholarship Funds" htmlFor="scholarship-use">
                <Textarea id="scholarship-use" rows={5} value={form.scholarshipUse} onChange={(e) => updateField("scholarshipUse", e.target.value)} className={inputCls} />
              </Field>
            </div>
            <SectionActions
              sectionKey="bio"
              editingSection={editingSection}
              isSaving={isSaving}
              serverError={serverError}
              onSave={() => void saveSectionFields("bio")}
              onCancel={() => cancelSection("bio")}
            />
          </>
        ) : (
          <div className="mt-3 space-y-5">
            <div>
              <h3 className="mb-1.5 text-sm font-bold text-[#3d2d72]">Biography</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1e1538]">
                {valueOrDash(form.bio)}
              </p>
            </div>
            {form.careerPlans.trim() ? (
              <div>
                <h3 className="mb-1.5 text-sm font-bold text-[#3d2d72]">Career Plans</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1e1538]">
                  {form.careerPlans}
                </p>
              </div>
            ) : null}
            {form.scholarshipUse.trim() ? (
              <div>
                <h3 className="mb-1.5 text-sm font-bold text-[#3d2d72]">Use of Scholarship Funds</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1e1538]">
                  {form.scholarshipUse}
                </p>
              </div>
            ) : null}
            {savedSection === "bio" ? (
              <p className="text-sm font-medium text-[#0d7b5f]">Saved</p>
            ) : null}
          </div>
        )}
      </div>

      {/* ── CONTACT & PERSONAL (collapsible) ─────────────────────────────────── */}
      <Accordion sectionKey="contact" title="CONTACT & PERSONAL">
        {editingSection === "contact" ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Applicant Name" htmlFor="applicant-name">
                <Input id="applicant-name" value={form.applicantName} onChange={(e) => updateField("applicantName", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Applicant Email" htmlFor="applicant-email">
                <Input id="applicant-email" type="email" value={form.applicantEmail} onChange={(e) => updateField("applicantEmail", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Chapter" htmlFor="chapter">
                <Input id="chapter" value={form.chapter} onChange={(e) => updateField("chapter", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Voice Part / Division" htmlFor="voice-part">
                <Input id="voice-part" value={form.voicePart} onChange={(e) => updateField("voicePart", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Date of Birth" htmlFor="date-of-birth">
                <Input id="date-of-birth" type="date" value={form.dateOfBirth} onChange={(e) => updateField("dateOfBirth", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Gender" htmlFor="gender">
                <Input id="gender" value={form.gender} onChange={(e) => updateField("gender", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Phone" htmlFor="phone">
                <Input id="phone" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Address" htmlFor="address">
                <Input id="address" value={form.address} onChange={(e) => updateField("address", e.target.value)} className={inputCls} />
              </Field>
              <Field label="City" htmlFor="city">
                <Input id="city" value={form.city} onChange={(e) => updateField("city", e.target.value)} className={inputCls} />
              </Field>
              <Field label="State" htmlFor="state">
                <Input id="state" value={form.state} onChange={(e) => updateField("state", e.target.value)} className={inputCls} />
              </Field>
              <Field label="ZIP" htmlFor="zip">
                <Input id="zip" value={form.zip} onChange={(e) => updateField("zip", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Parent / Guardian Name" htmlFor="parent-name">
                <Input id="parent-name" value={form.parentName} onChange={(e) => updateField("parentName", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Parent / Guardian Email" htmlFor="parent-email">
                <Input id="parent-email" type="email" value={form.parentEmail} onChange={(e) => updateField("parentEmail", e.target.value)} className={inputCls} />
              </Field>
            </div>
            <SectionActions
              sectionKey="contact"
              editingSection={editingSection}
              isSaving={isSaving}
              serverError={serverError}
              onSave={() => void saveSectionFields("contact")}
              onCancel={() => cancelSection("contact")}
            />
          </>
        ) : (
          <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {[
              { label: "Name", value: valueOrDash(form.applicantName) },
              { label: "Email", value: valueOrDash(form.applicantEmail) },
              { label: "Phone", value: formatTraditionalPhone(form.phone) },
              { label: "Date of Birth", value: formatDate(form.dateOfBirth) },
              {
                label: "Address",
                value: [form.address, form.city, form.state, form.zip].filter((p) => p?.trim()).join(", ") || "--",
              },
              { label: "Alt Contact", value: valueOrDash(altContact) },
              { label: "Alt Phone / Email", value: formatPhoneOrEmail(altPhoneOrEmail) },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[#9284b0]">{label}</dt>
                <dd className="mt-0.5 text-sm text-[#1e1538]">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {intakeResourceUrls.length > 0 && editingSection !== "contact" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {intakeResourceUrls.map((url, idx) => (
              <a
                key={`${url}-${idx}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-lg border border-[#c7b6e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#5f2ec8] hover:bg-[#f3ecff]"
              >
                Intake resource {idx + 1}
              </a>
            ))}
          </div>
        ) : null}
      </Accordion>

      {/* ── EDUCATION (collapsible) ───────────────────────────────────────────── */}
      <Accordion sectionKey="education" title="EDUCATION">
        {editingSection === "education" ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="School Name" htmlFor="school-name">
                <Input id="school-name" value={form.schoolName} onChange={(e) => updateField("schoolName", e.target.value)} className={inputCls} />
              </Field>
              <Field label="School City" htmlFor="school-city">
                <Input id="school-city" value={form.schoolCity} onChange={(e) => updateField("schoolCity", e.target.value)} className={inputCls} />
              </Field>
              <Field label="School State" htmlFor="school-state">
                <Input id="school-state" value={form.schoolState} onChange={(e) => updateField("schoolState", e.target.value)} className={inputCls} />
              </Field>
              <Field label="High School" htmlFor="high-school-name">
                <Input id="high-school-name" value={form.highSchoolName} onChange={(e) => updateField("highSchoolName", e.target.value)} className={inputCls} />
              </Field>
              <Field label="College / University" htmlFor="college-name">
                <Input id="college-name" value={form.collegeName} onChange={(e) => updateField("collegeName", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Major" htmlFor="major">
                <Input id="major" value={form.major} onChange={(e) => updateField("major", e.target.value)} className={inputCls} />
              </Field>
            </div>
            <SectionActions
              sectionKey="education"
              editingSection={editingSection}
              isSaving={isSaving}
              serverError={serverError}
              onSave={() => void saveSectionFields("education")}
              onCancel={() => cancelSection("education")}
            />
          </>
        ) : (
          <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {[
              { label: "College / University", value: valueOrDash(form.collegeName) },
              { label: "Major", value: valueOrDash(form.major) },
              { label: "High School", value: valueOrDash(form.highSchoolName) },
              { label: "Enrollment Status", value: valueOrDash(schoolStatus) },
              {
                label: "School Location",
                value: [form.schoolCity, form.schoolState].filter((p) => p?.trim()).join(", ") || "--",
              },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[#9284b0]">{label}</dt>
                <dd className="mt-0.5 text-sm text-[#1e1538]">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Accordion>

      {/* ── DOCUMENTS & ELIGIBILITY (collapsible) ────────────────────────────── */}
      <Accordion sectionKey="documents" title="DOCUMENTS & ELIGIBILITY">
        {editingSection === "documents" ? (
          <>
            <p className="mb-3 text-xs text-[#9284b0]">
              Stored values may be private blob references. Use the view links to inspect attached files.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Headshot Reference / URL" htmlFor="headshot-url">
                <Input id="headshot-url" value={form.headshotUrl} onChange={(e) => updateField("headshotUrl", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Citizenship / Residency Status" htmlFor="citizenship-status">
                <Input id="citizenship-status" value={form.citizenshipStatus} onChange={(e) => updateField("citizenshipStatus", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Citizenship Proof URL / Reference" htmlFor="citizenship-document-url">
                <Input id="citizenship-document-url" value={form.citizenshipDocumentUrl} onChange={(e) => updateField("citizenshipDocumentUrl", e.target.value)} className={inputCls} />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {viewUrls.headshot ? (
                <a href={viewUrls.headshot} target="_blank" rel="noreferrer" className="inline-flex rounded-md border border-[#c7b6e5] bg-white px-2.5 py-1 text-xs font-semibold text-[#5f2ec8] hover:bg-[#f3ecff]">
                  View headshot
                </a>
              ) : null}
              {viewUrls.citizenshipDocument ? (
                <a href={viewUrls.citizenshipDocument} target="_blank" rel="noreferrer" className="inline-flex rounded-md border border-[#c7b6e5] bg-white px-2.5 py-1 text-xs font-semibold text-[#5f2ec8] hover:bg-[#f3ecff]">
                  View citizenship document
                </a>
              ) : null}
            </div>
            <SectionActions
              sectionKey="documents"
              editingSection={editingSection}
              isSaving={isSaving}
              serverError={serverError}
              onSave={() => void saveSectionFields("documents")}
              onCancel={() => cancelSection("documents")}
            />
          </>
        ) : (
          <>
            <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              {[
                { label: "Headshot", value: viewUrls.headshot ? "Photo on file" : "No headshot" },
                { label: "Citizenship / Residency", value: valueOrDash(form.citizenshipStatus) },
                { label: "Citizenship Proof", value: viewUrls.citizenshipDocument ? "Document on file" : "No document" },
                { label: "Verification Status", value: citizenshipVerificationNote ?? "Not yet verified" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#9284b0]">{label}</dt>
                  <dd className="mt-0.5 text-sm text-[#1e1538]">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {viewUrls.headshot ? (
                <a href={viewUrls.headshot} target="_blank" rel="noreferrer" className="inline-flex rounded-lg border border-[#c7b6e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#5f2ec8] hover:bg-[#f3ecff]">
                  View headshot
                </a>
              ) : null}
              {viewUrls.citizenshipDocument ? (
                <a href={viewUrls.citizenshipDocument} target="_blank" rel="noreferrer" className="inline-flex rounded-lg border border-[#c7b6e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#5f2ec8] hover:bg-[#f3ecff]">
                  View citizenship document
                </a>
              ) : null}
            </div>
            {mediaRelease ? (
              <p className="mt-3 text-xs text-[#6d5b91]">
                Media Release: {hasMediaConsent ? "Consented" : mediaRelease}
              </p>
            ) : null}
          </>
        )}
      </Accordion>

      {/* ── ADMIN NOTE (collapsible, hidden when empty and not editor) ─────────── */}
      {form.adminNote.trim().length > 0 || canEdit ? (
        <Accordion sectionKey="adminNote" title="ADMIN NOTE">
          {editingSection === "adminNote" ? (
            <>
              <Field label="Note" htmlFor="admin-note">
                <Textarea id="admin-note" rows={4} value={form.adminNote} onChange={(e) => updateField("adminNote", e.target.value)} className={inputCls} />
              </Field>
              <SectionActions
                sectionKey="adminNote"
                editingSection={editingSection}
                isSaving={isSaving}
                serverError={serverError}
                onSave={() => void saveSectionFields("adminNote")}
                onCancel={() => cancelSection("adminNote")}
              />
            </>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1e1538]">
              {valueOrDash(form.adminNote)}
            </p>
          )}
        </Accordion>
      ) : null}
    </div>
  );
}
