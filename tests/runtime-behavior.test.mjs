import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeStudentName,
  validPassword,
  validStudentName,
} from "../lib/auth-validation.mjs";
import { makePassword, passwordMatches } from "../lib/password-core.mjs";
import {
  normalizeReading,
  parseAcceptedReadings,
  validateAcceptedReadings,
} from "../lib/reading-core.mjs";

test("名前の正規化と入力条件が実際の関数で検証できる", () => {
  assert.equal(normalizeStudentName("  山田　太郎  "), "山田 太郎");
  assert.equal(validStudentName("山田 太郎"), true);
  assert.equal(validStudentName("a"), false);
  assert.equal(validStudentName("名前<script>"), false);
  assert.equal(validPassword("123456"), true);
  assert.equal(validPassword("12345"), false);
  assert.equal(validPassword("a".repeat(73)), false);
});

test("パスワードはハッシュ化後に正しい値だけ照合できる", async () => {
  const password = await makePassword("correct-password");
  assert.notEqual(password.hash, "correct-password");
  assert.equal(password.salt.length, 32);
  assert.equal(await passwordMatches("correct-password", password.salt, password.hash), true);
  assert.equal(await passwordMatches("wrong-password", password.salt, password.hash), false);
});

test("読みの正規化と正解候補の入力検証が実際の関数で検証できる", () => {
  assert.equal(normalizeReading(" カタカナ "), "かたかな");
  assert.deepEqual(validateAcceptedReadings(["せいかい", "セイカイ"]), ["せいかい"]);
  assert.equal(validateAcceptedReadings([]), null);
  assert.equal(validateAcceptedReadings(["漢字"]), null);
  assert.deepEqual(parseAcceptedReadings('["せいかい", ""]', ["fallback"]), ["せいかい"]);
  assert.deepEqual(parseAcceptedReadings("not-json", ["fallback"]), ["fallback"]);
});
