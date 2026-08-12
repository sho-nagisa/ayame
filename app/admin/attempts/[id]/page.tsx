import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getDb } from "@/db";
import { attemptAnswers, attempts, students } from "@/db/schema";
import { ensureDatabase } from "@/db/ensure";
import { parseAcceptedReadings } from "@/lib/question-answers";

export const dynamic = "force-dynamic";

function formatMode(value: string) {
  return value === "on" ? "音読み" : value === "kun" ? "訓読み" : "ミックス";
}

export default async function AttemptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin(`/admin/attempts/${id}`);
  await ensureDatabase();
  const db = getDb();
  const rows = await db
    .select({
      id: attempts.id,
      studentId: students.id,
      name: students.name,
      level: attempts.level,
      mode: attempts.mode,
      score: attempts.score,
      total: attempts.total,
      leaveCount: attempts.leaveCount,
      createdAt: attempts.createdAt,
    })
    .from(attempts)
    .innerJoin(students, eq(attempts.studentId, students.id))
    .where(eq(attempts.id, id))
    .limit(1);
  const attempt = rows[0];
  if (!attempt) notFound();
  const answers = await db
    .select()
    .from(attemptAnswers)
    .where(and(eq(attemptAnswers.attemptId, id), eq(attemptAnswers.level, attempt.level)))
    .orderBy(attemptAnswers.questionOrder);
  const percent = Math.round((attempt.score / attempt.total) * 100);

  return (
    <main className="admin-shell">
      <header className="admin-header"><Link className="brand" href="/admin"><span className="brand-mark">読</span><span>ヨミトク管理</span></Link></header>
      <section className="admin-content detail-content">
        <Link className="back-button" href="/admin">← 一覧へ戻る</Link>
        <div className="detail-heading">
          <div><p className="eyebrow">ATTEMPT DETAIL</p><h1>{attempt.name}さんの受験</h1></div>
          <div className="detail-score"><strong>{percent}%</strong><span>{attempt.score} / {attempt.total}問</span></div>
        </div>
        <div className="detail-meta">
          <span>{attempt.level}級・{formatMode(attempt.mode)}</span>
          <span>{new Date(attempt.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</span>
          <span className={attempt.leaveCount ? "leave-alert" : ""}>画面離脱 {attempt.leaveCount}回</span>
          <Link href={`/admin/users/${attempt.studentId}`}>ユーザー分析を見る →</Link>
        </div>
        <div className="admin-answer-list">
          {answers.map((answer, index) => (
            <article key={answer.id}>
              <span className={answer.correct ? "correct" : "incorrect"}>{answer.correct ? "✓" : "×"}</span>
              <div className="answer-number">Q{index + 1}</div>
              <div>
                <h2>
                  {answer.word}
                  <small>
                    {parseAcceptedReadings(
                      answer.acceptedReadingsJson,
                      [answer.reading],
                    ).join("・")}
                  </small>
                </h2>
                <p>{answer.sentence}</p>
                <dl><div><dt>回答</dt><dd className={answer.correct ? "" : "wrong-answer"}>{answer.response || "未回答"}</dd></div><div><dt>読み方</dt><dd>{answer.kind}</dd></div></dl>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
