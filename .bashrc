# Prompt
if [ -f "$HOME/.bash-git-prompt/gitprompt.sh" ]; then
  GIT_PROMPT_THEME=Custom
  source "$HOME/.bash-git-prompt/gitprompt.sh"
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

# Include aliases.
source $HOME/.aliases
source $HOME/.aliases_project


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

