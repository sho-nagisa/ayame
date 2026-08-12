import { deleteSession, expiredSessionCookie } from "@/lib/student-auth";

export async function POST(request: Request) {
  await deleteSession(request);
  return Response.json(
    { ok: true },
    { headers: { "set-cookie": expiredSessionCookie() } },
  );
}
