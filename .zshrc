# Include oh-my-zsh configuration.
ZSH=$HOME/.oh-my-zsh

# Load the candy theme.
ZSH_THEME="candy"

# Load plugins.
plugins=(git vi-mode)

source $ZSH/oh-my-zsh.sh

# Remove existing git aliases, I don't like them.
unalias g gst gl gup gp gc gca gco gb gba

# Include aliases.
source $HOME/.aliases
source $HOME/.aliases_project


export PATH=/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:/usr/X11/bin
