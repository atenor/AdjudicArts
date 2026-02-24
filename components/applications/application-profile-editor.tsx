"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ApplicationProfileEditor({
  applicationId,
  initialChapter,
  initialAdminNote,
}: {
  applicationId: string;
  initialChapter: string;
  initialAdminNote: string;
}) {
  const router = useRouter();
  const [chapter, setChapter] = useState(initialChapter);
  const [adminNote, setAdminNote] = useState(initialAdminNote);
  const [isSaving, setIsSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  async function onSave() {
    setIsSaving(true);
    setServerError(null);
    setShowSaved(false);
    try {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapter: chapter.trim(),
          adminNote: adminNote.trim(),
        }),
      });

      if (!response.ok) {
        setServerError("Unable to save profile changes.");
        return;
      }

      setShowSaved(true);
      router.refresh();
    } catch {
      setServerError("Unable to save profile changes.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#d8cce9] bg-white p-4">
      <h2 className="text-lg font-semibold text-[#1e1538]">Profile Notes & Chapter Edit</h2>
      <div className="mt-3 space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="chapter" className="text-sm font-medium text-[#5f4d87]">
            Chapter
          </label>
          <Input
            id="chapter"
            value={chapter}
            onChange={(event) => setChapter(event.target.value)}
            placeholder="Example: Washington DC Chapter"
            className="border-[#d7cde9] focus-visible:ring-[#5f2ec8]"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="admin-note" className="text-sm font-medium text-[#5f4d87]">
            Admin Note
          </label>
          <Textarea
            id="admin-note"
            value={adminNote}
            onChange={(event) => setAdminNote(event.target.value)}
            placeholder="Example: Applicant had no chapter and was assigned sponsorship by DC chapter."
            className="min-h-[110px] border-[#d7cde9] focus-visible:ring-[#5f2ec8]"
          />
          <p className="text-xs text-[#7b6e9d]">
            Use this to document reassignment notes (ex: no chapter to sponsored chapter).
          </p>
        </div>

        <Button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="w-full bg-gradient-to-r from-[#5f2ec8] to-[#462b7c] text-white hover:from-[#5327b2] hover:to-[#3e256f]"
        >
          {isSaving ? "Saving..." : "Save Profile Updates"}
        </Button>

        {showSaved ? <p className="text-sm text-emerald-700">Saved.</p> : null}
        {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
      </div>
    </section>
  );
}
