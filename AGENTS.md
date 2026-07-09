# Agent instructions

## Tmux config

After changing `tmux/dot-config/tmux/tmux.conf`, automatically reload the tmux config in the current tmux server when possible:

```sh
tmux source-file $HOME/.config/tmux/tmux.conf
```

## Herdr config

After changing `herdr/dot-config/herdr/config.toml`, automatically reload the Herdr config when possible:

```sh
herdr server reload-config
```

## Commit messages

Follow Conventional Commits:

```text
<type>(<scope>): <summary>
```

- Use the scope for the application or repo tool whose config changed, not a broad category directory.
  - For nested app configs, use the app directory name (for example, `terminal/dot-config/<app>` scopes to `<app>`).
  - For root-level scripts, use the top-level directory name as the scope.
- Keep the summary concise, imperative, and lowercase unless a proper noun requires otherwise.
- If a commit touches multiple unrelated applications, split it. If it cannot be split, omit the scope only as a last resort.

Example:

```text
chore(ghostty): delete unused themes
```
