# IndiaEra.in — AI Hindi News Portal

A deployable Netlify project. It fetches RSS headlines daily, asks Gemini to select and summarize the most relevant India-focused stories in Hindi, stores the digest in Netlify Blobs, and displays it on a responsive website.

## What it does

- Daily scheduled news collection at **08:00 India time** (02:30 UTC).
- RSS-based discovery with Google News RSS queries by default.
- Gemini-generated Hindi headlines, short summaries, categories and "why it matters".
- Source links retained with every story.
- Duplicate headline filtering and basic content constraints in the AI prompt.
- Netlify Blobs stores the latest digest; frontend reads `/api/news`.
- Mobile-responsive IndiaEra design.

## Important editorial limitation

This is an automated aggregator, not a fully reliable fact-checking newsroom. AI cannot independently prove a story true merely by reading RSS titles/snippets. The system tells the model not to add unsupported claims and preserves source links, but it can still make mistakes. Before enabling unattended public publishing, use reputable feeds, monitor function logs, and consider adding an editorial review queue. For sensitive subjects (health, finance, elections, crime, communal issues), automated publishing should be disabled or require human review.

The site publishes short summaries, not full articles. It links back to the publishers. Check each publisher's terms and RSS reuse policy before production use.

## Deploy to Netlify

1. Upload this folder to a new GitHub repository (or import it into Netlify).
2. In Netlify, create a new site from that repository.
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `public`
4. In **Site configuration → Environment variables**, add:
   - `GEMINI_API_KEY` — your Google AI Studio API key (keep secret; never put it in frontend code).
   - `GEMINI_MODEL` — optional; default is `gemini-2.5-flash`.
5. Redeploy the site after adding environment variables.
6. In Netlify → Functions, open `daily-news` and use **Run now** for the first test. Scheduled functions only run on published deploys.
7. Open the site. The homepage reads the saved digest from `/api/news`.

## Run locally

```bash
npm install
cp .env.example .env
# Add GEMINI_API_KEY to .env
npx netlify dev
```

To invoke the scheduled job manually in local Netlify Dev:

```bash
npx netlify functions:invoke daily-news
```

## Schedule

`netlify.toml` sets `30 2 * * *`, which is 08:00 in India (UTC+5:30). Netlify cron uses UTC.

## Customize news sources

Set `NEWS_FEED_URLS` as a multiline environment variable, one RSS URL per line. Default feeds use Google News RSS searches in Hindi and English. Prefer primary sources and reputable publishers. Verify feed availability and publisher terms before use.

## Security

- Never commit `.env`.
- Never expose `GEMINI_API_KEY` in browser JavaScript.
- Rotate the key if it is accidentally shared.
- Netlify environment variables must be scoped to Functions and the site must be redeployed after changes.
