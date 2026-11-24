# Remote Latinos script ideas

This folder opens the Remote Latinos script ideas app inside Claude Code.

## What to do first, every session

Whatever the first message says (even just "hi", "open" or "start"), before anything else, call
`preview_start` with `{"name": "Script ideas"}`. That opens https://rl-ideation-app.vercel.app in
the side panel. Then reply in one short line: "The script ideas app is open on the right."

If the side panel doesn't open, call `preview_start` with `{"url": "https://rl-ideation-app.vercel.app"}`.
If that also fails, tell the person to open https://rl-ideation-app.vercel.app in their browser instead.

## Who uses this

Gabby and Laura on the Remote Latinos content team. Keep every answer short and in plain words, with
the exact button to click. Don't change files in this folder.

## How the app works (for answering questions)

1. Click who the scripts are for: Omer Bloch, Esteban, or Hire Remote Latinos.
2. Paste Instagram reel links, or type competitor accounts (for example @hormozi) and pick
   "last 30 days" and "top 5 by views".
3. Press **Find videos**, untick any you don't want, then press **Write scripts**
   (2 to 4 minutes per video; keep the panel open).
4. Press **Copy all for Google Docs** and paste into the doc.
5. Older batches are under **Saved**.

If a video says "out of credit" or "tell Yanele", the person should message Yanele: it is a billing
problem on the server, not something they can fix.
