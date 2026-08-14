import Link from "next/link";
import { getDb } from "@/db";
import { ensureDatabase } from "@/db/ensure";
import { questionAnswerOverrides } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import {
  defaultAcceptedReadings,
  parseAcceptedReadings,
} from "@/lib/question-answers";
import { QUESTIONS } from "@/lib/questions";
import QuestionManager from "./QuestionManager";

export const dynamic = "force-dynamic";

export default async function AdminQuestionsPage() {
  await requireAdmin("/admin/questions");
  await ensureDatabase();
  const overrideRows = await getDb().select().from(questionAnswerOverrides);
  const overrides = new Map(
    overrideRows.map((row) => [
      row.questionId,
      parseAcceptedReadings(row.answersJson),
    ]),
  );

  const questions = QUESTIONS.map((question) => ({
    id: question.id,
    level: question.level,
    targetKanji: question.targetKanji,
    word: question.word,
    kind: question.kind,
    schoolGrade: question.schoolGrade,
    defaultReadings: defaultAcceptedReadings(question),
    acceptedReadings:
      overrides.get(question.id) ?? defaultAcceptedReadings(question),
    customized: overrides.has(question.id),
  }));

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link className="brand" href="/admin">
          <span className="brand-mark">読</span>
          <span>あやめ管理</span>
        </Link>
        <Link className="admin-signout" href="/admin">
          学習状況へ戻る
        </Link>
      </header>
      <section className="admin-content question-admin-content">
        <p className="eyebrow">QUESTION ANSWERS</p>
        <h1>問題と正解候補</h1>
        <p className="admin-lead">
          熟語ごとに、正解として認める読みを追加・削除できます。変更後の受験から採点に反映されます。
        </p>
        <QuestionManager questions={questions} />
      </section>
    </main>
  );
}
