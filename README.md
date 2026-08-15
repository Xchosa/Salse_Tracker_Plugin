# Client Kanban

Client Kanban is an open Obsidian plugin for salespeople and small teams who want each client relationship to live in one ordinary Markdown file: structured enough for a board, and detailed enough for the real conversation.

## One client, one Markdown file

Every client is a note you own in your vault. Its YAML frontmatter keeps a few consistent facts, while the Markdown body holds the context that rarely fits neatly in a field: meeting notes, objections, decisions, history, and next steps. There is no separate client database to keep in sync.

The Kanban board is a view over those files. Moving a card changes only the configured stage property in that client's note, so the Markdown file remains the source of truth.

## Why this structure is AI-friendly

Markdown keeps structured facts and the narrative around them together in a portable, readable format. A person can open and edit a record directly, while tools can reliably read the YAML fields. That shared format avoids needing a proprietary export or a second synchronization layer just to understand the relationship history.

## What works today

The plugin turns the direct-child Markdown files in a configured folder into cards. You can open a client note by clicking its card, and drag cards between stages to update the configured stage property. Missing, empty, or unrecognized stages are shown in **Uncategorized**.

Configured card fields are read-only and appear only when they have a value. A client without a `client_name` uses its filename as the card title. The board's pencil action opens its Markdown source for editing, and the ribbon action reopens the last board that opened successfully.

## How the data model works

Create a board note with a small YAML configuration. `sales_stage` is only an example: you choose the property name and the stages that suit your process.

```yaml
---
client_kanban: true
source_folder: Clients
stage_property: sales_stage
columns:
  - Discovery
  - Follow-up
  - Proposal
card_fields:
  - contact_person
  - next_appointment
---
```

Then give each direct client note in `Clients` its own frontmatter and Markdown history:

```yaml
---
client_name: Northstar Studio
sales_stage: Discovery
contact_person: Sam Lee
next_appointment: 2026-08-20
---

# Northstar Studio

Interested in a pilot after the August planning meeting.
```

## Current scope

This is an early, focused client board. It reads direct-child Markdown notes in one configured folder; nested notes are not cards. The plugin's manifest permits installation on desktop and mobile Obsidian, but device-specific use still needs your own testing.

Client Kanban is under active development. Keep normal vault backups or version control while evaluating it, especially before using it for important client records.

## Install and try it locally

1. Clone this repository and install the plugin dependencies:

   ```sh
   cd plugin-development/client-kanban
   pnpm install
   pnpm build
   ```

2. Copy the built plugin files to your vault's `.obsidian/plugins/client-kanban` directory. The included deployment helper can target a vault explicitly:

   ```sh
   ./tools/deploy.sh /path/to/vault/.obsidian/plugins/client-kanban
   ```

3. In Obsidian, enable **Client Kanban** under **Settings → Community plugins**. Create a board note with `client_kanban: true`, then choose **Open as Client Kanban** from the note's context menu or run **Open current note as Client Kanban** from the command palette.

For configuration details, deployment notes, and the manual smoke checklist, see the [plugin technical README](plugin-development/client-kanban/README.md).

## Development

The plugin source is in [plugin-development/client-kanban/](plugin-development/client-kanban/). It uses pnpm, TypeScript, Vitest, esbuild, and the Obsidian APIs.

Run these commands from that directory:

```sh
pnpm install
pnpm test
pnpm build
```

Use `pnpm dev` for an unminified development bundle. The [plugin technical README](plugin-development/client-kanban/README.md) covers local deployment and the full manual verification checklist.

## AI-first outlook

The current plugin does not ship AI automation. Its Markdown-native records make future AI-assisted workflows practical because an AI system could read the same structured facts and narrative history as the team.

That outlook includes relationship summaries before calls, meeting preparation from past contacts and open questions, follow-up or stale-relationship detection, next-action extraction from notes, cross-vault history comparison, and suggested property updates. These are future possibilities, not shipped behavior; people remain in control of every change to their client files.

## Contributing and project status

Contributions are welcome while Client Kanban is under active development. Start with the [plugin source directory](plugin-development/client-kanban/) and its [technical README](plugin-development/client-kanban/README.md), which describe the codebase, tests, deployment flow, configuration, and manual smoke checks.
