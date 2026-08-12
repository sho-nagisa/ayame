import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { students } from "@/db/schema";
import { ensureDatabase } from "@/db/ensure";
import {
  createSession,
  normalizeStudentName,
  passwordMatches,
  sessionCookie,
  validPassword,
} from "@/lib/student-auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    password?: unknown;
  } | null;
  const name = normalizeStudentName(body?.name);
  if (!name || !validPassword(body?.password)) {
    return Response.json({ error: "名前またはパスワードが違います。" }, { status: 401 });
  }

  await ensureDatabase();
  const rows = await getDb().select().from(students).where(eq(students.name, name)).limit(1);
  const student = rows[0];
  if (!student || !(await passwordMatches(body.password, student.passwordSalt, student.passwordHash))) {
    return Response.json({ error: "名前またはパスワードが違います。" }, { status: 401 });
  }

  const token = await createSession(student.id);
  return Response.json(
    { student: { id: student.id, name: student.name } },
    { headers: { "set-cookie": sessionCookie(token, request) } },
  );
}
