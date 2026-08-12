"use client";

import { useMemo, useState } from "react";

type ManagedQuestion = {
  id: string;
  level: string;
  targetKanji: string;
  word: string;
  kind: "音読み" | "訓読み";
  schoolGrade: number;
  defaultReadings: string[];
  acceptedReadings: string[];
  customized: boolean;
};

export default function QuestionManager({
  questions: initialQuestions,
}: {
  questions: ManagedQuestion[];
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"すべて" | "音読み" | "訓読み">("すべて");
  const [customizedOnly, setCustomizedOnly] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<Record<string, string>>({});

  const matching = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return questions
      .filter(
        (question) =>
          (!normalizedQuery ||
            question.word.includes(normalizedQuery) ||
            question.targetKanji.includes(normalizedQuery) ||
            question.acceptedReadings.some((reading) =>
              reading.includes(normalizedQuery),
            )) &&
          (kind === "すべて" || question.kind === kind) &&
          (!customizedOnly || question.customized),
      );
  }, [customizedOnly, kind, query, questions]);
  const filtered = matching.slice(0, 100);

  function draftFor(question: ManagedQuestion) {
    return drafts[question.id] ?? question.acceptedReadings.join("、");
  }

  async function save(question: ManagedQuestion) {
    const readings = draftFor(question)
      .split(/[、,\n]+/)
      .map((reading) => reading.trim())
      .filter(Boolean);
    setBusyId(question.id);
    setMessage((current) => ({ ...current, [question.id]: "" }));
    try {
      const response = await fetch(
        `/api/admin/questions/${encodeURIComponent(question.id)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ readings }),
        },
      );
      const result = (await response.json()) as {
        acceptedReadings?: string[];
        customized?: boolean;
        error?: string;
      };
      if (!response.ok || !result.acceptedReadings) {
        throw new Error(result.error ?? "保存できませんでした。");
      }
      setQuestions((current) =>
        current.map((item) =>
          item.id === question.id
            ? {
                ...item,
                acceptedReadings: result.acceptedReadings!,
                customized: Boolean(result.customized),
              }
            : item,
        ),
      );
      setDrafts((current) => ({
        ...current,
        [question.id]: result.acceptedReadings!.join("、"),
      }));
      setMessage((current) => ({ ...current, [question.id]: "保存しました" }));
    } catch (error) {
      setMessage((current) => ({
        ...current,
        [question.id]:
          error instanceof Error ? error.message : "保存できませんでした。",
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function reset(question: ManagedQuestion) {
    setBusyId(question.id);
    setMessage((current) => ({ ...current, [question.id]: "" }));
    try {
      const response = await fetch(
        `/api/admin/questions/${encodeURIComponent(question.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("初期値に戻せませんでした。");
      setQuestions((current) =>
        current.map((item) =>
          item.id === question.id
            ? {
                ...item,
                acceptedReadings: item.defaultReadings,
                customized: false,
              }
            : item,
        ),
      );
      setDrafts((current) => ({
        ...current,
        [question.id]: question.defaultReadings.join("、"),
      }));
      setMessage((current) => ({
        ...current,
        [question.id]: "初期値に戻しました",
      }));
    } catch (error) {
      setMessage((current) => ({
        ...current,
        [question.id]:
          error instanceof Error ? error.message : "初期値に戻せませんでした。",
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="question-tools">
        <label>
          <span>検索</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="漢字・熟語・読み"
          />
        </label>
        <div className="question-kind-filter">
          {(["すべて", "音読み", "訓読み"] as const).map((item) => (
            <button
              className={kind === item ? "selected" : ""}
              key={item}
              onClick={() => setKind(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <label className="customized-check">
          <input
            checked={customizedOnly}
            onChange={(event) => setCustomizedOnly(event.target.checked)}
            type="checkbox"
          />
          編集済みのみ
        </label>
      </div>

      <div className="question-result-count">
        最大100件を表示中（該当 {matching.length}件）
      </div>
      <div className="question-admin-list">
        {filtered.map((question) => (
          <article key={question.id}>
            <div className="question-admin-word">
              <span className="level-chip">
                {question.level}級 · {question.kind}
              </span>
              <h2>
                {question.word}
                <small>対象：{question.targetKanji}</small>
              </h2>
              <p>小学{question.schoolGrade}年生配当</p>
            </div>
            <label className="reading-editor">
              <span>正解候補（「、」で区切る）</span>
              <input
                value={draftFor(question)}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [question.id]: event.target.value,
                  }))
                }
              />
            </label>
            <div className="question-admin-actions">
              <button
                disabled={busyId === question.id}
                onClick={() => save(question)}
                type="button"
              >
                {busyId === question.id ? "保存中…" : "保存"}
              </button>
              {question.customized && (
                <button
                  className="reset-answer-button"
                  disabled={busyId === question.id}
                  onClick={() => reset(question)}
                  type="button"
                >
                  初期値に戻す
                </button>
              )}
              {message[question.id] && <small>{message[question.id]}</small>}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
