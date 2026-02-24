"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ImportableEvent = {
  id: string;
  name: string;
  status: string;
  openAt: Date | null;
  closeAt: Date | null;
};

type PreviewRow = {
  firstName: string;
  lastName: string;
  email: string;
  chapter: string;
  playlist: string;
};

type ImportResult = {
  totalRows: number;
  imported: number;
  createdUsers: number;
  createdApplications: number;
  updatedApplications: number;
  errors: Array<{ row: number; email?: string; message: string }>;
};

type PurgeResult = {
  deletedApplications: number;
  deletedScores: number;
  deletedApplicants: number;
};

type ImportStatus = "idle" | "running" | "success" | "error";

function extractApiError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const obj = payload as Record<string, unknown>;
  const error = obj.error;

  if (typeof error === "string" && error.trim().length > 0) return error;
  if (error && typeof error === "object") {
    const errorObj = error as Record<string, unknown>;
    const formErrors = errorObj.formErrors;
    if (Array.isArray(formErrors)) {
      const first = formErrors.find(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
      );
      if (first) return first;
    }

    const fieldErrors = errorObj.fieldErrors;
    if (fieldErrors && typeof fieldErrors === "object") {
      for (const value of Object.values(fieldErrors as Record<string, unknown>)) {
        if (Array.isArray(value)) {
          const first = value.find(
            (entry): entry is string =>
              typeof entry === "string" && entry.trim().length > 0
          );
          if (first) return first;
        }
      }
    }
  }

  return fallback;
}

export default function ImportApplicationsForm({
  events,
}: {
  events: ImportableEvent[];
}) {
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? "");
  const [fileName, setFileName] = useState("");
  const [csvData, setCsvData] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [purgeResult, setPurgeResult] = useState<PurgeResult | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importProgress, setImportProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastImportedSignature, setLastImportedSignature] = useState<string | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );

  const importSignature = useMemo(
    () =>
      `${selectedEventId}|${fileName}|${previewTotal ?? 0}|${previewRows[0]?.email ?? ""}|${
        csvData.length
      }`,
    [selectedEventId, fileName, previewTotal, previewRows, csvData.length]
  );

  const alreadyImportedCurrentFile = lastImportedSignature === importSignature;

  function stopProgressTicker() {
    if (progressIntervalRef.current !== null) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }

  function startProgressTicker() {
    stopProgressTicker();
    progressIntervalRef.current = window.setInterval(() => {
      setImportProgress((current) => (current >= 92 ? current : current + 4));
    }, 280);
  }

  useEffect(
    () => () => {
      stopProgressTicker();
    },
    []
  );

  async function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setResult(null);
    setPurgeResult(null);
    setImportStatus("idle");
    setStatusMessage(null);
    setImportProgress(0);
    stopProgressTicker();
    setLastImportedSignature(null);
    setPreviewRows([]);
    setPreviewTotal(null);

    const file = event.target.files?.[0];
    if (!file) {
      setFileName("");
      setCsvData("");
      return;
    }

    setFileName(file.name);
    const text = await file.text();
    setCsvData(text);
  }

  async function requestPreview() {
    if (!csvData || !selectedEventId) return;

    setError(null);
    setResult(null);
    setPurgeResult(null);
    setImportStatus("idle");
    setStatusMessage(null);
    setImportProgress(0);
    stopProgressTicker();
    setLastImportedSignature(null);
    setIsPreviewLoading(true);

    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "preview",
          csvData,
          eventId: selectedEventId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(extractApiError(data, "Unable to preview CSV."));
        return;
      }

      setPreviewRows(data.preview ?? []);
      setPreviewTotal(data.totalRows ?? 0);
    } catch {
      setError("Unable to preview CSV.");
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function importAll() {
    if (!csvData || !selectedEventId) return;
    if (alreadyImportedCurrentFile) {
      const confirmed = window.confirm(
        "This file already appears to have been imported for this event. Import again anyway?"
      );
      if (!confirmed) return;
    }

    setError(null);
    setResult(null);
    setPurgeResult(null);
    setImportStatus("running");
    setStatusMessage("Import in progress...");
    setImportProgress(8);
    startProgressTicker();
    setIsImporting(true);

    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "import",
          csvData,
          eventId: selectedEventId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const message = extractApiError(data, "Unable to import CSV.");
        setError(message);
        setImportStatus("error");
        setImportProgress(100);
        setStatusMessage(`Import failed: ${message}`);
        return;
      }

      setResult(data);
      setImportStatus("success");
      setImportProgress(100);
      if ((data?.errors?.length ?? 0) > 0) {
        setStatusMessage(`Import complete with ${data.errors.length} row error(s).`);
      } else {
        setStatusMessage("Import completed successfully.");
      }
      setLastImportedSignature(importSignature);
    } catch {
      setError("Unable to import CSV.");
      setImportStatus("error");
      setImportProgress(100);
      setStatusMessage("Import failed: network or server error.");
    } finally {
      stopProgressTicker();
      setIsImporting(false);
    }
  }

  async function purgeEvent() {
    if (!selectedEventId) return;
    const ok = window.confirm(
      "Delete ALL applications for this event? This also removes related scores and orphan applicant accounts."
    );
    if (!ok) return;

    setError(null);
    setResult(null);
    setPurgeResult(null);
    setImportStatus("idle");
    setStatusMessage(null);
    setImportProgress(0);
    stopProgressTicker();
    setLastImportedSignature(null);
    setIsImporting(true);

    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "purge",
          eventId: selectedEventId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(extractApiError(data, "Unable to purge event applications."));
        return;
      }
      setPurgeResult(data);
      setPreviewRows([]);
      setPreviewTotal(null);
      setCsvData("");
      setFileName("");
    } catch {
      setError("Unable to purge event applications.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 rounded-lg border p-4">
        <h2 className="font-medium">Upload CSV</h2>
        <p className="text-sm text-muted-foreground">
          Choose a target event, upload a CSV, preview the first 5 rows, then import.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Event</span>
            <select
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3"
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} ({event.status.toLowerCase()})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">CSV file</span>
            <Input type="file" accept=".csv,text/csv" onChange={onPickFile} />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button type="button" variant="outline" onClick={requestPreview} disabled={!csvData || isPreviewLoading}>
            {isPreviewLoading ? "Loading preview..." : "Preview"}
          </Button>
          <Button
            type="button"
            onClick={importAll}
            disabled={!csvData || isImporting || previewRows.length === 0}
          >
            {isImporting
              ? "Importing..."
              : alreadyImportedCurrentFile
                ? "Import Again"
                : "Import All"}
          </Button>
          {fileName ? (
            <span className="text-muted-foreground">Selected: {fileName}</span>
          ) : null}
          {alreadyImportedCurrentFile ? (
            <span className="text-emerald-700">This file is already imported for this event.</span>
          ) : null}
        </div>
        {(importStatus !== "idle" || isImporting) && (
          <div className="space-y-1 pt-1">
            <div className="h-2 w-full overflow-hidden rounded bg-muted">
              <div
                className={`h-full transition-all duration-300 ${
                  importStatus === "error" ? "bg-destructive" : "bg-primary"
                }`}
                style={{ width: `${importProgress}%` }}
              />
            </div>
            <p
              className={`text-xs ${
                importStatus === "error"
                  ? "text-destructive"
                  : importStatus === "success"
                    ? "text-emerald-700"
                    : "text-muted-foreground"
              }`}
            >
              {statusMessage ?? "Import in progress..."}
            </p>
          </div>
        )}
        <div>
          <Button
            type="button"
            variant="destructive"
            onClick={purgeEvent}
            disabled={!selectedEventId || isImporting}
          >
            {isImporting ? "Working..." : "Delete All Participants For This Event"}
          </Button>
        </div>

        {selectedEvent ? (
          <p className="text-xs text-muted-foreground">
            Target event: <span className="font-medium text-foreground">{selectedEvent.name}</span>
          </p>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      {previewRows.length > 0 ? (
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Preview</h3>
            <span className="text-sm text-muted-foreground">
              Showing first {previewRows.length} of {previewTotal ?? previewRows.length}
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Chapter</TableHead>
                <TableHead>Playlist</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, index) => (
                <TableRow key={`${row.email}-${index}`}>
                  <TableCell>{`${row.firstName} ${row.lastName}`.trim()}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.chapter || "—"}</TableCell>
                  <TableCell className="max-w-[24rem] truncate">{row.playlist || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {result ? (
        <div className="space-y-2 rounded-lg border p-4">
          <h3 className="font-medium">Import Results</h3>
          <p className={`text-sm ${result.errors.length > 0 ? "text-amber-700" : ""}`}>
            {result.imported} imported, {result.errors.length} errors
          </p>
          {result.imported === 0 ? (
            <p className="text-sm text-destructive font-medium">
              No rows were imported. Review the row errors below.
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Created users: {result.createdUsers} | Created applications: {result.createdApplications} | Updated applications: {result.updatedApplications}
          </p>

          {result.errors.length > 0 ? (
            <div className="max-h-64 overflow-y-auto rounded border p-2">
              <ul className="space-y-1 text-sm">
                {result.errors.map((entry, index) => (
                  <li key={`${entry.row}-${entry.email ?? index}`}>
                    Row {entry.row}
                    {entry.email ? ` (${entry.email})` : ""}: {entry.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {purgeResult ? (
        <div className="space-y-2 rounded-lg border p-4">
          <h3 className="font-medium">Purge Results</h3>
          <p className="text-sm">
            Deleted applications: {purgeResult.deletedApplications}
          </p>
          <p className="text-sm text-muted-foreground">
            Deleted scores: {purgeResult.deletedScores} | Deleted applicants: {purgeResult.deletedApplicants}
          </p>
        </div>
      ) : null}
    </div>
  );
}
