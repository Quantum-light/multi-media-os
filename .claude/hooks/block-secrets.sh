#!/usr/bin/env bash
# Blocks a tool result that looks like it contains a secret (API keys, JWTs, private keys).
# Reads the hook payload on stdin; exits 2 to stop the agent and tell it why.
payload="$(cat)"
if printf '%s' "$payload" | grep -Eq '(sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16})'; then
  echo "Blocked: the output looks like it contains a secret. Never print or copy keys; use environment settings." >&2
  exit 2
fi
exit 0
