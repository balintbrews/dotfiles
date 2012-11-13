# Include oh-my-zsh configuration.
ZSH=$HOME/.oh-my-zsh

# Load the candy theme.
ZSH_THEME="candy"

# Include aliases.
source $HOME/.aliases
source $HOME/.aliases_project

# Load plugins.
plugins=(git vi-mode)

source $ZSH/oh-my-zsh.sh

export PATH=/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:/usr/X11/bin
