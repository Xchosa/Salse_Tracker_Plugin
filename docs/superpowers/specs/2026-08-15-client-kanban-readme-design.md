# Client Kanban Root README Design

## Goal

Create a repository-root README that explains Client Kanban to salespeople, small teams, and potential contributors. Lead with the product vision, then provide a practical overview and route technical readers to the plugin source.

## Positioning

The README presents Client Kanban as an open, Markdown-native way to manage client relationships in Obsidian. It does not define itself through comparisons with named commercial products.

The core argument is:

- One client equals one ordinary Markdown file.
- YAML holds structured facts that boards and tools can reliably read.
- The Markdown body holds the complete human context: notes, history, objections, decisions, and follow-ups.
- The Kanban board is a view over those files, not a separate database.
- Moving a card changes only the configured stage property; the client file remains the source of truth.

## AI-first outlook

Markdown client records reduce the distance between stored information and useful AI assistance. An AI system can read the same files as the user without a proprietary export format or a second synchronization layer.

With structured YAML plus narrative history, future AI-assisted workflows can:

- Summarize a relationship before a call.
- Prepare conversation briefs from previous contacts and open questions.
- Identify missing follow-ups or stale relationships.
- Extract next actions from meeting notes.
- Suggest property updates while leaving the user in control of every write.
- Search and compare client histories across the vault.
- Help maintain consistent records without replacing the underlying Markdown.

The README must distinguish this outlook from current implemented features. It must not imply that autonomous AI actions, automatic follow-ups, or semantic analysis already ship in the plugin.

## Audience and reading order

The README serves both nontechnical users and contributors, in this order:

1. Project name and one-sentence description.
2. Vision and value of Markdown-native client ownership.
3. Current product behavior.
4. A compact board/client YAML example.
5. Current capabilities.
6. Honest first-version limitations.
7. Local installation and Obsidian usage.
8. pnpm development commands and source layout.
9. AI-first outlook.
10. Contribution invitation and project status.

## Tone

- Clear, practical, and confident.
- Accessible before technical.
- Positive positioning without competitor comparisons.
- Avoid inflated claims such as “revolutionary,” “effortless,” or “fully automated.”
- Explain YAML and Markdown through examples rather than assuming expertise.
- State that the plugin is under active development and recommend testing with backups or version control.

## Technical accuracy

The README must reflect the current implementation:

- Direct-child Markdown files in a configured folder become cards.
- `sales_stage` is an example; the stage property is configurable.
- Missing or unknown stages appear in Uncategorized.
- Clicking a card opens its client note.
- Dragging updates or removes only the configured stage property.
- Configured card fields are read-only and sparse.
- The board source opens through the pencil action.
- The ribbon reopens the last successfully opened board.
- Desktop/mobile eligibility is supported by the manifest, while actual manual device acceptance should not be overstated.
- The project uses pnpm, Vitest, TypeScript, esbuild, and Obsidian APIs.

## Documentation relationship

The new `/README.md` is the public repository landing page. It links to `plugin-development/client-kanban/README.md` for detailed development, deployment, board configuration, and the full manual smoke checklist.

The plugin README remains the operational reference and should not be duplicated wholesale into the root README.

## Acceptance criteria

- A nontechnical reader can understand the file-per-client model within the opening section.
- The AI-first benefit is concrete and explicitly future-facing.
- Current and future capabilities are clearly separated.
- Setup instructions use pnpm exclusively.
- The root README links to the plugin README and relevant source directory.
- No named commercial CRM comparison appears.
- All Markdown links resolve within the repository.
