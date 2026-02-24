export type RepertoireEntry = {
  title: string;
  composer: string | null;
  poet: string | null;
  detail: string | null;
  raw: string;
};

function splitPieces(repertoire: string): string[] {
  if (repertoire.includes("\n")) {
    return repertoire
      .split("\n")
      .map((piece) => piece.trim())
      .filter(Boolean);
  }

  if (repertoire.includes(";")) {
    return repertoire
      .split(/\s*;\s*/)
      .map((piece) => piece.trim())
      .filter(Boolean);
  }

  return repertoire
    .split(/\),\s*/)
    .map((piece, index, pieces) => (index < pieces.length - 1 ? `${piece})` : piece))
    .map((piece) => piece.trim())
    .filter(Boolean);
}

function parseMeta(meta: string) {
  const cleaned = meta.trim();
  if (!cleaned) return { composer: null, poet: null, detail: null };

  const composerMatch = cleaned.match(
    /(?:composer|music by)\s*[:\-]?\s*([^;|/]+)/i
  );
  const poetMatch = cleaned.match(
    /(?:poet|text by|words by|poetry by)\s*[:\-]?\s*([^;|/]+)/i
  );

  if (composerMatch || poetMatch) {
    const composer = composerMatch?.[1]?.trim() || null;
    const poet = poetMatch?.[1]?.trim() || null;
    return { composer, poet, detail: null };
  }

  const parts = cleaned
    .split(/\s*(?:\/|;|\|)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 1) {
    return { composer: parts[0], poet: null, detail: null };
  }

  if (parts.length === 2) {
    return { composer: parts[0], poet: parts[1], detail: null };
  }

  return {
    composer: parts[0] ?? null,
    poet: parts[1] ?? null,
    detail: parts.slice(2).join(" · ") || null,
  };
}

function parsePiece(piece: string): RepertoireEntry {
  const cleaned = piece
    .replace(/^\d+\s*[\)\.\-:]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return { title: "", composer: null, poet: null, detail: null, raw: piece };
  }

  const parenMatch = cleaned.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (parenMatch) {
    const title = parenMatch[1].trim();
    const { composer, poet, detail } = parseMeta(parenMatch[2]);
    return { title, composer, poet, detail, raw: cleaned };
  }

  const dashMatch = cleaned.match(/^(.*?)\s*[—-]\s*(.+)$/);
  if (dashMatch) {
    const title = dashMatch[1].trim();
    const { composer, poet, detail } = parseMeta(dashMatch[2]);
    return { title, composer, poet, detail, raw: cleaned };
  }

  return { title: cleaned, composer: null, poet: null, detail: null, raw: cleaned };
}

export function parseRepertoireEntries(repertoire: string | null) {
  if (!repertoire) return [] as RepertoireEntry[];
  const normalized = repertoire.replace(/\r/g, "").trim();
  if (!normalized) return [] as RepertoireEntry[];

  return splitPieces(normalized)
    .map(parsePiece)
    .filter((entry) => entry.title.length > 0);
}
