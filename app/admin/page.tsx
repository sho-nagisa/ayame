import Link from "next/link";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { getDb } from "@/db";
import { attempts, students } from "@/db/schema";
import { ensureDatabase } from "@/db/ensure";

export const dynamic = "force-dynamic";

function formatDate(value: number) {
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMode(value: string) {
  return value === "on" ? "音読み" : value === "kun" ? "訓読み" : "ミックス";
}

export default async function AdminPage() {
  await requireAdmin("/admin");
  await ensureDatabase();
  const db = getDb();
  const [studentRows, attemptRows] = await Promise.all([
    db.select({ id: students.id, name: students.name, createdAt: students.createdAt }).from(students),
    db.select().from(attempts).orderBy(desc(attempts.createdAt)),
  ]);

  const summaries = studentRows.map((student) => {
    const ownAttempts = attemptRows.filter((attempt) => attempt.studentId === student.id);
    const total = ownAttempts.reduce((sum, attempt) => sum + attempt.total, 0);
    const correct = ownAttempts.reduce((sum, attempt) => sum + attempt.score, 0);
    const percentages = ownAttempts.map((attempt) => Math.round((attempt.score / attempt.total) * 100));
    return {
      ...student,
      attemptCount: ownAttempts.length,
      averagePercent: total ? Math.round((correct / total) * 100) : 0,
      bestPercent: percentages.length ? Math.max(...percentages) : 0,
      lastAttemptAt: ownAttempts[0]?.createdAt ?? null,
    };
  }).sort((a, b) => (b.lastAttemptAt ?? 0) - (a.lastAttemptAt ?? 0));

  const totalQuestions = attemptRows.reduce((sum, attempt) => sum + attempt.total, 0);
  const totalCorrect = attemptRows.reduce((sum, attempt) => sum + attempt.score, 0);
  const average = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const levelStats = Array.from(new Set(attemptRows.map((attempt) => attempt.level)))
    .map((level) => {
      const rows = attemptRows.filter((attempt) => attempt.level === level);
      const questions = rows.reduce((sum, attempt) => sum + attempt.total, 0);
      const correct = rows.reduce((sum, attempt) => sum + attempt.score, 0);
      return {
        level,
        attempts: rows.length,
        average: questions ? Math.round((correct / questions) * 100) : 0,
        best: rows.length ? Math.max(...rows.map((attempt) => Math.round((attempt.score / attempt.total) * 100))) : 0,
      };
    })
    .sort((a, b) => a.level.localeCompare(b.level, "ja"));

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link className="brand" href="/admin">
          <span className="brand-mark">読</span><span>あやめ管理</span>
        </Link>
        <a href="/signout-with-chatgpt?return_to=/" className="admin-signout">ログアウト</a>
      </header>
      <section className="admin-content">
        <p className="eyebrow">LEARNING DASHBOARD</p>
        <h1>学習状況</h1>
        <p className="admin-lead">ユーザーごとの正答率と、受験ごとの出題内容を確認できます。</p>
        <Link className="question-management-link" href="/admin/questions">
          問題と正解候補を管理する →
        </Link>

        <div className="admin-stats">
          <article><span>登録ユーザー</span><strong>{studentRows.length}<small>人</small></strong></article>
          <article><span>受験回数</span><strong>{attemptRows.length}<small>回</small></strong></article>
          <article><span>全体正答率</span><strong>{average}<small>%</small></strong></article>
        </div>

        <div className="admin-level-stats">
          {levelStats.map((item) => (
            <article key={item.level}>
              <span>漢検{item.level}級</span>
              <strong>{item.average}<small>% 平均</small></strong>
              <p>{item.attempts}回受験 · 最高 {item.best}%</p>
            </article>
          ))}
        </div>

        <section className="admin-section">
          <div className="admin-section-title"><div><p className="eyebrow">USERS</p><h2>ユーザー別成績</h2></div></div>
          <div className="user-summary-grid">
            {summaries.length === 0 ? <div className="empty-state">登録ユーザーはまだいません。</div> :
              summaries.map((student) => (
                <Link className="user-summary-card" href={`/admin/users/${student.id}`} key={student.id}>
                  <div className="attempt-name"><span>{student.name.slice(0, 1)}</span><strong>{student.name}</strong></div>
                  <dl>
                    <div><dt>平均</dt><dd>{student.averagePercent}%</dd></div>
                    <div><dt>最高</dt><dd>{student.bestPercent}%</dd></div>
                    <div><dt>受験</dt><dd>{student.attemptCount}回</dd></div>
                  </dl>
                  <p>{student.lastAttemptAt ? `最終受験 ${formatDate(student.lastAttemptAt)}` : "まだ受験していません"}</p>
                </Link>
              ))}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-title"><div><p className="eyebrow">ATTEMPTS</p><h2>最近の受験</h2></div></div>
          <div className="attempt-table">
            <div className="attempt-head">
              <span>受験者</span><span>級・得点</span><span>画面離脱</span><span>受験日時</span><span />
            </div>
            {attemptRows.length === 0 ? <div className="empty-state">まだ受験結果はありません。</div> :
              attemptRows.map((attempt) => {
                const student = studentRows.find((item) => item.id === attempt.studentId);
                const percent = Math.round((attempt.score / attempt.total) * 100);
                return (
                  <Link className="attempt-row" href={`/admin/attempts/${attempt.id}`} key={attempt.id}>
                    <div className="attempt-name"><span>{student?.name.slice(0, 1)}</span><strong>{student?.name ?? "不明"}</strong></div>
                    <div className="attempt-score"><span className="level-pill">{attempt.level}級 · {formatMode(attempt.mode)}</span><strong>{attempt.score}/{attempt.total}</strong><small className={percent >= 70 ? "passed" : ""}>{percent}%</small></div>
                    <div className={attempt.leaveCount ? "leave-alert" : ""}>{attempt.leaveCount}回</div>
                    <time>{formatDate(attempt.createdAt)}</time>
                    <b>詳細 →</b>
                  </Link>
                );
              })}
          </div>
        </section>
      </section>
    </main>
  );
}
