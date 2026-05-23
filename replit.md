# Rintu — GitHub Issues Explorer

A live GitHub Issues search web app based on the `rintuchowdory/rintu` repository. Users can search any public GitHub repository's issues directly in the browser.

## Run & Operate

- `pnpm --filter @workspace/rintu run dev` — run the frontend (port assigned automatically)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, TanStack Query
- API: GitHub REST API (public, no auth required)
- Build: Vite static build

## Where things live

- `artifacts/rintu/src/pages/Search.tsx` — main search page (GitHub API calls, results, pagination)
- `artifacts/rintu/src/App.tsx` — app entry point
- `artifacts/rintu/src/index.css` — design tokens and theme

## Architecture decisions

- Calls GitHub REST API directly from the browser — no backend needed for public repo search
- TanStack Query handles caching, deduplication and loading states
- GitHub unauthenticated API allows 10 req/min — staleTime is set to 30s to reduce re-fetches
- State filter (open/closed/all) and optional keyword filter are composed into a single GitHub search query string
- Pagination capped at 100 pages (GitHub API limit)

## Product

Users can search any public GitHub repository's issues by typing `owner/repo`, optionally adding keywords or label filters, and toggling between open/closed/all states. Each result card shows the issue title, number, author, date, body preview, labels, and assignee.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- GitHub unauthenticated search API rate limit: 10 requests per minute. If rate limited, users see a clear error message.
- Pagination is capped at page 100 by the GitHub API regardless of total_count.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
