import { passcodeMatches, setSession, isAuthed } from "@/lib/auth";

export async function GET() {
  return Response.json({ ok: await isAuthed() });
}

export async function POST(req: Request) {
  const { passcode } = await req.json().catch(() => ({ passcode: "" }));
  if (!passcodeMatches(passcode)) return Response.json({ error: "That passcode isn't right." }, { status: 401 });
  await setSession();
  return Response.json({ ok: true });
}
