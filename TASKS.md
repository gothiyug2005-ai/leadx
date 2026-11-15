# LeadX build plan

Each step ships as its own branch and pull request, reviewed before the next one starts.

## Step 1: Scaffold ✅

- [x] Next.js 16 + TypeScript strict + Tailwind v4
- [x] shadcn/ui setup and base components (button, card, input, label, badge, separator, skeleton)
- [x] Folder structure, route groups, placeholder pages
- [x] Validated environment variables and `.env.example`
- [x] Provider interfaces with mock adapters (people, email, research)
- [x] Prompt definition type, Anthropic client stub, Inngest endpoint
- [x] Vitest, Prettier, ESLint, CI workflow
- [x] README and this file

## Step 2: Database and auth ✅

- [x] Schema for profiles, companies, targets, people, research briefs, messages,
      sequences, threads, suppressions, send log, API usage, Gmail tokens, provider cache
- [x] Row Level Security on every table, plus a private resumes bucket
- [x] Send gate in the database: approval, daily cap, opt-outs, risky addresses, sample data
- [x] Google sign-in, sign-out, protected routes, local-only dev login
- [x] Setup status page and docs/SETUP.md
- [x] Database security tests

## Step 3: App shell ✅

- [x] Desktop sidebar and phone tab bar, with an Inbox badge and today's email allowance
- [x] Today page: replies to handle, follow-ups due, who to contact, in the user's timezone
- [x] First-run checklist, empty states, loading skeletons, error and not-found screens

## Step 4: Onboarding ✅

- [x] Shared AI runner: schema-checked output, refusal and error handling, fallback model, usage tracking, sample mode
- [x] Resume upload (private storage) and AI parsing into an editable profile
- [x] "Your story" helper: 3-4 questions, then a 2-line positioning statement with alternatives
- [x] Tone picker and writing sample
- [x] Settings page: resume, profile, story, tone, daily sending limit, connected services

## Step 5: Targets ✅

- [x] Create from a job posting link (protected fetcher) or pasted text, with AI extraction and review
- [x] Create from a company name and website, or from a specific person
- [x] Target list with progress (found / contacted / replied), paused and archived section
- [x] Target page with role details, edit, pause, archive and delete

## Step 6: People discovery ✅

- [x] Apollo People Search adapter behind the people provider interface, with a shared 7-day cache
- [x] Search titles picked from the role (manager, peers, recruiters, leadership)
- [x] AI ranking with role type, 0-100 score and a one-line reason; 3-5 top picks
- [x] Connection angles (shared school, past company, city, skills), detected by rules plus AI
- [x] Manual add, top-pick toggle, "never email again", remove; person page

## Step 7: Enrichment ✅

- [x] Email finder waterfall (Hunter, then Apollo enrichment, which also reveals hidden surnames)
- [x] Hunter verification: valid / risky (accept-all, webmail) / invalid; risky needs "Use anyway"
- [x] Company brief (shared, 14 days) and person brief from Tavily or Exa search, with source-checked links
- [x] Provider results cached (failed lookups never cached); every call recorded in api_usage
- [x] Contact card, research card, "Find emails for top picks"

## Step 8: AI writer ✅

- [x] Three drafts with different angles (shared background, skills match, company news, team curiosity), only angles the data supports
- [x] Message types: cold email, referral request, LinkedIn note (300 chars), LinkedIn message, follow-up
- [x] Quick edits: shorten, warmer, more specific, rewrite one paragraph
- [x] Live quality checker: length, subject, generic phrases, one ask, opt-out, placeholders, numbers not in your profile
- [x] Split-view composer on the person page; LinkedIn is copy-to-clipboard only

## Step 9: Gmail sending ✅

- [x] Separate Gmail consent (send + read) with state check; tokens AES-256-GCM encrypted at rest, refreshed automatically
- [x] Review-and-send dialog: nothing is sent without the user pressing Send; blocking quality issues stop it
- [x] Send through the database send gate (daily cap, suppressions, do-not-contact, verified address, sample data)
- [x] Gmail provider (RFC 5322, header-injection safe, threading headers) and a simulated provider for sample people
- [x] Send log (send_events), sent history on the person page, person moves to "Contacted"
- [x] Settings: connect, reconnect, disconnect (token revoked)

## Step 10: Sequences and replies ✅

- [x] Optional follow-ups on day 3 and day 7, written at send time, editable and cancellable, stopped by any reply
- [x] Smart send time: weekday 09:00-11:30 in the recipient's time zone, random minute; sends spaced a few minutes apart
- [x] Daily cap hit by a follow-up defers it to the next morning instead of dropping it
- [x] Inngest jobs (send due every 5 min, sync replies every 10 min) and a CRON_SECRET-protected /api/cron/run
- [x] Gmail reply sync via the history API; bounces and out-of-office replies recognised
- [x] AI reply classification (interested, referral offered, not now, not relevant, opt-out) and suggested replies
- [x] Inbox and conversation view; reply in the same thread; mark handled; "got an interview"
- [x] Opt-outs and bounces suppress the address everywhere; covered by database tests
- [x] Sample people: simulated replies to try the whole flow

## Step 11: Pipeline and insights ✅

- [x] Pipeline board: To contact → Contacted → Followed up → Replied → Interview → Offer/Closed; drag or "Move to" menu, optimistic with undo on error; search and target filter
- [x] Insights: emails sent, reply rate (per person contacted), interviews, offers; weekly sends vs replies (8 weeks, user's time zone) with table view; funnel; reply rate by first-email angle and by contact type
- [x] Chart colours validated for colour-blind separation and contrast in light and dark
- [x] CSV export of everyone found, safe against spreadsheet formula injection

## Step 12: Polish and launch

- [x] Tests for critical logic (send gate, sequences and RLS now also run in CI against a real
      database)
- [x] Error and empty states pass (phone and desktop sweep of every screen)
- [x] Security headers and a per-user daily AI allowance
- [x] Deploy guide: [docs/DEPLOY.md](./docs/DEPLOY.md)
- [ ] Deploy to Vercel (needs your accounts; follow the guide)

## Open items

- Gmail read access is a Google "restricted" scope: public launch needs Google verification and
  an annual security assessment. Until then the app is limited to 100 test users.
