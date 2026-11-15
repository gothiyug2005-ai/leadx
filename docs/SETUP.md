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

## 4. Optional services

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
