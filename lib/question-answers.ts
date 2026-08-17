import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { questionAnswerOverrides } from "@/db/schema";
import type { Question } from "@/lib/questions";
import {
  normalizeReading,
  parseAcceptedReadings,
} from "./reading-core.mjs";

export { normalizeReading, parseAcceptedReadings, validateAcceptedReadings } from "./reading-core.mjs";

export function defaultAcceptedReadings(question: Question) {
  return uniqueReadings([
    question.reading,
    ...(question.acceptedReadings ?? []),
  ]);
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
