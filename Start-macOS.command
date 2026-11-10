#!/bin/zsh
cd -- "${0:A:h}"
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 22.13 or newer, then open this file again."
  read -r "reply?Press Return to close."
  exit 1
fi
if [[ ! -f node_modules/ethers/package.json ]]; then
  npm ci || exit 1
fi
npm start
