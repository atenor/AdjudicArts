"use client";

import { useMemo, useState } from "react";
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

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );

  async function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setResult(null);
    setPurgeResult(null);
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
        setError(data?.error?.formErrors?.[0] ?? data?.error ?? "Unable to preview CSV.");
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

    setError(null);
    setResult(null);
    setPurgeResult(null);
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
        setError(data?.error?.formErrors?.[0] ?? data?.error ?? "Unable to import CSV.");
        return;
      }

      setResult(data);
    } catch {
      setError("Unable to import CSV.");
    } finally {
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
        setError(data?.error ?? "Unable to purge event applications.");
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
          <Button type="button" onClick={importAll} disabled={!csvData || isImporting || previewRows.length === 0}>
            {isImporting ? "Importing..." : "Import All"}
          </Button>
          {fileName ? (
            <span className="text-muted-foreground">Selected: {fileName}</span>
          ) : null}
        </div>
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
          <p className="text-sm">
            {result.imported} imported, {result.errors.length} errors
          </p>
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
