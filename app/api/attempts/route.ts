import { getDb } from "@/db";
import { attemptAnswers, attempts } from "@/db/schema";
import { QUESTIONS, type QuizLevel, type QuizMode } from "@/lib/questions";
import { getSessionStudent } from "@/lib/student-auth";
import { eq } from "drizzle-orm";
import {
  acceptedReadingsFor,
  loadAnswerOverrides,
  normalizeReading,
} from "@/lib/question-answers";

type AttemptBody = {
  level?: unknown;
  mode?: unknown;
  leaveCount?: unknown;
  answers?: unknown;
};

type SubmittedAnswer = {
  questionId?: unknown;
  response?: unknown;
};

export async function POST(request: Request) {
  const student = await getSessionStudent(request);
  if (!student) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as AttemptBody | null;
  const level = body?.level;
  const mode = body?.mode;
  const leaveCount = Number(body?.leaveCount);
  const submitted = body?.answers as SubmittedAnswer[] | undefined;
  if (
    level !== "6" ||
    !["on", "kun", "mixed"].includes(String(mode)) ||
    !Number.isInteger(leaveCount) ||
    leaveCount < 0 ||
    leaveCount > 100 ||
    !Array.isArray(submitted) ||
    submitted.length < 1 ||
    submitted.length > 30
  ) {
    return Response.json({ error: "成績データが正しくありません。" }, { status: 400 });
  }

  const questionMap = new Map(QUESTIONS.map((question) => [question.id, question]));
  const submittedQuestionIds = submitted
    .map((answer) =>
      typeof answer.questionId === "string" ? answer.questionId : "",
    )
    .filter(Boolean);
  const overrides = await loadAnswerOverrides(submittedQuestionIds);
  const seenIds = new Set<string>();
  const checkedAnswers = submitted.map((answer, questionOrder) => {
    const questionId = typeof answer.questionId === "string" ? answer.questionId : "";
    const response = typeof answer.response === "string" ? answer.response.slice(0, 100) : "";
    const question = questionMap.get(questionId);
    if (!question || question.level !== level || seenIds.has(questionId)) {
      throw new Error("invalid_question");
    }
    seenIds.add(questionId);
    const acceptedReadings = acceptedReadingsFor(question, overrides);
    return {
      id: crypto.randomUUID(),
      questionId,
      questionOrder,
      level: level as QuizLevel,
      word: question.word,
      sentence: question.sentence,
      reading: acceptedReadings[0],
      acceptedReadingsJson: JSON.stringify(acceptedReadings),
      kind: question.kind,
      response,
      correct: acceptedReadings.some(
        (reading) => normalizeReading(response) === normalizeReading(reading),
      ),
    };
  });

  const attemptId = crypto.randomUUID();
  const score = checkedAnswers.filter((answer) => answer.correct).length;
  const db = getDb();
  await db.insert(attempts).values({
    id: attemptId,
    studentId: student.id,
    level,
    mode: mode as QuizMode,
    score,
    total: checkedAnswers.length,
    leaveCount,
    createdAt: Date.now(),
  });

  try {
    // D1 limits the number of bound values in one statement. Keep each
    // multi-row insert comfortably below that limit as more fields are added.
    const answerChunkSize = 8;
    for (let index = 0; index < checkedAnswers.length; index += answerChunkSize) {
      await db.insert(attemptAnswers).values(
        checkedAnswers
          .slice(index, index + answerChunkSize)
          .map((answer) => ({ ...answer, attemptId })),
      );
    }
  } catch (error) {
    await db.delete(attempts).where(eq(attempts.id, attemptId));
    throw error;
  }

  return Response.json(
    {
      id: attemptId,
      score,
      total: checkedAnswers.length,
      results: checkedAnswers.map((answer) => ({
        questionId: answer.questionId,
        correct: answer.correct,
        acceptedReadings: JSON.parse(answer.acceptedReadingsJson) as string[],
      })),
    },
    { status: 201 },
  );
}
