---
name: zed-active-project
description: Read the currently active project/workspace from Zed's local SQLite database. Use when the user asks what project is active in Zed, needs logic based on whether Zed is focused on the current repo, or wants to inspect Zed workspace/window state without using Accessibility/window-title APIs.
---

# Zed Active Project

Determine the currently active Zed project from Zed's persisted state.

Use this when you need to know which project Zed considers active, especially for notification/focus logic. Prefer this DB approach over `panes.active` / `items.active`: those flags are active per workspace and multiple workspaces may be marked active at once.

## Database locations

Try these paths in order:

```bash
$PI_ZED_DB
$OPENCODE_ZED_DB
$HOME/Library/Application\ Support/Zed/db/0-stable/db.sqlite
$HOME/.local/share/zed/db/0-stable/db.sqlite
```

## Key idea

Zed stores:

- the front/recent window stack in `kv_store`:
  - `key = 'session_window_stack'`
  - value is a JSON array of window IDs
- each window's active workspace in `scoped_kv_store`:
  - `namespace = 'multi_workspace_state'`
  - `key = <window_id>`
  - JSON value contains `active_workspace_id`
- workspace paths in `workspaces.paths`

The active project is:

1. last window ID in `session_window_stack`
2. that window's `active_workspace_id`
3. matching row in `workspaces`

## One-shot command

```bash
DB="$HOME/Library/Application Support/Zed/db/0-stable/db.sqlite"
sqlite3 -readonly -json "$DB" '
with front_window as (
  select json_extract(value, "$[#-1]") as window_id
  from kv_store
  where key = "session_window_stack"
), active_workspace as (
  select json_extract(value, "$.active_workspace_id") as workspace_id
  from scoped_kv_store
  where namespace = "multi_workspace_state"
    and key = (select window_id from front_window)
)
select
  (select window_id from front_window) as window_id,
  (select workspace_id from active_workspace) as active_workspace_id,
  w.paths as workspace_paths
from workspaces w
where w.workspace_id = (select workspace_id from active_workspace);
'
```

Example output:

```json
[
  {
    "window_id": 30064771073,
    "active_workspace_id": 4,
    "workspace_paths": "/Users/balint/Projects/dotfiles"
  }
]
```

## Matching against the current repo

To decide whether Zed is active on the current agent project, compare the agent `cwd` against every path in `workspace_paths`.

`workspace_paths` may be:

- JSON array text
- newline-separated paths
- NUL-separated paths
- a single path string

A project matches when `cwd` is equal to a workspace path or is inside it.

Shell example:

```bash
cwd="$PWD"
workspace_path="/Users/balint/Projects/dotfiles"
case "$cwd" in
  "$workspace_path"|"$workspace_path"/*) echo matches ;;
  *) echo different ;;
esac
```

## Notes and pitfalls

- Do not rely on `items.active` or `panes.active` to identify the globally active project. Multiple workspaces can have active panes/items.
- The `session_window_stack` + `multi_workspace_state.active_workspace_id` route is a better DB-only signal for the active Zed project.
- This is based on Zed's internal persisted state and may change with Zed versions.
- If the query returns no rows, treat the active project as unknown.
