import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
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

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin(`/admin/users/${id}`);
  await ensureDatabase();
  const db = getDb();
  const studentRows = await db.select({ id: students.id, name: students.name }).from(students).where(eq(students.id, id)).limit(1);
  const student = studentRows[0];
  if (!student) notFound();
  const attemptRows = await db.select().from(attempts).where(eq(attempts.studentId, id)).orderBy(desc(attempts.createdAt));
  const answerRows = attemptRows.length
    ? await db.select().from(attemptAnswers).where(inArray(attemptAnswers.attemptId, attemptRows.map((attempt) => attempt.id)))
    : [];
  const total = attemptRows.reduce((sum, attempt) => sum + attempt.total, 0);
  const correct = attemptRows.reduce((sum, attempt) => sum + attempt.score, 0);
  const percentages = attemptRows.map((attempt) => Math.round((attempt.score / attempt.total) * 100));
  const weakMap = new Map<string, { word: string; readings: string[]; wrong: number; asked: number; level: string }>();
  for (const answer of answerRows) {
    const item = weakMap.get(answer.questionId) ?? {
      word: answer.word,
      readings: parseAcceptedReadings(answer.acceptedReadingsJson, [answer.reading]),
      wrong: 0,
      asked: 0,
      level: answer.level,
    };
    item.asked += 1;
    if (!answer.correct) item.wrong += 1;
    weakMap.set(answer.questionId, item);
  }
  const weakItems = Array.from(weakMap.values()).filter((item) => item.wrong > 0).sort((a, b) => b.wrong - a.wrong);

  return (
    <main className="admin-shell">
      <header className="admin-header"><Link className="brand" href="/admin"><span className="brand-mark">読</span><span>あやめ管理</span></Link></header>
      <section className="admin-content detail-content">
        <Link className="back-button" href="/admin">← 一覧へ戻る</Link>
        <p className="eyebrow">USER ANALYTICS</p>
        <h1>{student.name}さん</h1>
        <p className="admin-lead">級別の成績と苦手な問題を確認できます。</p>
        <div className="admin-stats">
          <article><span>受験回数</span><strong>{attemptRows.length}<small>回</small></strong></article>
          <article><span>平均正答率</span><strong>{total ? Math.round((correct / total) * 100) : 0}<small>%</small></strong></article>
          <article><span>最高正答率</span><strong>{percentages.length ? Math.max(...percentages) : 0}<small>%</small></strong></article>
        </div>
        <section className="admin-section">
          <div className="admin-section-title"><div><p className="eyebrow">WEAK POINTS</p><h2>苦手な問題</h2></div></div>
          <div className="weak-grid">
            {weakItems.length === 0 ? <div className="empty-state">間違えた問題はありません。</div> :
              weakItems.map((item) => (
                <article className="weak-card" key={`${item.level}-${item.word}`}>
                  <span className="level-chip">{item.level}級</span>
                  <h3>{item.word}<small>{item.readings.join("・")}</small></h3>
                  <div><strong>{item.wrong}回</strong> 間違い<span>出題 {item.asked}回</span></div>
                </article>
              ))}
          </div>
        </section>
        <section className="admin-section">
          <div className="admin-section-title"><div><p className="eyebrow">HISTORY</p><h2>受験履歴</h2></div></div>
          <div className="attempt-table">
            {attemptRows.length === 0 ? <div className="empty-state">まだ受験していません。</div> :
              attemptRows.map((attempt) => (
                <Link className="attempt-row user-attempt-row" href={`/admin/attempts/${attempt.id}`} key={attempt.id}>
                  <span className="level-pill">{attempt.level}級 · {formatMode(attempt.mode)}</span>
                  <strong>{attempt.score} / {attempt.total}問</strong>
                  <b>{Math.round((attempt.score / attempt.total) * 100)}%</b>
                  <time>{new Date(attempt.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</time>
                  <span>詳細 →</span>
                </Link>
              ))}
          </div>
        </section>
      </section>
    </main>
  );
}
