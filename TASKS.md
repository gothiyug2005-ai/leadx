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

## Step 5: Targets

- [ ] Create from job posting (AI extraction)
- [ ] Create from company name or domain
- [ ] Target list with progress

## Step 6: People discovery

- [ ] Apollo adapter behind the people provider interface
- [ ] AI ranking with one-line reasons
- [ ] Connection angles
- [ ] Manual add

## Step 7: Enrichment

- [ ] Email finder waterfall (Hunter, Apollo)
- [ ] Email verification with valid / risky handling
- [ ] Research briefs (Tavily or Exa) with caching
- [ ] API usage tracking per user

## Step 8: AI writer

- [ ] Three variants with different angles
- [ ] Message types: cold email, referral request, LinkedIn note, LinkedIn DM, follow-up
- [ ] Inline edits
- [ ] Quality checker and length rules

## Step 9: Gmail sending

- [ ] Gmail OAuth with encrypted tokens
- [ ] Send from the user's address after review
- [ ] Daily cap enforced on the server, with tests
- [ ] Send logging

## Step 10: Sequences and replies

- [ ] Follow-ups on day 3 and day 7, stopping on reply
- [ ] Smart send time and randomised spacing
- [ ] Reply sync and inbox view
- [ ] AI reply classification and suggested responses
- [ ] Opt-out and "never email again", with tests

## Step 11: Pipeline and insights

- [ ] Kanban board per person
- [ ] Dashboard
- [ ] CSV export

## Step 12: Polish and launch

- [ ] Tests for critical logic
- [ ] Error and empty states pass
- [ ] Deploy to Vercel

## Open items

- Gmail read access is a Google "restricted" scope: public launch needs Google verification and
  an annual security assessment. Until then the app is limited to 100 test users.
