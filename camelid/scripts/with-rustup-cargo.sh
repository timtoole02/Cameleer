#!/usr/bin/env bash
set -euo pipefail

if [ -d "$HOME/.cargo/bin" ]; then
  export PATH="$HOME/.cargo/bin:$PATH"
fi

exec cargo "$@"
