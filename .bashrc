## Ghostty's automatic Bash integration doesn't work with macOS /bin/bash, so
## source it manually as early as possible when available.
if [ -n "${GHOSTTY_RESOURCES_DIR:-}" ] && [ -r "${GHOSTTY_RESOURCES_DIR}/shell-integration/bash/ghostty.bash" ]; then
  builtin source "${GHOSTTY_RESOURCES_DIR}/shell-integration/bash/ghostty.bash"
fi

## Set prompt using magicmonty/bash-git-prompt. A custom theme is defined in
## .git-prompt-colors.sh.
if [ -f "$HOME/.dotfiles_lib/bash-git-prompt/gitprompt.sh" ]; then
  GIT_PROMPT_THEME=Custom
  source "$HOME/.dotfiles_lib/bash-git-prompt/gitprompt.sh"
fi
## Simplified prompt for screencasts. Uncomment to use.
# export PS1="\[\e[38;5;13m\]❯ \[\e[0m\]"

# Git completion
if [ -f "$HOME/.dotfiles_lib/git-completion.bash" ]; then
  source "$HOME/.dotfiles_lib/git-completion.bash"
fi

## Keep `ssh-agent` instance running with `keychain` where this utility is
## installed.
## See: https://unix.stackexchange.com/a/90869
if command -v keychain >/dev/null 2>&1; then
  eval "$(keychain --agents ssh --eval id_rsa)"
fi


# Exports.
OS_NAME="$(uname -s)"
export LANGUAGE=en_US.UTF-8
export LANG=en_US.UTF-8
export LC_CTYPE=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export EDITOR="code --wait"
export TERM=xterm-256color
export CLICOLOR=true
if [ "$OS_NAME" = "Darwin" ]; then
  export BASH_SILENCE_DEPRECATION_WARNING=1
fi
if [ "$OS_NAME" = "Darwin" ] && command -v /usr/libexec/java_home >/dev/null 2>&1; then
  export JAVA_HOME=$(/usr/libexec/java_home)
elif command -v java >/dev/null 2>&1; then
  export JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")"
fi
# Generic locations where executables may reside.
export PATH="/usr/local/bin:/usr/local/sbin:/usr/local/share:$HOME/.local/bin${PATH+:$PATH}"
# Applications that only require to be downloaded and run.
export PATH="/opt:$PATH"
# Python
if [ "$OS_NAME" = "Darwin" ]; then
  export PATH="$HOME/Library/Python/3.9/bin:$PATH"
fi
# Globally installed Composer packages.
export PATH="$HOME/.composer/vendor/bin:$PATH"
# Homebrew
if [ -d "/opt/homebrew" ]; then
  export HOMEBREW_PREFIX="/opt/homebrew"
  export HOMEBREW_CELLAR="/opt/homebrew/Cellar"
  export HOMEBREW_REPOSITORY="/opt/homebrew"
  export PATH="$HOMEBREW_PREFIX/bin:$HOMEBREW_PREFIX/sbin${PATH+:$PATH}"
  export MANPATH="$HOMEBREW_PREFIX/share/man${MANPATH+:$MANPATH}:"
  export INFOPATH="$HOMEBREW_PREFIX/share/info:${INFOPATH:-}"
fi
# pnpm
if [ "$OS_NAME" = "Darwin" ]; then
  export PNPM_HOME="$HOME/Library/pnpm"
else
  export PNPM_HOME="$HOME/.local/share/pnpm"
fi
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
if command -v nvm >/dev/null 2>&1; then
  export PATH="$NVM_DIR/versions/node/$(nvm current)/bin:$PATH"
fi

# Include aliases.
source "$HOME/.aliases"

# Source private bash configuration.
[ -f "$HOME/.bash_private" ] && source "$HOME/.bash_private"

## Set a useful terminal title for Ghostty tabs without overwriting other
## prompt hooks.
__dotfiles_set_terminal_title() {
  local title path_label repo_root repo_name repo_rel host_prefix

  if [ -n "${SSH_CONNECTION:-}" ]; then
    host_prefix="${HOSTNAME%%.*}:"
  else
    host_prefix=""
  fi

  if repo_root=$(git rev-parse --show-toplevel 2>/dev/null); then
    repo_name=$(basename "$repo_root")
    repo_rel=${PWD#"$repo_root"}
    if [ "$repo_rel" = "$PWD" ] || [ -z "$repo_rel" ]; then
      path_label="$repo_name"
    else
      path_label="$repo_name${repo_rel}"
    fi
  else
    path_label=${PWD/#$HOME/\~}
    if [ -z "$path_label" ]; then
      path_label="/"
    fi
  fi

  title="${host_prefix}${path_label}"
  printf '\033]0;%s\007' "$title"
}

if [[ $- == *i* ]]; then
  if [ -n "${PROMPT_COMMAND:-}" ]; then
    PROMPT_COMMAND="__dotfiles_set_terminal_title; ${PROMPT_COMMAND}"
  else
    PROMPT_COMMAND="__dotfiles_set_terminal_title"
  fi
fi
