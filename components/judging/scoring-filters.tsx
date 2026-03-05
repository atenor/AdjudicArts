"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  hasActiveFilters: boolean;
  division?: string;
  view: "detailed" | "compact";
  layout: "grouped" | "combined";
  sort: "submitted" | "bookmarked" | "voice-part" | "chapter" | "name";
  voicePart: string;
  bookmarksOnly: boolean;
  availableVoiceParts: string[];
};

export default function ScoringFilters({
  hasActiveFilters,
  division,
  view,
  layout,
  sort,
  voicePart,
  bookmarksOnly,
  availableVoiceParts,
}: Props) {
  const router = useRouter();
  const [nextDivision, setNextDivision] = useState(division ?? "");
  const [nextView, setNextView] = useState<Props["view"]>(view);
  const [nextLayout, setNextLayout] = useState<Props["layout"]>(layout);
  const [nextSort, setNextSort] = useState<Props["sort"]>(sort);
  const [nextVoicePart, setNextVoicePart] = useState(voicePart);
  const [nextBookmarks, setNextBookmarks] = useState(bookmarksOnly ? "only" : "");

  const hasAnyValue = useMemo(
    () =>
      Boolean(nextDivision) ||
      Boolean(nextVoicePart) ||
      nextSort !== "submitted" ||
      nextBookmarks === "only" ||
      nextLayout !== "grouped" ||
      nextView !== "detailed",
    [nextBookmarks, nextDivision, nextLayout, nextSort, nextView, nextVoicePart]
  );

  function apply() {
    const params = new URLSearchParams();
    if (nextView !== "detailed") params.set("view", nextView);
    if (nextDivision) params.set("division", nextDivision);
    if (nextVoicePart) params.set("voicePart", nextVoicePart);
    if (nextSort !== "submitted") params.set("sort", nextSort);
    if (nextBookmarks === "only") params.set("bookmarks", "only");
    if (nextLayout !== "grouped") params.set("layout", nextLayout);

    const query = params.toString();
    router.push(query ? `/dashboard/scoring?${query}` : "/dashboard/scoring");
  }

  function clear() {
    setNextDivision("");
    setNextView("detailed");
    setNextLayout("grouped");
    setNextSort("submitted");
    setNextVoicePart("");
    setNextBookmarks("");
    router.push("/dashboard/scoring");
  }

  return (
    <details className="max-w-[46rem]">
      <summary className="inline-flex cursor-pointer items-center rounded-lg border border-[#d9cdea] bg-[#f8f4ff] px-3 py-1 text-sm font-semibold tracking-[0.02em] text-[#4f26a8] shadow-sm">
        Filters {hasActiveFilters ? "• Active" : ""}
      </summary>

      <div className="mt-3 grid gap-3 rounded-lg border border-[#d9cdea] bg-[#f8f4ff] p-3 shadow-sm sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#7c68ab]">
          Division
          <Select
            value={nextDivision || "all"}
            onValueChange={(value) => setNextDivision(value === "all" ? "" : value)}
          >
            <SelectTrigger className="h-10 border-[#d8cce9] bg-white text-sm font-medium text-[#1e1538]">
              <SelectValue placeholder="All divisions" />
            </SelectTrigger>
            <SelectContent className="border-[#d8cce9] bg-white text-[#1e1538]">
              <SelectItem value="all">All divisions</SelectItem>
              <SelectItem value="16-18">Division 16-18</SelectItem>
              <SelectItem value="19-22">Division 19-22</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#7c68ab]">
          View
          <Select value={nextView} onValueChange={(value) => setNextView(value as Props["view"])}>
            <SelectTrigger className="h-10 border-[#d8cce9] bg-white text-sm font-medium text-[#1e1538]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-[#d8cce9] bg-white text-[#1e1538]">
              <SelectItem value="detailed">Detailed</SelectItem>
              <SelectItem value="compact">Compact</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#7c68ab]">
          Layout
          <Select value={nextLayout} onValueChange={(value) => setNextLayout(value as Props["layout"])}>
            <SelectTrigger className="h-10 border-[#d8cce9] bg-white text-sm font-medium text-[#1e1538]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-[#d8cce9] bg-white text-[#1e1538]">
              <SelectItem value="grouped">Grouped by division</SelectItem>
              <SelectItem value="combined">Combined list</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#7c68ab]">
          Sort
          <Select value={nextSort} onValueChange={(value) => setNextSort(value as Props["sort"])}>
            <SelectTrigger className="h-10 border-[#d8cce9] bg-white text-sm font-medium text-[#1e1538]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-[#d8cce9] bg-white text-[#1e1538]">
              <SelectItem value="submitted">Submission order</SelectItem>
              <SelectItem value="bookmarked">Bookmarked first</SelectItem>
              <SelectItem value="voice-part">Voice part</SelectItem>
              <SelectItem value="chapter">Chapter</SelectItem>
              <SelectItem value="name">Applicant name</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#7c68ab]">
          Voice part
          <Select value={nextVoicePart || "all"} onValueChange={(value) => setNextVoicePart(value === "all" ? "" : value)}>
            <SelectTrigger className="h-10 border-[#d8cce9] bg-white text-sm font-medium text-[#1e1538]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-[#d8cce9] bg-white text-[#1e1538]">
              <SelectItem value="all">All voice parts</SelectItem>
              {availableVoiceParts.map((voice) => (
                <SelectItem key={voice} value={voice}>
                  {voice}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#7c68ab]">
          Bookmarks
          <Select value={nextBookmarks || "all"} onValueChange={(value) => setNextBookmarks(value === "all" ? "" : value)}>
            <SelectTrigger className="h-10 border-[#d8cce9] bg-white text-sm font-medium text-[#1e1538]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-[#d8cce9] bg-white text-[#1e1538]">
              <SelectItem value="all">All applicants</SelectItem>
              <SelectItem value="only">Bookmarked only</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button
          type="button"
          onClick={apply}
          className="border border-[#5f2ec8] bg-[#5f2ec8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#4f26a8]"
        >
          Apply filters
        </Button>
        {(hasActiveFilters || hasAnyValue) ? (
          <Button
            type="button"
            onClick={clear}
            variant="outline"
            className="border-[#d8cce9] bg-white px-3 py-2 text-sm font-semibold text-[#5f2ec8] hover:bg-[#f5f1fd]"
          >
            Clear
          </Button>
        ) : null}
      </div>
    </details>
  );
}
