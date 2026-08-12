import { env } from "cloudflare:workers";
import { notFound } from "next/navigation";
import { getChatGPTUser, requireChatGPTUser } from "@/app/chatgpt-auth";

function matchesAdminEmail(email: string) {
  const adminEmail = (env as unknown as { ADMIN_EMAIL?: string }).ADMIN_EMAIL;
  return Boolean(
    adminEmail && email.toLowerCase() === adminEmail.toLowerCase(),
  );
}

export async function getAdminUser() {
  const user = await getChatGPTUser();
  return user && matchesAdminEmail(user.email) ? user : null;
}

export async function requireAdmin(returnTo: string) {
  const user = await requireChatGPTUser(returnTo);
  if (!matchesAdminEmail(user.email)) {
    notFound();
  }
  return user;
}
