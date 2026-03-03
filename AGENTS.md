# AGENTS.md - dmux Maintainer Guide

This file is the maintainer-focused source of truth for working on dmux itself.

## Docs map

- `README.md`: end-user overview and install/usage.
- `CONTRIBUTING.md`: local development loop and PR workflow.
- `AGENTS.md` (this file): maintainer behavior, architecture landmarks, and current dev-mode workflow.

`CLAUDE.md` is a symlink to this file for tool compatibility.

## Project overview

dmux is a TypeScript + Ink TUI for managing parallel AI-agent work in tmux panes backed by git worktrees.

Core behavior:

- One project-scoped dmux session (stable name based on project root hash)
- One worktree per work pane
- Agent launch + prompt bootstrap in each pane
- Merge/close actions with worktree cleanup hooks
- Optional multi-project grouping in one session

## Important architecture landmarks

- `src/index.ts`: startup, tmux session attach/create, control pane management, dev-mode startup behavior
- `src/DmuxApp.tsx`: main TUI state, status/footer, input hookups, source switching
- `src/hooks/useInputHandling.ts`: keyboard and menu action handling
- `src/services/PopupManager.ts`: popup launch + data plumbing
- `src/actions/types.ts`: action registry and menu visibility rules
- `src/actions/implementations/closeAction.ts`: close behavior + source fallback on source-pane removal
- `src/components/panes/*`: pane list rendering (includes source indicator)

## Adding a new agent to the registry

The agent registry is centralized in `src/utils/agentLaunch.ts`.

1. Add the new ID to `AGENT_IDS` (this updates the `AgentName` type).
2. Add a full entry in `AGENT_REGISTRY` for that ID with:
   - metadata (`name`, `shortLabel`, `description`, `slugSuffix`)
   - install detection (`installTestCommand`, `commonPaths`)
   - launch behavior (`promptCommand`, `promptTransport`, plus `promptOption` or `sendKeys*` fields when needed)
   - permission mapping (`permissionFlags`) and `defaultEnabled`
   - optional resume behavior (`resumeCommandTemplate`) and startup command split (`noPromptCommand`)
3. Keep `shortLabel` unique and exactly 2 characters (enforced at runtime).

Most UI/settings surfaces consume `getAgentDefinitions()`, so they pick up registry additions automatically (for example, enabled-agents settings and chooser popups).

Related places to verify after adding an agent:

- `src/utils/agentDetection.ts` for install detection behavior
- `__tests__/agentLaunch.test.ts` for registry/permission/command expectations
- `docs/src/content/agents.js` (static docs page; update supported-agent docs when behavior changes)

Recommended validation:

```bash
pnpm run typecheck
pnpm run test
```

## Maintainer local workflow (dmux-on-dmux)

`pnpm dev` is the standard entry point when editing dmux.

What it does:

1. Bootstraps local docs/hooks (`dev:bootstrap`)
2. Compiles TypeScript once
3. Launches dmux in dev mode from `dist/index.js` (built runtime parity)
4. Auto-promotes to watch mode when launched in tmux

Result: changes in this worktree should recompile/restart automatically without repeated manual relaunches.

## Dev-mode source workflow

In DEV mode, a single source path is active at a time.

- Use pane menu action: `[DEV] Use as Source`
- Hotkey equivalent: `S`

Toggle semantics:

- Toggling on a non-source worktree pane switches source to that worktree.
- Toggling on the currently active source pane switches source back to project root.
- If the active source pane/worktree is closed or removed, source automatically falls back to project root.

UI cues:

- Footer shows `DEV MODE source: <branch>`
- Active source pane is marked with `[source]` in the pane list
- Dev-only actions are prefixed with `[DEV]` and only shown in DEV mode

## Dev diagnostics

Use:

```bash
pnpm run dev:doctor
```

Checks include:

- session exists
- control pane validity
- watch command detection
- active source path
- generated docs file presence
- local hooks presence

## Hooks and generated docs

`pnpm dev` and `pnpm dev:watch` both ensure generated hooks docs exist before runtime.

Key artifacts:

- `src/utils/generated-agents-doc.ts`
- local hooks under `.dmux-hooks/` (notably `worktree_created`, `pre_merge`)

## Pull request workflow

Recommended:

1. Run dmux from a maintainer worktree with `pnpm dev`.
2. Create worktree panes for features/fixes.
3. Iterate and merge via dmux.
4. Run checks before PR:

```bash
pnpm run typecheck
pnpm run test
```

## Notes for maintainers

- Keep `pnpm dev` as the default path for dmux development.
- Treat `dev:watch` as internal machinery behind the default `dev` entrypoint.
- Keep dev-only controls hidden outside DEV mode.
- Update this file when dev workflow behavior changes.

<!-- BEGIN BEADS INTEGRATION -->
## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Dolt-powered version control with native sync
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" --description="Detailed context" -t bug|feature|task -p 0-4 --json
bd create "Issue title" --description="What this issue is about" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update <id> --claim --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task atomically**: `bd update <id> --claim`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" --description="Details about what was found" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`

### Auto-Sync

bd automatically syncs via Dolt:

- Each write auto-commits to Dolt history
- Use `bd dolt push`/`bd dolt pull` for remote sync
- No manual export/import needed!

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and docs/QUICKSTART.md.

<!-- END BEADS INTEGRATION -->

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
