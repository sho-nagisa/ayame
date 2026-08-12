import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("問題バンクは音読み834問・訓読み731問を収録する", async () => {
  const text = await source("lib/questions.ts");
  assert.equal((text.match(/kind: "音読み"/g) ?? []).length, 834);
  assert.equal((text.match(/kind: "訓読み"/g) ?? []).length, 731);
  assert.equal((text.match(/\n  \{ id: "6-[^"]+"/g) ?? []).length, 1564);
  assert.equal(new Set([...text.matchAll(/\n  \{ id: "([^"]+)"/g)].map((m) => m[1])).size, 1564);
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
  const login = await source("app/api/auth/login/route.ts");
  const register = await source("app/api/auth/register/route.ts");
  const progress = await source("app/api/progress/route.ts");
  const attempts = await source("app/api/attempts/route.ts");
  assert.match(auth, /PASSWORD_ITERATIONS\s*=\s*100_000/);
  assert.match(auth, /validStudentName/);
  assert.match(auth, /validPassword/);
  assert.match(login, /passwordMatches/);
  assert.match(register, /makePassword/);
  assert.match(progress, /getSessionStudent/);
  assert.match(attempts, /getSessionStudent/);
});
