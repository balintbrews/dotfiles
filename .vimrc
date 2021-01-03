set nocompatible

" PLUGINS

filetype off " Needed for Vundle. Will be turned on later.
set rtp+=~/.vim/bundle/Vundle.vim
call vundle#begin()
Plugin 'gmarik/Vundle.vim'

Plugin 'airblade/vim-gitgutter'
Plugin 'digitaltoad/vim-jade'
Plugin 'elzr/vim-json'
Plugin 'fatih/vim-go'
Plugin 'inside/vim-search-pulse'
Plugin 'itchyny/lightline.vim'
Plugin 'jaxbot/syntastic-react'
Plugin 'junegunn/goyo.vim'
Plugin 'kien/ctrlp.vim'
Plugin 'mustache/vim-mustache-handlebars'
Plugin 'mxw/vim-jsx'
Plugin 'pangloss/vim-javascript'
Plugin 'phanviet/vim-monokai-pro'
Plugin 'reedes/vim-pencil'
Plugin 'scrooloose/syntastic'
Plugin 'tpope/vim-fugitive'
Plugin 'vim-scripts/confluencewiki.vim'

call vundle#end()
filetype plugin indent on


" APPEARANCE

set background=dark
set termguicolors
colorscheme monokai_pro
let g:lightline = { 'colorscheme': 'monokai_pro' }
if has("gui_running")
  set cursorline
  set guifont=JetBrains\ Mono\ Regular\ 12
  set linespace=4
  set guioptions=egrLt
  set guioptions-=L
endif

" GENERAL CONFIGURATION

let mapleader=","
set noshowmode
set tabstop=2
set softtabstop=4
" Insert space characters when tab is pressed.
set expandtab
" Number of spaces to use for autoindenting.
set shiftwidth=2
" Use multiple of shiftwitdh when indenting with '<' and '>'.
set shiftround
" Allow backspacing over everything in insert mode.
set backspace=indent,eol,start
set autoindent
" Copy the previous indentation on autoindending.
set copyindent
" Show line numbers.
set number
" Display the current cursor position in the lower right corner.
set ruler
" Display a vertical line after the 80st column
set textwidth=80
set colorcolumn=+1
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
" Show a status line.
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

" Copy/Cut/paste from/to global clipboard with Ctrl+C/X/V.
" https://superuser.com/a/189198
vmap <C-c> "+yi
vmap <C-x> "+c
vmap <C-v> c<ESC>"+p
imap <C-v> <C-r><C-o>+

" Highlighting
if &t_Co > 2 || has("gui_running")
   " Switch syntax highlighting on, when the terminal has colors.
   syntax on
endif

" Language and autocompletion
set ofu=syntaxcomplete#Complete

" Source .vimrc after saving it.
if has("autocmd")
  autocmd bufwritepost .vimrc source $MYVIMRC
endif


" SHORTCUTS

" Shortcut for clearing the search register
nmap <silent> <leader>/ :nohlsearch<CR>

" Sudo to write
cmap w!! w !sudo tee % >/dev/null

" Strip all trailing whitespace from a file, using ,w.
nnoremap <leader>W :%s/\s\+$//<CR>:let @/=''<CR>


" FILETYPE ASSOCIATIONS

if has("autocmd")
  augroup module
    " Drupal-specific files
    autocmd BufRead,BufNewFile *.module set filetype=php
    autocmd BufRead,BufNewFile *.inc set filetype=php
    autocmd BufRead,BufNewFile *.install set filetype=php
    autocmd BufRead,BufNewFile *.test set filetype=php
    autocmd BufRead,BufNewFile *.profile set filetype=php
    " JSON files
    autocmd BufRead,BufNewFile *.json set filetype=json
  augroup END
endif

" PLUGIN CONFIGURATION

" Search pulse
let g:vim_search_pulse_mode = 'pattern'

" CtrlP
" Exclude files that are excluded by .gitignore.
let g:ctrlp_user_command = ['.git/', 'git --git-dir=%s/.git ls-files -oc --exclude-standard']

" Syntastic
let g:syntastic_always_populate_loc_list = 1
let g:syntastic_auto_loc_list = 1
let g:syntastic_check_on_open = 0
let g:syntastic_check_on_wq = 0
let g:syntastic_error_symbol = '✗'
let g:syntastic_warning_symbol = '!'
let g:syntastic_javascript_checkers = ['eslint']
let g:syntastic_scss_checkers = ['']
let g:syntastic_json_checkers=['jsonlint']
let g:syntastic_php_checkers = ['php', 'phpcs']
let g:syntastic_php_phpcs_args="--standard=Drupal --extensions=php,module,inc,install,test,profile,theme"

" Command to switch to distraction-free writing mode.
command! Write call Writing()
function! Writing()
    Goyo
    PencilSoft
    set ft=markdown
    set guifont=JetBrains\ Mono\ Regular\ 16
    set lines=30 columns=100
    set linespace=8
    set nocursorline
    set guioptions-=r
endfunction
