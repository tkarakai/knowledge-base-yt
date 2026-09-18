#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
target="$root/.kb-local/transcripts"
if command -v uv >/dev/null 2>&1; then
  uv venv --python 3.11 --allow-existing "$target"
  uv pip install --python "$target/bin/python" -r "$root/scripts/transcript-requirements.txt"
else
  python3 -m venv "$target"
  "$target/bin/python" -m pip install -r "$root/scripts/transcript-requirements.txt"
fi
echo "YouTube transcript extractor installed. Retry captions in Commonplace."
