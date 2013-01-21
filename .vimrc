" Set vim settings rather then vi settings.
set nocompatible

set bg=dark
color Tomorrow-Night

" GUI-specific settings, e.g. for MacVim.
if has("gui_running")
  color jellybeans
  set cursorline
  set guifont=Monaco:h13
  set guioptions=egmrLt
  set guioptions-=L
endif

" Change the mapleader from \ to ,
let mapleader=","

" Always show what more we are currently editing in.
set showmode
" A tab is two spaces.
set tabstop=2
" When hitting <BS>, pretend like a tab is removed, even if spaces
set softtabstop=4
" Expands tab by default.
set expandtab
" Number of spaces to use for autoindenting.
set shiftwidth=2
" Use multiple of shiftwitdh when indenting with '<' and '>'.
set shiftround
" Allow backspacing over everything in insert mode.
set backspace=indent,eol,start
" Always set autoindenting on.
set autoindent
" Copy the previous indentation on autoindending.
set copyindent
" Always show line numbers.
set number
" Always display the current cursor position in the lower right corner.
set ruler
" Show matching paranthesis.
set showmatch
" Ignore case when searching.
set ignorecase
" Ignore case if search pattern is all lowercase, case-sensitive otherwise.
set smartcase
" Insert tabs on the start of a line according to shiftwitdh, not tabstop.
set smarttab
" Highlight search terms.
set hlsearch
" Show search matches as we type.
set incsearch
" Search/replace globally (on a line) by default.
set gdefault
" Enable using the mouse if terminal emulator supports it.
set mouse=a
" When wrapping paragraphs, don't end lines with 1-letter words.
set formatoptions+=1
" Always show a status line.
set laststatus=2
" Use a status bar that is 2 rows high.
set cmdheight=2
" Do not keep backup files.
set nobackup
" Do not write intermediate swap files.
set noswapfile
" Make tab completion for files/buffers act like bash.
set wildmenu
" Change the terminal's title.
set title
" Don't beep.
set visualbell
set noerrorbells

" Highlighting
if &t_Co > 2 || has("gui_running")
   syntax on                    " switch syntax highlighting on, when the terminal has colors
endif

" Language and autocompletion
filetype plugin on
set ofu=syntaxcomplete#Complete

" Sudo to write
cmap w!! w !sudo tee % >/dev/null

" Strip all trailing whitespace from a file, using ,w
nnoremap <leader>W :%s/\s\+$//<CR>:let @/=''<CR>

" Drupal-specific filetype settings
if has("autocmd")
  augroup module
    autocmd BufRead,BufNewFile *.module set filetype=php
    autocmd BufRead,BufNewFile *.inc set filetype=php
    autocmd BufRead,BufNewFile *.install set filetype=php
    autocmd BufRead,BufNewFile *.test set filetype=php
    autocmd BufRead,BufNewFile *.profile set filetype=php
  augroup END
endif

" Source the vimrc file after saving it
if has("autocmd")
  autocmd bufwritepost .vimrc source $MYVIMRC
endif

" Shortcut for clearing the search register.
nmap <silent> <leader>/ :nohlsearch<CR>

