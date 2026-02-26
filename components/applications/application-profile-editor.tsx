"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type VideoEntry = {
  id: "video1" | "video2" | "video3";
  title: string;
  url: string;
};

function reorderEntries(entries: VideoEntry[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= entries.length || to >= entries.length) {
    return entries;
  }
  const next = [...entries];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export default function ApplicationProfileEditor({
  applicationId,
  initialApplicantName,
  initialChapter,
  initialAdminNote,
  initialVideo1Title,
  initialVideo1Url,
  initialVideo2Title,
  initialVideo2Url,
  initialVideo3Title,
  initialVideo3Url,
}: {
  applicationId: string;
  initialApplicantName: string;
  initialChapter: string;
  initialAdminNote: string;
  initialVideo1Title: string;
  initialVideo1Url: string;
  initialVideo2Title: string;
  initialVideo2Url: string;
  initialVideo3Title: string;
  initialVideo3Url: string;
}) {
  const router = useRouter();
  const [applicantName, setApplicantName] = useState(initialApplicantName);
  const [chapter, setChapter] = useState(initialChapter);
  const [adminNote, setAdminNote] = useState(initialAdminNote);
  const [videoEntries, setVideoEntries] = useState<VideoEntry[]>([
    { id: "video1", title: initialVideo1Title, url: initialVideo1Url },
    { id: "video2", title: initialVideo2Title, url: initialVideo2Url },
    { id: "video3", title: initialVideo3Title, url: initialVideo3Url },
  ]);
  const [editingVideoOrder, setEditingVideoOrder] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  function updateVideoEntry(index: number, patch: Partial<VideoEntry>) {
    setVideoEntries((prev) =>
      prev.map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              ...patch,
            }
          : entry
      )
    );
  }

  function resetVideoOrder() {
    setVideoEntries([
      { id: "video1", title: initialVideo1Title, url: initialVideo1Url },
      { id: "video2", title: initialVideo2Title, url: initialVideo2Url },
      { id: "video3", title: initialVideo3Title, url: initialVideo3Url },
    ]);
    setEditingVideoOrder(false);
    setDraggingIndex(null);
  }

  function moveVideo(index: number, direction: -1 | 1) {
    const destination = index + direction;
    setVideoEntries((prev) => reorderEntries(prev, index, destination));
  }

  async function onSave() {
    setIsSaving(true);
    setServerError(null);
    setShowSaved(false);
    try {
      const [video1, video2, video3] = videoEntries;
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantName: applicantName.trim(),
          chapter: chapter.trim(),
          adminNote: adminNote.trim(),
          video1Title: video1?.title.trim() ?? "",
          video1Url: video1?.url.trim() ?? "",
          video2Title: video2?.title.trim() ?? "",
          video2Url: video2?.url.trim() ?? "",
          video3Title: video3?.title.trim() ?? "",
          video3Url: video3?.url.trim() ?? "",
        }),
      });

      if (!response.ok) {
        setServerError("Unable to save profile changes.");
        return;
      }

      setShowSaved(true);
      setEditingVideoOrder(false);
      router.refresh();
    } catch {
      setServerError("Unable to save profile changes.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#d8cce9] bg-white p-4">
      <h2 className="text-lg font-semibold text-[#1e1538]">Profile Editor</h2>
      <div className="mt-3 space-y-3">
        <div className="space-y-2 rounded-lg border border-[#d7cde9] bg-[#f8f4ff] p-3">
          <p className="text-sm font-semibold text-[#5f4d87]">Chapter Assignment</p>
          <div className="space-y-1.5">
            <label htmlFor="applicant-name" className="text-sm font-medium text-[#5f4d87]">
              Applicant Name
            </label>
            <Input
              id="applicant-name"
              value={applicantName}
              onChange={(event) => setApplicantName(event.target.value)}
              placeholder="First Last"
              className="border-[#d7cde9] focus-visible:ring-[#5f2ec8]"
            />
          </div>
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
        </div>

        <div className="space-y-2 rounded-lg border border-[#d7cde9] bg-[#f8f4ff] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#5f4d87]">Video Order Corrections</p>
            {editingVideoOrder ? (
              <Button
                type="button"
                variant="outline"
                className="h-8 border-[#d7cde9] bg-white text-[#5f4d87] hover:bg-[#f3ecff]"
                onClick={resetVideoOrder}
              >
                Cancel
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-8 border-[#d7cde9] bg-white text-[#5f4d87] hover:bg-[#f3ecff]"
                onClick={() => setEditingVideoOrder(true)}
              >
                Edit
              </Button>
            )}
          </div>

          {editingVideoOrder ? (
            <>
              <p className="text-xs text-[#7b6e9d]">
                Drag and drop to reorder videos. You can also use Up/Down for touch devices.
              </p>
              <div className="space-y-2">
                {videoEntries.map((entry, index) => (
                  <div
                    key={entry.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggingIndex === null) return;
                      setVideoEntries((prev) => reorderEntries(prev, draggingIndex, index));
                      setDraggingIndex(null);
                    }}
                    onDragEnd={() => setDraggingIndex(null)}
                    className="space-y-2 rounded-lg border border-[#d7cde9] bg-white p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold tracking-wide text-[#7b6e9d]">
                        Video {index + 1}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[#7b6e9d]">Reorder</span>
                        <button
                          type="button"
                          draggable
                          onDragStart={() => setDraggingIndex(index)}
                          onDragEnd={() => setDraggingIndex(null)}
                          className="cursor-grab rounded border border-[#d7cde9] px-2 py-0.5 text-xs font-semibold text-[#6b5a92] hover:bg-[#f3ecff]"
                          aria-label={`Drag to reorder video ${index + 1}`}
                          title={`Drag to reorder video ${index + 1}`}
                        >
                          Drag
                        </button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-7 border-[#d7cde9] bg-white px-2 text-xs text-[#5f4d87] hover:bg-[#f3ecff]"
                          onClick={() => moveVideo(index, -1)}
                          disabled={index === 0}
                        >
                          Up
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-7 border-[#d7cde9] bg-white px-2 text-xs text-[#5f4d87] hover:bg-[#f3ecff]"
                          onClick={() => moveVideo(index, 1)}
                          disabled={index === videoEntries.length - 1}
                        >
                          Down
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold tracking-wide text-[#7b6e9d]">
                          Video title
                        </label>
                        <Input
                          value={entry.title}
                          onChange={(event) =>
                            updateVideoEntry(index, { title: event.target.value })
                          }
                          placeholder={`Video ${index + 1} title`}
                          className="border-[#d7cde9] focus-visible:ring-[#5f2ec8]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold tracking-wide text-[#7b6e9d]">
                          YouTube URL
                        </label>
                        <Input
                          value={entry.url}
                          onChange={(event) =>
                            updateVideoEntry(index, { url: event.target.value })
                          }
                          placeholder={`https://www.youtube.com/watch?v=...`}
                          className="border-[#d7cde9] focus-visible:ring-[#5f2ec8]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {videoEntries.map((entry, index) => (
                <div key={entry.id} className="rounded-lg border border-[#d7cde9] bg-white p-2.5">
                  <p className="text-xs font-semibold tracking-wide text-[#7b6e9d]">
                    Video {index + 1}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#1e1538]">
                    {entry.title.trim() || `Video ${index + 1} title not set`}
                  </p>
                  <p className="mt-1 truncate text-xs text-[#5f2ec8]">
                    {entry.url.trim() || "No URL set"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5 rounded-lg border border-[#d7cde9] bg-[#f8f4ff] p-3">
          <label htmlFor="admin-note" className="text-sm font-semibold text-[#5f4d87]">
            General Admin Notes
          </label>
          <Textarea
            id="admin-note"
            value={adminNote}
            onChange={(event) => setAdminNote(event.target.value)}
            placeholder="General profile notes (sponsorship, special handling, follow-ups, etc.)"
            className="min-h-[120px] border-[#d7cde9] bg-white focus-visible:ring-[#5f2ec8]"
          />
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
