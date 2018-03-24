# Prompt
if [ -f "$HOME/.dotfiles_lib/bash-git-prompt/gitprompt.sh" ]; then
  GIT_PROMPT_THEME=Custom
  source "$HOME/.dotfiles_lib/bash-git-prompt/gitprompt.sh"
fi

# Git completion
if [ -f "$HOME/.dotfiles_lib/git-completion.bash" ]; then
  source "$HOME/.dotfiles_lib/git-completion.bash"
fi

# Exports.
export LANGUAGE=en_US.UTF-8
export LANG=en_US.UTF-8
export LC_CTYPE=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export PATH="/usr/local/git/bin/git:/usr/local/bin:/usr/local/sbin:/usr/local/share:/usr/local/share/npm/bin:/Users/balint/scripts:$HOME/.composer/vendor/bin:$PATH"
export PATH=/usr/local/php5/bin:$PATH
export EDITOR=vi
export TERM=xterm-256color
export CLICOLOR=true
export XDEBUG_CONFIG="idekey=PHPSTORM"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Include aliases.
source $HOME/.aliases

# SSH alias to fix TERM problem.
function ssh {
  local old=$TERM
  TERM=xterm-color
  `which ssh` $@
  TERM=$old
}

# Make locate use Spotlight.
function locate {
  local root=$1
  shift
  mdfind -onlyin $root "kMDItemDisplayName == '$@'wc"
}

# Platform.sh configuration
export PATH='/Users/balint/.platformsh/bin':"$PATH"
source $HOME/.platformsh/shell-config.rc

