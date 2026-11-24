# Remote Latinos script ideas

Link: https://rl-ideation-app.vercel.app

Turns Instagram reels into ready-to-film scripts for Omer, Esteban or Hire Remote Latinos, using Yanele's scripting pipeline:

1. Script Analyzer: the feeling, the hook, the order, share vs save.
2. V3 writer, in the client's voice.
3. Script Optimizer.
4. A panel of judges, plus the copy check. If the panel fails a script, it is revised up to 2 times.

## How to use it (Gabby and Laura)

1. Open the link. There is no passcode.
2. **Who are the scripts for?** Click Omer, Esteban or Hire Remote Latinos.
3. **Where should the ideas come from?** Pick one:
   - **Reel links:** paste Instagram reel links, one per line.
   - **Competitor accounts:** type their handles, one per line (for example @hormozi). Then choose "last 30 days" and "top 5 by views".
4. Press **Find videos**. Each video shows its views, likes and shares. Untick any you don't want.
5. Press **Write scripts**. Each video takes 2 to 4 minutes. Keep the tab open.
6. Press **Copy all for Google Docs** and paste into your doc.

For each video you get:
- the title
- the source link and metrics
- the original transcript
- the script
- notes

Every batch is also saved under **Saved** on that computer, with Copy and Download buttons.

If a video says **Failed**, press **Retry**. If it says "out of credit" or "tell Yanele", message Yanele.

## Setup (Yanele, one time)

In Vercel, open project `rl-ideation-app`, go to Settings, then Environment Variables, and add:

| Name | Value |
|---|---|
| `RAPIDAPI_KEY` | the `rapidapi_key` from `workflow-agents/scraping agent/config.json` |
| `RAPIDAPI_KEY_FALLBACK` | the `rapidapi_key_fallback` from the same file |
| `OPENAI_API_KEY` | an OpenAI key with credit (Whisper transcription, under 1 cent per reel) |
| `ANTHROPIC_API_KEY` | a Claude API key with credit (about 15 to 40 cents per script on Opus 5.5 with caching) |

Optional:
- `TEAM_PASSCODE`: leave it unset for no passcode (current setting). Set it to bring back a passcode screen, so strangers who find the link can't spend your API credit.
- `ANTHROPIC_MODEL`: defaults to `claude-opus-5-5`; `claude-sonnet-5-5` costs about half.
- `ANTHROPIC_EFFORT`: defaults to `high`.

Then redeploy: run `vercel deploy --prod --yes` in this folder, or use Redeploy in the dashboard.

## Updating the frameworks

The prompts are copied from `workflow-agents/scripter`:
- `skills/script-analyzer-beginner`
- `clients/nick perry/SKILL-nick-v3-improved.md`
- `skills/script-optimizer`
- `skills/script-checker`

The client profiles are `clients/omer/client_guidelines.txt` plus `profiles/esteban.md` and `profiles/hireremotelatinos.md`.

After editing any of them, run `npm run sync-prompts`, then redeploy.
