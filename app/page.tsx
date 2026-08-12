"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CURRENT_LEVEL,
  LEVEL_6_KANJI_COUNT,
  LEVEL_6_QUESTION_COUNT,
  QUESTIONS as QUESTION_BANK,
  type Question,
  type QuizMode,
} from "@/lib/questions";

type Answer = Question & {
  response: string;
  correct: boolean;
};

type Student = {
  id: string;
  name: string;
};

type ProgressData = {
  stats: {
    attemptCount: number;
    averagePercent: number;
    bestPercent: number;
    totalCorrect: number;
    totalQuestions: number;
  };
  weakQuestions: Array<{
    questionId: string;
    level: string;
    word: string;
    sentence: string;
    reading: string;
    acceptedReadings: string[];
    wrongCount: number;
    askedCount: number;
  }>;
  attempts: Array<{
    id: string;
    level: string;
    mode: string;
    score: number;
    total: number;
    createdAt: number;
    answers: Array<{
      questionId: string;
      word: string;
      sentence: string;
      reading: string;
      acceptedReadings: string[];
      response: string;
      correct: boolean;
    }>;
  }>;
};

function toHiragana(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "")
    .replace(/[ァ-ヶ]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60),
    );
}

function shuffled<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function weightedSample(items: Question[], count: number) {
  return items
    .map((question) => ({
      question,
      key: Math.random() ** (1 / question.priorityWeight),
    }))
    .sort((left, right) => right.key - left.key)
    .slice(0, count)
    .map(({ question }) => question);
}

export default function Home() {
  const [authState, setAuthState] = useState<"loading" | "guest" | "authenticated">("loading");
  const [student, setStudent] = useState<Student | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authName, setAuthName] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [phase, setPhase] = useState<"setup" | "quiz" | "result" | "progress">("setup");
  const [questionCount, setQuestionCount] = useState(10);
  const [quizMode, setQuizMode] = useState<QuizMode>("mixed");
  const [quiz, setQuiz] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [response, setResponse] = useState("");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [leaveCount, setLeaveCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [progressStatus, setProgressStatus] = useState<"idle" | "loading" | "error">("idle");
  const lastLeaveRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const passLine = useMemo(() => Math.ceil(answers.length * 0.7), [answers.length]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = (await response.json()) as { student: Student };
        setStudent(data.student);
        setAuthState("authenticated");
      })
      .catch(() => setAuthState("guest"));
  }, []);

  useEffect(() => {
    if (phase !== "quiz") return;

    const registerLeave = () => {
      const now = Date.now();
      if (now - lastLeaveRef.current < 1200) return;
      lastLeaveRef.current = now;
      setLeaveCount((count) => count + 1);
    };

    const onVisibilityChange = () => {
      if (document.hidden) registerLeave();
    };
    const onPageHide = () => registerLeave();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "quiz") {
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [phase, index]);

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");
    try {
      const response = await fetch(`/api/auth/${authMode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: authName, password: authPassword }),
      });
      const data = (await response.json()) as { student?: Student; error?: string };
      if (!response.ok || !data.student) {
        setAuthMessage(data.error ?? "ログインできませんでした。");
        return;
      }
      setStudent(data.student);
      setAuthState("authenticated");
      setAuthName("");
      setAuthPassword("");
    } catch {
      setAuthMessage("通信に失敗しました。もう一度お試しください。");
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setStudent(null);
    setPhase("setup");
    setAuthState("guest");
  }

  function startQuiz() {
    const levelQuestions = QUESTION_BANK.filter(
      (question) => question.level === CURRENT_LEVEL,
    );
    const onQuestions = weightedSample(
      levelQuestions.filter((question) => question.kind === "音読み"),
      quizMode === "kun" ? 0 : quizMode === "mixed" ? Math.ceil(questionCount / 2) : questionCount,
    );
    const selectedKanji = new Set(
      onQuestions.map((question) => question.targetKanji),
    );
    const kunQuestions = weightedSample(
      levelQuestions.filter(
        (question) =>
          question.kind === "訓読み" &&
          (quizMode === "kun" || !selectedKanji.has(question.targetKanji)),
      ),
      quizMode === "on" ? 0 : quizMode === "mixed" ? questionCount - onQuestions.length : questionCount,
    );
    setQuiz(shuffled([...onQuestions, ...kunQuestions]));
    setIndex(0);
    setResponse("");
    setAnswers([]);
    setLeaveCount(0);
    setSaveStatus("idle");
    setPhase("quiz");
  }

  async function saveAttempt(nextAnswers: Answer[]) {
    setSaveStatus("saving");
    try {
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          level: CURRENT_LEVEL,
          mode: quizMode,
          leaveCount,
          answers: nextAnswers.map(({ id, response: studentResponse }) => ({
            questionId: id,
            response: studentResponse,
          })),
        }),
      });
      if (!response.ok) {
        setSaveStatus("error");
        return;
      }
      const result = (await response.json()) as {
        results?: Array<{
          questionId: string;
          correct: boolean;
          acceptedReadings: string[];
        }>;
      };
      if (result.results) {
        const resultMap = new Map(
          result.results.map((item) => [item.questionId, item]),
        );
        setAnswers((currentAnswers) =>
          currentAnswers.map((answer) => {
            const graded = resultMap.get(answer.id);
            return graded
              ? {
                  ...answer,
                  correct: graded.correct,
                  reading: graded.acceptedReadings[0],
                  acceptedReadings: graded.acceptedReadings,
                }
              : answer;
          }),
        );
      }
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }

  function submitAnswer(event: FormEvent) {
    event.preventDefault();
    if (!response.trim()) return;
    const current = quiz[index];
    const nextAnswers = [
      ...answers,
      {
        ...current,
        response,
        correct: [current.reading, ...(current.acceptedReadings ?? [])].some(
          (reading) => toHiragana(response) === toHiragana(reading),
        ),
      },
    ];
    setAnswers(nextAnswers);
    setResponse("");
    if (index + 1 >= quiz.length) {
      setPhase("result");
      void saveAttempt(nextAnswers);
    } else {
      setIndex((currentIndex) => currentIndex + 1);
    }
  }

  const score = answers.filter((answer) => answer.correct).length;

  async function showProgress() {
    setProgressStatus("loading");
    try {
      const response = await fetch("/api/progress");
      if (!response.ok) throw new Error();
      setProgress((await response.json()) as ProgressData);
      setProgressStatus("idle");
      setPhase("progress");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setProgressStatus("error");
    }
  }

  if (authState === "loading") {
    return (
      <main className="auth-shell">
        <div className="loading-mark">読</div>
        <p>読み込み中…</p>
      </main>
    );
  }

  if (authState === "guest") {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <a className="brand auth-brand" href="#" aria-label="ヨミトク">
            <span className="brand-mark">読</span>
            <span>ヨミトク</span>
          </a>
          <p className="eyebrow">KANKEN LEVEL 6</p>
          <h1>{authMode === "login" ? "おかえりなさい" : "はじめまして"}</h1>
          <p className="auth-lead">
            {authMode === "login"
              ? "登録した名前とパスワードでログインしてください。"
              : "成績を保存するためのアカウントを作ります。"}
          </p>
          <div className="auth-tabs">
            <button
              type="button"
              className={authMode === "login" ? "selected" : ""}
              onClick={() => { setAuthMode("login"); setAuthMessage(""); }}
            >
              ログイン
            </button>
            <button
              type="button"
              className={authMode === "register" ? "selected" : ""}
              onClick={() => { setAuthMode("register"); setAuthMessage(""); }}
            >
              新規登録
            </button>
          </div>
          <form className="auth-form" onSubmit={submitAuth}>
            <label htmlFor="auth-name">名前（ログインID）</label>
            <input
              id="auth-name"
              value={authName}
              onChange={(event) => setAuthName(event.target.value)}
              minLength={2}
              maxLength={20}
              autoComplete="username"
              placeholder="例：やまだ はる"
              required
            />
            <label htmlFor="auth-password">パスワード</label>
            <input
              id="auth-password"
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              minLength={6}
              maxLength={72}
              autoComplete={authMode === "login" ? "current-password" : "new-password"}
              placeholder="6文字以上"
              required
            />
            {authMessage && <p className="auth-error" role="alert">{authMessage}</p>}
            <button className="primary-button" type="submit" disabled={authBusy}>
              {authBusy ? "確認中…" : authMode === "login" ? "ログイン" : "アカウントを作る"}
              {!authBusy && <span aria-hidden="true">→</span>}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="brand-bar">
        <a className="brand" href="#" aria-label="ヨミトク ホーム">
          <span className="brand-mark">読</span>
          <span>ヨミトク</span>
        </a>
        <div className="header-actions">
          <button className="history-button" type="button" onClick={showProgress}>成績</button>
          <button className="student-menu" type="button" onClick={logout}>
            <span>{student?.name.slice(0, 1)}</span>
            ログアウト
          </button>
        </div>
      </header>

      {phase === "setup" && (
        <section className="setup-view">
          <div className="hero-copy">
            <p className="eyebrow">KANKEN LEVEL 6 · READING PRACTICE</p>
            <h1>
              漢検6級、
              <br />
              <span>読みに挑戦。</span>
            </h1>
            <p className="lead">
              小学校5年生修了程度・835字が対象。
              <br />
              読み問題にしぼって、本番前の力試し。
            </p>
          </div>

          <div className="setup-card">
            <div className="card-heading">
              <span className="step-number">01</span>
              <div>
                <h2>テストを設定</h2>
                <p>
                  全{LEVEL_6_KANJI_COUNT}字・
                  {LEVEL_6_QUESTION_COUNT.toLocaleString()}問から出題します
                </p>
              </div>
            </div>

            <fieldset>
              <legend>出題モード</legend>
              <div className="mode-options">
                {([
                  ["on", "音読みのみ"],
                  ["kun", "訓読みのみ"],
                  ["mixed", "ミックス"],
                ] as const).map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    className={quizMode === value ? "selected" : ""}
                    onClick={() => setQuizMode(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>問題数</legend>
              <div className="count-options">
                {[10, 20, 30].map((count) => (
                  <button
                    type="button"
                    key={count}
                    className={questionCount === count ? "selected" : ""}
                    onClick={() => setQuestionCount(count)}
                  >
                    <strong>{count}</strong>
                    <span>問</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <button className="primary-button" type="button" onClick={startQuiz}>
              テストをはじめる
              <span aria-hidden="true">→</span>
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={showProgress}
              disabled={progressStatus === "loading"}
            >
              {progressStatus === "loading" ? "読み込み中…" : "成績と復習を見る"}
            </button>
            {progressStatus === "error" && <p className="inline-error">成績を読み込めませんでした。</p>}

            <p className="unofficial-note">
              音読みと訓読みがほぼ半数ずつになるように選びます。
              小学5年生の新出漢字と、一般によく使われる漢字を優先します。
              ※漢検の過去問出題回数を表すものではありません。
            </p>
          </div>

          <div className="feature-row" aria-label="特徴">
            <div><strong>835</strong><span>対象漢字</span></div>
            <div><strong>70%</strong><span>合格目安</span></div>
            <div><strong>30</strong><span>読み問題</span></div>
          </div>
          <a className="admin-link" href="/admin">管理者ページ</a>
        </section>
      )}

      {phase === "quiz" && quiz[index] && (
        <section className="quiz-view">
          <div className="progress-copy">
            <span>問題 {index + 1}</span>
            <span>{quiz.length}問中</span>
          </div>
          <div className="progress-track" aria-label={`${quiz.length}問中${index + 1}問目`}>
            <span style={{ width: `${((index + 1) / quiz.length) * 100}%` }} />
          </div>

          <article className="question-card">
            <span className="level-chip">6級 · {quiz[index].kind}</span>
            <p className="instruction">次の漢字の読みを答えてください</p>
            <h1>{quiz[index].word}</h1>
            <p className="sentence">{quiz[index].sentence}</p>
          </article>

          <form className="answer-form" onSubmit={submitAnswer}>
            <label htmlFor="reading">よみがな</label>
            <input
              ref={inputRef}
              id="reading"
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              placeholder="ひらがなで入力"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
            />
            <button className="primary-button" type="submit" disabled={!response.trim()}>
              {index + 1 === quiz.length ? "採点する" : "次の問題へ"}
              <span aria-hidden="true">→</span>
            </button>
          </form>
        </section>
      )}

      {phase === "result" && (
        <section className="result-view">
          <p className="eyebrow">RESULT</p>
          <h1>おつかれさまでした</h1>
          <div className="score-ring" style={{ "--score": `${(score / answers.length) * 360}deg` } as React.CSSProperties}>
            <div>
              <strong>{score}</strong>
              <span>／ {answers.length} 問</span>
            </div>
          </div>
          <p className="result-message">
            {score === answers.length
              ? "全問正解！6級の読みがしっかり身についています。"
              : score >= passLine
                ? "合格目安の70％をクリアしました。"
                : `合格目安まであと${passLine - score}問。答えを復習しましょう。`}
          </p>
          <p className={`save-status ${saveStatus}`}>
            {saveStatus === "saving" && "成績を保存しています…"}
            {saveStatus === "saved" && "成績を保存しました"}
            {saveStatus === "error" && "成績を保存できませんでした。再受験前にページを再読み込みしてください。"}
          </p>

          <div className="review-list">
            <h2>答え合わせ</h2>
            {answers.map((answer, answerIndex) => (
              <article key={`${answer.word}-${answerIndex}`} className="review-item">
                <span className={answer.correct ? "correct" : "incorrect"}>
                  {answer.correct ? "✓" : "×"}
                </span>
                <div>
                  <h3>{answer.word}<small>{[answer.reading, ...(answer.acceptedReadings ?? [])].filter((reading, index, list) => list.indexOf(reading) === index).join("・")}</small></h3>
                  {!answer.correct && <p>あなたの回答：{answer.response}</p>}
                </div>
              </article>
            ))}
          </div>

          <button className="primary-button" type="button" onClick={() => setPhase("setup")}>
            もう一度挑戦する
            <span aria-hidden="true">↻</span>
          </button>
          <button className="secondary-button" type="button" onClick={showProgress}>
            成績と復習を見る
          </button>
          <a className="admin-link" href="/admin">管理者ページ</a>
        </section>
      )}

      {phase === "progress" && progress && (
        <section className="progress-view">
          <button className="back-button" type="button" onClick={() => setPhase("setup")}>← テストへ戻る</button>
          <p className="eyebrow">MY PROGRESS · LEVEL {CURRENT_LEVEL}</p>
          <h1>{student?.name}さんの成績</h1>
          <p className="progress-lead">受験履歴と間違えた問題を、次の挑戦に活かしましょう。</p>

          <div className="progress-stats">
            <article><span>受験回数</span><strong>{progress.stats.attemptCount}<small>回</small></strong></article>
            <article><span>平均正答率</span><strong>{progress.stats.averagePercent}<small>%</small></strong></article>
            <article><span>最高正答率</span><strong>{progress.stats.bestPercent}<small>%</small></strong></article>
          </div>

          <section className="progress-section">
            <div className="section-title-row">
              <div><p className="eyebrow">REVIEW</p><h2>間違えた問題</h2></div>
              <span>{progress.weakQuestions.length}問</span>
            </div>
            {progress.weakQuestions.length === 0 ? (
              <div className="progress-empty">まだ間違えた問題はありません。</div>
            ) : (
              <div className="weak-grid">
                {progress.weakQuestions.map((question) => (
                  <article className="weak-card" key={question.questionId}>
                    <span className="level-chip">{question.level}級</span>
                    <h3>{question.word}<small>{question.acceptedReadings.join("・")}</small></h3>
                    <p>{question.sentence}</p>
                    <div><strong>{question.wrongCount}回</strong> 間違い<span>出題 {question.askedCount}回</span></div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="progress-section">
            <div className="section-title-row">
              <div><p className="eyebrow">HISTORY</p><h2>受験履歴</h2></div>
            </div>
            {progress.attempts.length === 0 ? (
              <div className="progress-empty">まだ受験履歴はありません。</div>
            ) : (
              <div className="history-list">
                {progress.attempts.map((attempt) => {
                  const percent = Math.round((attempt.score / attempt.total) * 100);
                  return (
                    <details className="history-item" key={attempt.id}>
                      <summary>
                        <span className="level-pill">{attempt.level}級 · {attempt.mode === "on" ? "音読み" : attempt.mode === "kun" ? "訓読み" : "ミックス"}</span>
                        <div>
                          <strong>{attempt.score} / {attempt.total}問</strong>
                          <time>{new Date(attempt.createdAt).toLocaleString("ja-JP", {
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}</time>
                        </div>
                        <b className={percent >= 70 ? "passed" : ""}>{percent}%</b>
                      </summary>
                      <div className="history-answers">
                        {attempt.answers.map((answer) => (
                          <article key={answer.questionId}>
                            <span className={answer.correct ? "correct" : "incorrect"}>{answer.correct ? "✓" : "×"}</span>
                            <div>
                              <h3>{answer.word}<small>{answer.acceptedReadings.join("・")}</small></h3>
                              {!answer.correct && <p>あなたの回答：{answer.response || "未回答"}</p>}
                            </div>
                          </article>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      )}
    </main>
  );
}
