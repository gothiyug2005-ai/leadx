# Putting LeadX online

This guide takes LeadX from GitHub to a live address on Vercel. It takes about
an hour the first time. Account and key details for each service are in
[SETUP.md](./SETUP.md); this page covers the order to do things in and how to
check it worked.

## Before you start

You need accounts at GitHub (you have this), Vercel, Supabase and Google Cloud.
Anthropic, Apollo, Hunter, Tavily and Inngest are optional at first: without
them LeadX runs with clearly labelled sample data.

## 1. Create the database

Follow **SETUP.md §1**: create a Supabase project and run the three files in
`supabase/migrations/` in order. Leave the URL settings (step 5) for now; you
need the Vercel address first.

## 2. Import the project into Vercel

1. Sign in at https://vercel.com with your GitHub account.
2. Click **Add New → Project**, pick `leadx`, and click **Import**.
3. Vercel detects Next.js and pnpm on its own. Do not change the build settings.
4. Before clicking **Deploy**, open **Environment Variables** and add at least:

| Variable                               | Value                                           |
| -------------------------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                  | `https://<your-project>.vercel.app`             |
| `NEXT_PUBLIC_SUPABASE_URL`             | from Supabase                                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | from Supabase                                   |
| `SUPABASE_SECRET_KEY`                  | from Supabase (secret)                          |
| `TOKEN_ENCRYPTION_KEY`                 | output of `openssl rand -base64 32`             |
| `USE_MOCK_PROVIDERS`                   | `false` once real keys are in, otherwise `true` |

Leave `ENABLE_DEV_LOGIN` unset in production. It is ignored there anyway.

5. Click **Deploy**. When it finishes, note your address, e.g.
   `https://leadx.vercel.app`. If it differs from what you put in
   `NEXT_PUBLIC_APP_URL`, fix that variable and redeploy.

## 3. Point sign-in at the live address

1. In Supabase, **Authentication → URL Configuration**: set the Site URL to
   your Vercel address and add `https://<your-address>/**` to Redirect URLs.
2. Set up Google sign-in (**SETUP.md §2**).
3. Open your address, click **Get started**, and sign in with Google. You
   should land on the Today page.

## 4. Turn on the real services

Add each key in Vercel (**Settings → Environment Variables**) and redeploy
(**Deployments → … → Redeploy**). Order of value:

1. `ANTHROPIC_API_KEY` (SETUP.md §3): real resume parsing and writing.
   `AI_DAILY_CALL_LIMIT` (default 300) caps calls per user per day.
2. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` plus the Gmail redirect URI
   `https://<your-address>/api/gmail/callback` (SETUP.md §7): real sending.
3. Background jobs (SETUP.md §8): needed for follow-ups and reply detection.
   Use the **Inngest** integration from the Vercel marketplace. Vercel's own
   cron on the free plan only runs once a day, which is too slow.
4. `APOLLO_API_KEY`, `HUNTER_API_KEY`, `TAVILY_API_KEY` or `EXA_API_KEY`
   (SETUP.md §4–6): real people, emails and research.

Settings → Connected services shows which ones LeadX can see.

## 5. Check it works

Do this once after each change above, with a test target:

- [ ] Sign in with Google and finish onboarding with a real resume PDF.
- [ ] Add a target from a real job posting link. People appear.
- [ ] Open a person, find their email, and refresh the research brief.
- [ ] Write a message, review it, and send it **to your own second email
      address** (add yourself as a person) to see a real Gmail send.
- [ ] Reply to that email from the second address. Within 10 minutes it shows
      in the Inbox with a suggested response, and follow-ups stop.
- [ ] Settings → Sending limit shows the right count; Insights shows the send.
- [ ] Export people to CSV from the Pipeline page.

## Good to know

- **Database changes later.** When a future update adds a file to
  `supabase/migrations/`, run it in the Supabase SQL Editor (or
  `pnpm exec supabase db push`) before or right after deploying.
- **Gmail and Google review.** LeadX reads replies, which Google calls a
  "restricted" scope. Until Google verifies the app, only people you add as
  test users (up to 100) can connect Gmail, and they see an "unverified app"
  warning. Public launch needs Google verification and a yearly security
  assessment.
- **Costs.** Vercel, Supabase and Inngest have free tiers that fit early use.
  AI and data providers are pay-as-you-go; every call is logged per user in
  the `api_usage` table.
- **Security.** Keys live only in Vercel's settings. Gmail tokens are
  encrypted in the database, every table is locked to its owner, and the
  daily send limit is enforced by the database itself.
