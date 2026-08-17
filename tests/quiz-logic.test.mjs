import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("問題バンクは4級・5級・6級を分けて収録する", async () => {
  const text = await source("lib/questions.ts");
  assert.match(text, /QuizLevel = "4" \| "5" \| "6"/);
  assert.equal((text.match(/\{ id: "4-[^"]+"/g) ?? []).length, 2490);
  assert.equal((text.match(/\{ id: "5-[^"]+"/g) ?? []).length, 1904);
  assert.equal((text.match(/\{ id: "6-[^"]+"/g) ?? []).length, 1564);
  assert.equal(new Set([...text.matchAll(/\{ id: "([^"]+)"/g)].map((m) => m[1])).size, 5958);
});

test("3モードが画面からAPIまで同じ値で連携する", async () => {
  const questions = await source("lib/questions.ts");
  const page = await source("app/page.tsx");
  const attempts = await source("app/api/attempts/route.ts");
  assert.match(questions, /QuizMode\s*=\s*"on"\s*\|\s*"kun"\s*\|\s*"mixed"/);
  for (const mode of ["on", "kun", "mixed"]) {
    assert.match(page, new RegExp(`"${mode}"`));
    assert.match(attempts, new RegExp(`"${mode}"`));
  }
  assert.match(page, /kind === "音読み"/);
  assert.match(page, /kind === "訓読み"/);
  assert.match(page, /mode: quizMode/);
  assert.match(attempts, /mode: mode as QuizMode/);
  assert.match(page, /selectedLevel/);
  assert.match(page, /level: selectedLevel/);
  assert.match(attempts, /LEVELS\.some/);
});

test("複数の正解読みを採点に使う", async () => {
  const answers = await source("lib/question-answers.ts");
  const attempts = await source("app/api/attempts/route.ts");
  assert.match(answers, /acceptedReadingsFor/);
  assert.match(answers, /question\.acceptedReadings/);
  assert.match(attempts, /acceptedReadings\.some\(/);
  assert.match(attempts, /normalizeReading\(response\)/);
});

test("認証と成績保存にセッション境界がある", async () => {
  const auth = await source("lib/student-auth.ts");
  const passwordCore = await source("lib/password-core.mjs");
  const login = await source("app/api/auth/login/route.ts");
  const register = await source("app/api/auth/register/route.ts");
  const progress = await source("app/api/progress/route.ts");
  const attempts = await source("app/api/attempts/route.ts");
  assert.match(passwordCore, /PASSWORD_ITERATIONS\s*=\s*100_000/);
  assert.match(auth, /validStudentName/);
  assert.match(auth, /validPassword/);
  assert.match(login, /passwordMatches/);
  assert.match(register, /makePassword/);
  assert.match(progress, /getSessionStudent/);
  assert.match(progress, /byLevel/);
  assert.match(attempts, /getSessionStudent/);
});
