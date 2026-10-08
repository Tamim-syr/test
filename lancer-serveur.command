#!/bin/sh
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then echo "Node.js n est pas installe : https://nodejs.org"; exit 1; fi
node server.js
