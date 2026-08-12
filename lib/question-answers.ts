import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { questionAnswerOverrides } from "@/db/schema";
import type { Question } from "@/lib/questions";

export function normalizeReading(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "")
    .replace(/[ァ-ヶ]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60),
    );
}

export function defaultAcceptedReadings(question: Question) {
  return uniqueReadings([
    question.reading,
    ...(question.acceptedReadings ?? []),
  ]);
}

export function parseAcceptedReadings(
  value: string,
  fallback: string[] = [],
) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return fallback;
    const readings = uniqueReadings(
      parsed.filter((item): item is string => typeof item === "string"),
    );
    return readings.length ? readings : fallback;
  } catch {
    return fallback;
  }
}

export function validateAcceptedReadings(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    return null;
  }
  const readings = uniqueReadings(
    value.filter((item): item is string => typeof item === "string"),
  );
  if (
    readings.length < 1 ||
    readings.some(
      (reading) =>
        reading.length > 40 || !/^[ぁ-ゖー]+$/.test(reading),
    )
  ) {
    return null;
  }
  return readings;
}

export async function loadAnswerOverrides(questionIds: string[]) {
  if (questionIds.length === 0) return new Map<string, string[]>();
  const rows = await getDb()
    .select()
    .from(questionAnswerOverrides)
    .where(inArray(questionAnswerOverrides.questionId, questionIds));
  return new Map(
    rows.map((row) => [
      row.questionId,
      parseAcceptedReadings(row.answersJson),
    ]),
  );
}

export function acceptedReadingsFor(
  question: Question,
  overrides: Map<string, string[]>,
) {
  return overrides.get(question.id) ?? defaultAcceptedReadings(question);
}

function uniqueReadings(values: string[]) {
  return [...new Set(values.map(normalizeReading).filter(Boolean))];
}
