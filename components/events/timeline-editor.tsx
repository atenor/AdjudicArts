'use client';

import { useState, useCallback } from 'react';
import type { Prisma } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimelineEntry {
  date: string;   // ISO date string (yyyy-MM-dd)
  title: string;
  details: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseEntries(raw: Prisma.JsonValue | null | undefined): TimelineEntry[] {
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as unknown[]).filter((item): item is TimelineEntry =>
    typeof item === 'object' &&
    item !== null &&
    'date' in item &&
    'title' in item &&
    'details' in item &&
    Array.isArray((item as TimelineEntry).details)
  );
}

function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isPast(isoDate: string): boolean {
  if (!isoDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(isoDate + 'T00:00:00') < today;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TimelineEditorProps {
  event: { id: string; timeline: Prisma.JsonValue | null };
  readOnly?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TimelineEditor({ event, readOnly = false }: TimelineEditorProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>(() => parseEntries(event.timeline));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const save = useCallback(async (updated: TimelineEntry[]) => {
    setSaving(true);
    setSaved(false);
    setSaveError('');
    try {
      const res = await fetch(`/api/events/${event.id}/timeline`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeline: updated }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [event.id]);

  // ── Read-only view ──────────────────────────────────────────────────────────

  if (readOnly) {
    if (entries.length === 0) return null;
    return (
      <div className="space-y-0">
        {entries.map((entry, i) => {
          const past = isPast(entry.date);
          const isLast = i === entries.length - 1;
          return (
            <div key={i} className="flex gap-4">
              {/* Dot + connector line */}
              <div className="flex flex-col items-center pt-0.5">
                <div
                  className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                    past
                      ? 'bg-primary border-primary'
                      : 'bg-background border-muted-foreground/50'
                  }`}
                />
                {!isLast && <div className="w-px flex-1 bg-border mt-1 mb-0" />}
              </div>
              {/* Entry content */}
              <div className={`pb-5 min-w-0 ${isLast ? 'pb-0' : ''}`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs text-muted-foreground">
                    {formatDisplayDate(entry.date)}
                  </span>
                  {past && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                      Past
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium leading-snug">{entry.title}</p>
                {entry.details.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 list-disc list-inside">
                    {entry.details.map((d, j) => (
                      <li key={j} className="text-xs text-muted-foreground">{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Edit helpers ────────────────────────────────────────────────────────────

  function addEntry() {
    setEntries(prev => [...prev, { date: '', title: '', details: [] }]);
  }

  function removeEntry(i: number) {
    setEntries(prev => prev.filter((_, idx) => idx !== i));
  }

  function moveEntry(i: number, dir: -1 | 1) {
    setEntries(prev => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function updateField(i: number, field: 'date' | 'title', value: string) {
    setEntries(prev =>
      prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e))
    );
  }

  function addDetail(i: number) {
    setEntries(prev =>
      prev.map((e, idx) => (idx === i ? { ...e, details: [...e.details, ''] } : e))
    );
  }

  function updateDetail(i: number, j: number, value: string) {
    setEntries(prev =>
      prev.map((e, idx) =>
        idx === i
          ? { ...e, details: e.details.map((d, di) => (di === j ? value : d)) }
          : e
      )
    );
  }

  function removeDetail(i: number, j: number) {
    setEntries(prev =>
      prev.map((e, idx) =>
        idx === i ? { ...e, details: e.details.filter((_, di) => di !== j) } : e
      )
    );
  }

  // ── Edit view ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground">No timeline entries yet.</p>
      )}

      {entries.map((entry, i) => (
        <div key={i} className="border rounded-lg p-4 space-y-3 bg-muted/20">
          {/* Entry header */}
          <div className="flex items-start gap-2">
            {/* Up / Down */}
            <div className="flex flex-col gap-0.5 pt-1 shrink-0">
              <button
                type="button"
                onClick={() => moveEntry(i, -1)}
                disabled={i === 0}
                aria-label="Move entry up"
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none text-[10px]"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moveEntry(i, 1)}
                disabled={i === entries.length - 1}
                aria-label="Move entry down"
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none text-[10px]"
              >
                ▼
              </button>
            </div>
            {/* Date + Title */}
            <div className="flex-1 grid grid-cols-[140px_1fr] gap-2">
              <input
                type="date"
                value={entry.date}
                onChange={e => updateField(i, 'date', e.target.value)}
                className="border rounded-md px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="text"
                placeholder="Entry title"
                value={entry.title}
                onChange={e => updateField(i, 'title', e.target.value)}
                className="border rounded-md px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {/* Remove */}
            <button
              type="button"
              onClick={() => removeEntry(i)}
              className="text-xs text-muted-foreground hover:text-destructive shrink-0 pt-1.5"
            >
              Remove
            </button>
          </div>

          {/* Bullet details */}
          <div className="pl-7 space-y-1.5">
            {entry.details.map((detail, j) => (
              <div key={j} className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs shrink-0">•</span>
                <input
                  type="text"
                  value={detail}
                  onChange={e => updateDetail(i, j, e.target.value)}
                  placeholder="Detail line"
                  className="flex-1 border rounded-md px-2 py-1 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => removeDetail(i, j)}
                  className="text-muted-foreground hover:text-destructive text-xs shrink-0"
                  aria-label="Remove detail"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addDetail(i)}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              + Add detail
            </button>
          </div>
        </div>
      ))}

      {/* Footer actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={addEntry}
          className="text-sm border rounded-md px-3 py-1.5 hover:bg-accent transition-colors"
        >
          + Add entry
        </button>
        <button
          type="button"
          onClick={() => save(entries)}
          disabled={saving}
          className="text-sm bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Timeline'}
        </button>
        {saved && (
          <span className="text-xs text-green-600 font-medium">Saved ✓</span>
        )}
        {saveError && (
          <span className="text-xs text-destructive">{saveError}</span>
        )}
      </div>
    </div>
  );
}
