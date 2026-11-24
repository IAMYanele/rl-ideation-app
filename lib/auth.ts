// One shared team passcode (TEAM_PASSCODE). The browser keeps a signed cookie so the API keys
// on the server can't be used by anyone who just finds the link.
import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "rl_ideas";
const secret = () => process.env.TEAM_PASSCODE || "";
const sign = () => crypto.createHmac("sha256", secret()).update("rl-ideation-v1").digest("hex");

export function passcodeMatches(input: string) {
  const a = Buffer.from(String(input || "")), b = Buffer.from(secret());
  return secret().length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function setSession() {
  (await cookies()).set(COOKIE, sign(), { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 60 });
}

export async function isAuthed() {
  if (!secret()) return false;
  return (await cookies()).get(COOKIE)?.value === sign();
}

export const unauthorized = () => Response.json({ error: "Please enter the team passcode again." }, { status: 401 });
