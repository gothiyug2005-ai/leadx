# LeadX

An outreach copilot for job seekers. LeadX turns "I want a job at X" into a ranked list of the
right people, verified contact details, personal messages, and a managed follow-up pipeline.

**Core flow:** target → discover people → enrich (email + research) → write → send → follow up →
track → learn.

Build progress is tracked in [TASKS.md](./TASKS.md).

## Getting started

Requirements: Node 22+ and pnpm 10+.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000. LeadX needs a Supabase project to sign in (see
[docs/SETUP.md](./docs/SETUP.md)); every other service falls back to clearly labelled sample data
until its key is set.

## Scripts

| Command          | What it does                            |
| ---------------- | --------------------------------------- |
| `pnpm dev`       | Start the dev server                    |
| `pnpm build`     | Production build                        |
| `pnpm typecheck` | Generate route types and run TypeScript |
| `pnpm lint`      | ESLint                                  |
| `pnpm test`      | Unit tests (Vitest)                     |
| `pnpm format`    | Format with Prettier                    |

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript strict · Tailwind v4 · shadcn/ui ·
Supabase (Postgres, Auth, Storage, RLS) · Anthropic Claude API · Gmail API · Inngest · Zod ·
React Hook Form · TanStack Query · Vitest.

## Project structure

```
src/
  app/
    (marketing)/        Landing page
    (auth)/login/       Sign in
    (app)/              Signed-in screens: today, targets, inbox, pipeline, insights, settings
    api/inngest/        Background job endpoint
  components/ui/        shadcn/ui primitives
  components/           Shared app components
  lib/
    ai/prompts/         Versioned prompt functions
    ai/schemas/         Zod schemas for AI outputs
    providers/          people, email, research: interface + mock + registry in each
    supabase/ gmail/ inngest/ crypto/ usage/ validation/
    env.ts              Validated environment variables
supabase/migrations/    SQL migrations
tests/                  Unit tests
```

## Architecture rules

- Provider calls are server-side only, behind interfaces in `src/lib/providers/*`, so vendors are
  swappable. Each interface ships with a mock adapter.
- AI prompts live in `src/lib/ai/prompts/*` as versioned functions. AI output is validated with
  Zod before use.
- Research briefs and enrichment results are cached to save API credits.
- API usage is recorded per user, ready for credits and billing later.
- OAuth tokens are encrypted at rest.
- The daily send cap, opt-out, and "never email again" rules are enforced on the server and
  covered by tests.
- Every first email is reviewed by the user before it is sent.
- LinkedIn messages are copy-to-clipboard only. No LinkedIn scraping or automation, ever.

## Adding shadcn/ui components

`components.json` is configured, so on your machine:

```bash
pnpm dlx shadcn@latest add dialog
```

## Next.js version note

This project uses Next.js 16, which differs from older versions (for example, middleware is now
`proxy.ts`). The bundled docs in `node_modules/next/dist/docs/` are the reference; see
[AGENTS.md](./AGENTS.md).
