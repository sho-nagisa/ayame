import { getDb } from "@/db";
import { ensureDatabase } from "@/db/ensure";
import { attemptAnswers, attempts } from "@/db/schema";
import { LEVELS, QUESTIONS, type QuizLevel, type QuizMode } from "@/lib/questions";
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

  // Keep this route safe when it is the first database request after a deploy.
  await ensureDatabase();

  const body = (await request.json().catch(() => null)) as AttemptBody | null;
  const level = body?.level;
  const mode = body?.mode;
  const leaveCount = Number(body?.leaveCount);
  const submitted = body?.answers as SubmittedAnswer[] | undefined;
  if (
    !LEVELS.some((item) => item.id === level) ||
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
  let checkedAnswers: Array<{
    id: string;
    questionId: string;
    questionOrder: number;
    level: QuizLevel;
    word: string;
    sentence: string;
    reading: string;
    acceptedReadingsJson: string;
    kind: string;
    response: string;
    correct: boolean;
  }>;
  try {
    checkedAnswers = submitted.map((answer, questionOrder) => {
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
  } catch {
    return Response.json({ error: "問題データが正しくありません。ページを再読み込みしてください。" }, { status: 400 });
  }

  const attemptId = crypto.randomUUID();
  const score = checkedAnswers.filter((answer) => answer.correct).length;
  const db = getDb();
  try {
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

    // D1 limits the number of bound values in one statement. Keep each
    // multi-row insert comfortably below that limit as more fields are added.
    const answerChunkSize = 4;
    for (let index = 0; index < checkedAnswers.length; index += answerChunkSize) {
      await db.insert(attemptAnswers).values(
        checkedAnswers
          .slice(index, index + answerChunkSize)
          .map((answer) => ({ ...answer, attemptId })),
      );
    }
  } catch (error) {
    console.error("attempt_save_failed", {
      level,
      mode,
      answerCount: checkedAnswers.length,
      error: error instanceof Error ? error.message : String(error),
    });
    await db.delete(attempts).where(eq(attempts.id, attemptId)).catch(() => undefined);
    return Response.json({ error: "成績を保存できませんでした。時間をおいてもう一度お試しください。" }, { status: 500 });
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
