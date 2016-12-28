#!/bin/bash

if [ -d "$HOME/.dotfiles_lib" ]; then
  rm -rf "$HOME/.dotfiles_lib"
fi
mkdir "$HOME/.dotfiles_lib"

# Git completion
curl -o "$HOME/.dotfiles_lib/git-completion.bash" https://raw.githubusercontent.com/git/git/master/contrib/completion/git-completion.bash
# bash-git-prompt
git clone https://github.com/magicmonty/bash-git-prompt.git "$HOME/.dotfiles_lib/bash-git-prompt" --depth=1
# Vundle
git clone https://github.com/VundleVim/Vundle.vim.git "$HOME/.vim/bundle/Vundle.vim"
# Vim plugins
vim +PluginInstall +qall
# Dracula theme for Terminal.app
curl -o "$HOME/.dotfiles_lib/Dracula.terminal" https://raw.githubusercontent.com/dracula/terminal.app/master/Dracula.terminal
