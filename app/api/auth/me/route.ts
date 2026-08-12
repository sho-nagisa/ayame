import { getSessionStudent } from "@/lib/student-auth";

export async function GET(request: Request) {
  const student = await getSessionStudent(request);
  if (!student) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }
  return Response.json({ student });
}
