import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { attemptAnswers, attempts } from "@/db/schema";
import { getSessionStudent } from "@/lib/student-auth";
import { parseAcceptedReadings } from "@/lib/question-answers";

export async function GET(request: Request) {
  const student = await getSessionStudent(request);
  if (!student) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const db = getDb();
  const attemptRows = await db
    .select()
    .from(attempts)
    .where(eq(attempts.studentId, student.id))
    .orderBy(desc(attempts.createdAt));

  const statsFor = (rows: typeof attemptRows) => {
    const totalQuestions = rows.reduce((sum, attempt) => sum + attempt.total, 0);
    const totalCorrect = rows.reduce((sum, attempt) => sum + attempt.score, 0);
    const percentages = rows.map((attempt) => Math.round((attempt.score / attempt.total) * 100));
    return {
      attemptCount: rows.length,
      averagePercent: totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
      bestPercent: percentages.length ? Math.max(...percentages) : 0,
      totalCorrect,
      totalQuestions,
    };
  };

  if (attemptRows.length === 0) {
    return Response.json({ stats: statsFor([]), byLevel: [], weakQuestions: [], attempts: [] });
  }

  const answerRows = await db
    .select()
    .from(attemptAnswers)
    .where(inArray(attemptAnswers.attemptId, attemptRows.map((attempt) => attempt.id)));

  const answersByAttempt = new Map<string, typeof answerRows>();
  for (const answer of answerRows) {
    const list = answersByAttempt.get(answer.attemptId) ?? [];
    list.push(answer);
    answersByAttempt.set(answer.attemptId, list);
  }

  const weakMap = new Map<string, {
    questionId: string;
    level: string;
    word: string;
    sentence: string;
    reading: string;
    acceptedReadings: string[];
    wrongCount: number;
    askedCount: number;
  }>();
  for (const answer of answerRows) {
    const item = weakMap.get(answer.questionId) ?? {
      questionId: answer.questionId,
      level: answer.level,
      word: answer.word,
      sentence: answer.sentence,
      reading: answer.reading,
      acceptedReadings: parseAcceptedReadings(
        answer.acceptedReadingsJson,
        [answer.reading],
      ),
      wrongCount: 0,
      askedCount: 0,
    };
    item.askedCount += 1;
    if (!answer.correct) item.wrongCount += 1;
    weakMap.set(answer.questionId, item);
  }

  const byLevel = Array.from(new Set(attemptRows.map((attempt) => attempt.level)))
    .map((level) => ({ level, ...statsFor(attemptRows.filter((attempt) => attempt.level === level)) }))
    .sort((a, b) => a.level.localeCompare(b.level, "ja"));

  return Response.json({
    stats: {
      ...statsFor(attemptRows),
    },
    byLevel,
    weakQuestions: Array.from(weakMap.values())
      .filter((item) => item.wrongCount > 0)
      .sort((a, b) => b.wrongCount - a.wrongCount || a.word.localeCompare(b.word, "ja")),
    attempts: attemptRows.map((attempt) => ({
      id: attempt.id,
      level: attempt.level,
      mode: attempt.mode,
      score: attempt.score,
      total: attempt.total,
      leaveCount: attempt.leaveCount,
      createdAt: attempt.createdAt,
      answers: (answersByAttempt.get(attempt.id) ?? [])
        .sort((a, b) => a.questionOrder - b.questionOrder)
        .map((answer) => ({
          questionId: answer.questionId,
          word: answer.word,
          sentence: answer.sentence,
          reading: answer.reading,
          acceptedReadings: parseAcceptedReadings(
            answer.acceptedReadingsJson,
            [answer.reading],
          ),
          response: answer.response,
          correct: answer.correct,
        })),
    })),
  });
}
