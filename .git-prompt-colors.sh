override_git_prompt_colors() {
 
  GIT_PROMPT_THEME_NAME="balintbrews"
  GIT_PROMPT_STAGED="${Yellow}● "
  GIT_PROMPT_UNTRACKED="${Cyan}… "
  GIT_PROMPT_STASHED="${BoldMagenta}⚑ "
  GIT_PROMPT_IGNORE_STASH=1
  GIT_PROMPT_CLEAN="${Green}✔ "
  GIT_PROMPT_COMMAND_OK="${Green}✔ "
  GIT_PROMPT_COMMAND_FAIL="${Red}✘ "

  Time12a="\$(date +%H:%M:%S)"
  GIT_PROMPT_START_USER="\$(if [ -n \"\${SSH_CONNECTION:-}\${SSH_CLIENT:-}\${SSH_TTY:-}\" ]; then host=\$(hostname -s 2>/dev/null); if [ -n \"\$host\" ]; then printf '${Cyan}[${BoldMagenta}%s${Cyan}] ' \"\$host\"; fi; fi)${Yellow}${PathShort}"
  GIT_PROMPT_START_ROOT="${GIT_PROMPT_START_USER}"
  GIT_PROMPT_END_USER="\n${BoldBlue}❯ ${ResetColor}"
  GIT_PROMPT_END_ROOT="${GIT_PROMPT_END_USER}"
  GIT_PROMPT_LEADING_SPACE=1
  GIT_PROMPT_PREFIX="${Cyan}["
  GIT_PROMPT_SUFFIX="${Cyan}]" 
  GIT_PROMPT_SYMBOLS_NO_REMOTE_TRACKING="✭"
}

reload_git_prompt_colors "balintbrews"
