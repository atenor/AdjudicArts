const DIVISION_16_18 = "16-18";
const DIVISION_19_22 = "19-22";

export type ApplicationDivision = typeof DIVISION_16_18 | typeof DIVISION_19_22;

function normalizeDivisionValue(value: string | null | undefined): ApplicationDivision | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return null;

  if (
    normalized.includes("16-18") ||
    normalized.includes("16 – 18") ||
    normalized.includes("16 to 18")
  ) {
    return DIVISION_16_18;
  }

  if (
    normalized.includes("19-22") ||
    normalized.includes("19 – 22") ||
    normalized.includes("19 to 22")
  ) {
    return DIVISION_19_22;
  }

  return null;
}

function getAge(dateOfBirth: Date | null | undefined, now = new Date()): number | null {
  if (!dateOfBirth) return null;

  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const monthDelta = now.getMonth() - dateOfBirth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dateOfBirth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function getRawCsvDivision(notes: string | null | undefined): ApplicationDivision | null {
  if (!notes) return null;

  try {
    const parsed = JSON.parse(notes) as {
      importProfile?: { rawCsv?: Record<string, unknown> };
    };
    const rawCsv = parsed.importProfile?.rawCsv;
    if (!rawCsv || typeof rawCsv !== "object") return null;

    for (const [key, rawValue] of Object.entries(rawCsv)) {
      const normalizedKey = key.toLowerCase();
      if (
        normalizedKey.includes("division") ||
        normalizedKey.includes("age group") ||
        normalizedKey.includes("category")
      ) {
        const match = normalizeDivisionValue(String(rawValue ?? ""));
        if (match) return match;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function resolveApplicationDivision(input: {
  notes?: string | null;
  dateOfBirth?: Date | null;
}): ApplicationDivision | null {
  const fromCsv = getRawCsvDivision(input.notes ?? null);
  if (fromCsv) return fromCsv;

  const age = getAge(input.dateOfBirth ?? null);
  if (age === null) return null;
  if (age >= 16 && age <= 18) return DIVISION_16_18;
  if (age >= 19 && age <= 22) return DIVISION_19_22;
  return null;
}

export function formatDivisionLabel(division: ApplicationDivision | null) {
  if (!division) return "Division Unassigned";
  return `Division ${division}`;
}

