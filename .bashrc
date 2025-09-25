## Set terminal app's window or tab title.
export PROMPT_COMMAND=title
title() {
  directory=${PWD##*/}
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo -ne "\033]0;$directory\007";
  else
    repository=$(basename "$(git rev-parse --show-toplevel)")
    echo -ne "\\033];$repository ❯ $directory\\007"
  fi
}

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
if command -v keychain &> /dev/null
then
  eval `keychain --agents ssh --eval id_rsa`
fi


# Exports.
export LANGUAGE=en_US.UTF-8
export LANG=en_US.UTF-8
export LC_CTYPE=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export EDITOR=vi
export TERM=xterm-256color
export CLICOLOR=true
export BASH_SILENCE_DEPRECATION_WARNING=1
export JAVA_HOME=$(/usr/libexec/java_home)
# Generic locations where executables may reside.
export PATH="/usr/local/bin:/usr/local/sbin:/usr/local/share:$PATH"
# Applications that only require to be downloaded and run.
export PATH="/opt:$PATH"
# Python
export PATH="$HOME/Library/Python/3.9/bin:$PATH"
# Globally installed Composer packages.
export PATH="$HOME/.composer/vendor/bin:$PATH"
# Making nvm work.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
export PATH="$NVM_DIR/versions/node/$(nvm current)/bin:$PATH"
# Required for Homebrew.
export HOMEBREW_PREFIX="/opt/homebrew";
export HOMEBREW_CELLAR="/opt/homebrew/Cellar";
export HOMEBREW_REPOSITORY="/opt/homebrew";
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin${PATH+:$PATH}";
export MANPATH="/opt/homebrew/share/man${MANPATH+:$MANPATH}:";
export INFOPATH="/opt/homebrew/share/info:${INFOPATH:-}";

# Include aliases.
source $HOME/.aliases
