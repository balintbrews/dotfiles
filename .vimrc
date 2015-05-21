set nocompatible
filetype off " Needed for Vundle. Will be turned on later.
set rtp+=~/.vim/bundle/Vundle.vim
call vundle#begin()
Plugin 'gmarik/Vundle.vim'

Plugin 'altercation/vim-colors-solarized'
Plugin 'chriskempson/vim-tomorrow-theme'
Plugin 'nanotech/jellybeans.vim'
Plugin 'kien/ctrlp.vim'
Plugin 'bling/vim-airline'
Plugin 'airblade/vim-gitgutter'
Plugin 'inside/vim-search-pulse'
Plugin 'mxw/vim-jsx'
Plugin 'tpope/vim-fugitive'
Plugin 'fatih/vim-go'
Plugin 'pangloss/vim-javascript'

call vundle#end()
filetype plugin indent on

set bg=dark
color Tomorrow-Night

" GUI-specific settings.
if has("gui_running")
  color solarized
  set bg=light
  set cursorline
  set guifont=Monaco:h14
  set guioptions=egmrLt
  set guioptions-=L
endif

" Airline config
if !exists('g:airline_symbols')
  let g:airline_symbols = {}
endif
let g:airline_left_sep = ''
let g:airline_right_sep = ''
let g:airline_symbols.linenr = '␊'
let g:airline_symbols.linenr = '␤'
let g:airline_symbols.linenr = '¶'
let g:airline_symbols.branch = '⎇'
let g:airline_symbols.paste = 'ρ'
let g:airline_symbols.paste = 'Þ'
let g:airline_symbols.paste = '∥'
let g:airline_symbols.whitespace = 'Ξ'
let g:airline_section_x=''
let g:airline_section_y=''
let g:airline_section_z='%P'
let g:airline#extensions#hunks#non_zero_only = 1

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
" When wrapping paragraphs, don't end lines with 1-letter words.
set formatoptions+=1
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

" Highlighting
if &t_Co > 2 || has("gui_running")
   " Switch syntax highlighting on, when the terminal has colors.
   syntax on
endif

" Language and autocompletion
set ofu=syntaxcomplete#Complete

" Sudo to write
cmap w!! w !sudo tee % >/dev/null

" Strip all trailing whitespace from a file, using ,w.
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

" Source the vimrc file after saving it.
if has("autocmd")
  autocmd bufwritepost .vimrc source $MYVIMRC
endif


" Shortcut for clearing the search register
nmap <silent> <leader>/ :nohlsearch<CR>
let g:vim_search_pulse_mode = 'pattern'

