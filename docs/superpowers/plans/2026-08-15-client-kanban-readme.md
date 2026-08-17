# Client Kanban Root README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a public repository-root README that explains the Markdown-native Client Kanban vision, current behavior, setup, contribution workflow, and future AI-assisted outlook.

**Architecture:** The root README is the vision-first landing page for users and contributors. It links to the existing plugin README for detailed operations and avoids duplicating the full smoke-test reference.

**Tech Stack:** Markdown documentation, Obsidian, TypeScript plugin, pnpm.

## Global Constraints

- Follow `docs/superpowers/specs/2026-08-15-client-kanban-readme-design.md` exactly.
- Do not mention or compare against named commercial CRM products.
- Separate implemented capabilities from future AI-assisted possibilities.
- Use pnpm exclusively in all commands.
- Link to `plugin-development/client-kanban/` and its README with valid relative Markdown links.
- Do not alter plugin source, runtime assets, SaleTest notes, or documentation ignore settings.

---

### Task 1: Write and verify the repository landing page

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: current behavior documented in `plugin-development/client-kanban/README.md` and the approved README design.
- Produces: repository landing page linking to `plugin-development/client-kanban/README.md` and `plugin-development/client-kanban/`.

- [ ] **Step 1: Write the README from the approved structure**

Create sections in this order:

```text
# Client Kanban
opening value proposition
## One client, one Markdown file
## Why this structure is AI-friendly
## What works today
## How the data model works
## Current scope
## Install and try it locally
## Development
## AI-first outlook
## Contributing and project status
```

Include compact board and client YAML examples. State plainly that AI summaries, meeting preparation, follow-up detection, and suggested updates are an outlook rather than shipped automation.

- [ ] **Step 2: Verify content contracts**

Run from the repository root:

```bash
rg -n '^# Client Kanban$|^## One client, one Markdown file$|^## Why this structure is AI-friendly$|^## What works today$|^## How the data model works$|^## Current scope$|^## Install and try it locally$|^## Development$|^## AI-first outlook$|^## Contributing and project status$' README.md
rg -n 'pnpm install|pnpm test|pnpm build|plugin-development/client-kanban/README.md|plugin-development/client-kanban/' README.md
git diff --check -- README.md
```

Expected: every required heading, command, and link is present; whitespace check is clean.

- [ ] **Step 3: Validate relative links and current claims**

Resolve every repository-relative Markdown link in `README.md` against the worktree and confirm each target exists. Compare every “works today” claim with current plugin source/README; remove any claim that is only aspirational.

- [ ] **Step 4: Commit the README**

```bash
git add README.md
git commit -m "docs: add client kanban project readme"
```

---

## Final acceptance

- [ ] Nontechnical readers understand the file-per-client model from the opening.
- [ ] Current and future capabilities are clearly separated.
- [ ] The AI-first outlook explains concrete benefits without claiming shipped automation.
- [ ] pnpm is the only package manager shown.
- [ ] Relative links resolve.
- [ ] No unrelated files are changed.
