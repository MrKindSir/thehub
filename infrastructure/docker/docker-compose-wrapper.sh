#!/bin/bash
# Ensures environment variables from ~/.zshrc (macOS) or ~/.profile (VPS) are available.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f ~/.zshrc ]; then
    # shellcheck disable=SC1090
    source ~/.zshrc
elif [ -f ~/.profile ]; then
    # shellcheck disable=SC1090
    source ~/.profile
fi

cd "$SCRIPT_DIR"
docker compose "$@"
