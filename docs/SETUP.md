# LeadX setup guide

LeadX runs with sample data until each service is connected, so you can set
these up one at a time. Only **Supabase** is needed before anyone can sign in.

Never paste keys into chat, email or a code file. They go into your hosting
provider's environment variables (on Vercel: Project → Settings → Environment
Variables), and into `.env.local` on your own computer if you run it locally.

## 1. Supabase (required): database, sign-in, resume storage

1. Go to https://supabase.com, sign up, and click **New project**.
2. Pick a name (for example `leadx`), set a database password and save it
   somewhere safe, choose the region closest to you, and click **Create**.
3. When the project is ready, open **Project Settings → API Keys** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** → `SUPABASE_SECRET_KEY` (keep this one private)
4. Create the database tables. Either:
   - **Easiest:** open **SQL Editor**, then paste and run each file from
     `supabase/migrations/` in order (oldest first); or
   - **Command line:** `pnpm exec supabase link` then `pnpm exec supabase db push`.
5. Open **Authentication → URL Configuration**:
   - **Site URL:** your app address, e.g. `https://leadx.vercel.app`
   - **Redirect URLs:** add `https://leadx.vercel.app/**` and
     `http://localhost:3000/**`

## 2. Google sign-in (required for real users)

1. Go to https://console.cloud.google.com and create a project.
2. Open **APIs & Services → OAuth consent screen**. Choose **External**, fill
   in the app name (LeadX) and your email, and save.
3. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**
   - Authorised redirect URI: the **Callback URL** shown in Supabase under
     **Authentication → Sign In / Providers → Google** (it looks like
     `https://<your-project>.supabase.co/auth/v1/callback`)
4. Copy the **Client ID** and **Client secret** into Supabase on that same
   Google provider page, and switch the provider **on**.

The same Google client is reused for Gmail sending in a later step.

## 3. Anthropic (AI)

Without a key, every AI feature returns clearly labelled sample output.

1. Go to https://console.anthropic.com, sign up, and add a payment method
   under **Billing** (the API is pay-as-you-go).
2. Open **API Keys → Create Key**, name it `leadx`, and copy it.
3. Add it as `ANTHROPIC_API_KEY`. `ANTHROPIC_MODEL` defaults to
   `claude-opus-5-5`; leave it unless you want a different model.
4. Optional but sensible: set a monthly spend limit under **Limits**.

Every AI call is recorded per user in the `api_usage` table, so you can see
what each person costs.

## 4. Apollo (finding people)

Without a key, LeadX shows clearly labelled sample people.

1. Sign up at https://www.apollo.io and open **Settings → Integrations → API**.
2. Create an API key and switch on **Set as master key**: Apollo's People
   Search only accepts master keys.
3. Add it as `APOLLO_API_KEY`.

People Search itself uses no Apollo credits. It returns names with part of the
surname hidden and no email; LeadX fills those in during enrichment (next
step). Results are cached for 7 days to stay well within Apollo's hourly limit.

## 5. Hunter (finding and verifying emails)

Without a key, LeadX shows sample addresses.

1. Sign up at https://hunter.io and open **API** in your account menu.
2. Copy the API key and add it as `HUNTER_API_KEY`.

LeadX tries Hunter first, then Apollo (which uses Apollo credits and can also
reveal surnames that Apollo search hides). Every address is verified with
Hunter: "valid" can be emailed, "risky" (catch-all domains, personal webmail)
needs you to click **Use anyway**, and "invalid" is never emailed. Results are
cached for 30 days.

## 6. Tavily (company research)

1. Sign up at https://tavily.com and copy your API key.
2. Add it as `TAVILY_API_KEY` (leave `RESEARCH_PROVIDER=tavily`).

To use Exa instead, set `RESEARCH_PROVIDER=exa` and `EXA_API_KEY`. Company
research is shared by everyone you contact at that company and refreshed every
14 days.

## 7. Gmail (sending from your address)

Without this, sends to sample people are simulated and real people cannot be
emailed. Use the same Google Cloud project as sign-in (section 2).

1. **Enable the API:** APIs & Services → Library → search "Gmail API" → Enable.
2. **Consent screen:** APIs & Services → OAuth consent screen → Data access →
   Add scopes: `https://www.googleapis.com/auth/gmail.send` and
   `https://www.googleapis.com/auth/gmail.readonly`.
3. **Test users:** while the app is in "Testing", add the Google accounts that
   will use it (up to 100). Testing-mode tokens expire after 7 days, so users
   reconnect Gmail weekly until the app is verified.
4. **Redirect URI:** in your OAuth client (Credentials), add
   `https://YOUR-APP/api/gmail/callback` and
   `http://localhost:3000/api/gmail/callback`.
5. **Environment variables:** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from
   that OAuth client, and an encryption key for stored tokens:
   ```bash
   openssl rand -base64 32   # paste the output into TOKEN_ENCRYPTION_KEY
   ```
   Keep this key safe and never change it once users have connected: tokens
   encrypted with the old key cannot be read with a new one (users would simply
   need to reconnect).
6. Each user connects in **Settings → Gmail**.

**Before a public launch:** `gmail.readonly` is a Google _restricted_ scope.
Making the app public requires Google's OAuth verification and an annual
third-party security assessment (CASA). Plan for this before opening sign-ups
beyond your 100 test users.

How sending works: nothing is sent until you press Send in the review window;
the database checks your daily limit, your do-not-email list and the address
first; and every send is logged in `send_events`.

## 8. Background jobs (follow-ups and reply checks)

Two jobs keep sequences moving: one sends follow-ups that are due (every 5
minutes), one checks Gmail for replies (every 10 minutes). Without either set
up, nothing is sent automatically: follow-ups stay scheduled and replies are
only picked up when you press **Check for replies** in the Inbox.

**Option A: Inngest (recommended)**

1. Sign up at https://www.inngest.com and create an app.
2. Easiest on Vercel: install the Inngest integration from the Vercel
   marketplace, which adds `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` for you.
   Otherwise copy both keys from the Inngest dashboard into your environment.
3. Redeploy. Inngest finds the jobs at `/api/inngest` and runs them on schedule.

For local development, run `npx inngest-cli@latest dev` next to `pnpm dev`.

**Option B: a plain cron**

1. Generate a secret with `openssl rand -hex 32` and set it as `CRON_SECRET`.
2. Have your scheduler call `GET /api/cron/run` with the header
   `Authorization: Bearer <CRON_SECRET>` every 5 to 10 minutes. (Vercel Cron on
   the free plan runs at most once a day, which is too slow for follow-ups; use
   Inngest or an external cron service there.)

## 9. Optional services

Each one replaces sample data with the real thing. Details are added to this
guide as each feature is built.

| Service   | What it does                 | Variable(s)                                                        |
| --------- | ---------------------------- | ------------------------------------------------------------------ |
| Anthropic | AI parsing, ranking, writing | `ANTHROPIC_API_KEY`                                                |
| Apollo    | Finds people at a company    | `APOLLO_API_KEY`                                                   |
| Hunter    | Finds and verifies emails    | `HUNTER_API_KEY`                                                   |
| Tavily    | Company news for research    | `TAVILY_API_KEY`                                                   |
| Gmail     | Send from your address       | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY` |
| Inngest   | Scheduled follow-ups         | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`                         |

## Checking your setup

Open `/setup` on your app. It lists every service as **Connected** or
**Sample data**, without ever showing the values.

## Local development (developers only)

Requires Docker.

```bash
pnpm exec supabase start      # local database, auth and storage
cp .env.example .env.local    # then fill in the values `supabase start` prints
pnpm dev
```

Set `ENABLE_DEV_LOGIN=true` in `.env.local` to sign in without Google. It only
works against a local Supabase and never in a production build.

`pnpm test` runs the database security tests when `TEST_DATABASE_URL` is set
(the local value is `postgresql://postgres:postgres@127.0.0.1:54322/postgres`).
