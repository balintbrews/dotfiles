#!/bin/bash

# Install dependencies for everyday work and to use in .bashrc.

# Define colors for nice output.
BLUE="\033[0;34m"
GREEN="\033[0;32m"
NC="\033[0m"

# Create .dotfiles_lib folder.
if [ -d "$HOME/.dotfiles_lib" ]; then
  rm -rf "$HOME/.dotfiles_lib"
fi
mkdir "$HOME/.dotfiles_lib"

# Install dependencies.
if ! command -v stow >/dev/null 2>&1; then
  echo -e "${BLUE}==> Installing GNU Stow.${NC}"
  if command -v brew >/dev/null 2>&1; then
    brew install stow
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y stow
  else
    echo -e "${BLUE}==> GNU Stow is required. Install it with your package manager.${NC}"
  fi
fi

echo -e "${BLUE}==> Downloading git-completion.bash.${NC}"
curl -o "$HOME/.dotfiles_lib/git-completion.bash" https://raw.githubusercontent.com/git/git/master/contrib/completion/git-completion.bash
# bash-git-prompt
echo -e "${BLUE}==> Downloading magicmonty/bash-git-prompt.${NC}"
git clone https://github.com/magicmonty/bash-git-prompt.git "$HOME/.dotfiles_lib/bash-git-prompt" --depth=1
# Vundle
echo -e "${BLUE}==> Downloading Vundle for Vim.${NC}"
git clone https://github.com/VundleVim/Vundle.vim.git "$HOME/.vim/bundle/Vundle.vim"
echo -e "${BLUE}==> Downloading Vim plugins.${NC}"
vim +PluginInstall +qall

echo -e "${GREEN}===> Dependencies are installed. Enjoy! ${NC}"
