import { getDb } from "@/db";
import { students } from "@/db/schema";
import { ensureDatabase } from "@/db/ensure";
import {
  createSession,
  makePassword,
  normalizeStudentName,
  sessionCookie,
  validPassword,
  validStudentName,
} from "@/lib/student-auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: unknown; password?: unknown };
    const name = normalizeStudentName(body.name);
    if (!validStudentName(name)) {
      return Response.json({ error: "名前は2〜20文字で入力してください。" }, { status: 400 });
    }
    if (!validPassword(body.password)) {
      return Response.json({ error: "パスワードは6文字以上で入力してください。" }, { status: 400 });
    }

    await ensureDatabase();
    const password = await makePassword(body.password);
    const student = { id: crypto.randomUUID(), name };
    await getDb().insert(students).values({
      ...student,
      passwordHash: password.hash,
      passwordSalt: password.salt,
      createdAt: Date.now(),
    });
    const token = await createSession(student.id);
    return Response.json(
      { student },
      { status: 201, headers: { "set-cookie": sessionCookie(token, request) } },
    );
  } catch (error) {
    console.error("student_registration_failed", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE") || message.includes("unique")) {
      return Response.json(
        { error: "その名前はすでに登録されています。別の名前をお試しください。" },
        { status: 409 },
      );
    }
    return Response.json(
      { error: "登録処理で問題が発生しました。少し待ってからもう一度お試しください。" },
      { status: 500 },
    );
  }
}
