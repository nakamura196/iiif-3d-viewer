#!/usr/bin/env bash
# Verify that the static export under out/ contains sample manifest URLs that
# include the GH Pages basePath. Without this, the top page's sample buttons
# would point to `/manifests/...` and 404 when served from
# https://nakamura196.github.io/iiif-3d-viewer/.
#
# Usage: GITHUB_PAGES=true npm run build && ./scripts/check-basepath.sh
# (test:basepath script chains both.)
#
# Bash (not zsh) so it runs on GitHub Actions' default Ubuntu runner.
set -euo pipefail

OUT_DIR="out"
BASE="/iiif-3d-viewer"
# URL-encoded form of `/iiif-3d-viewer/manifests` (Footer links use encodeURIComponent).
ENCODED="%2Fiiif-3d-viewer%2Fmanifests"

if [[ ! -d "$OUT_DIR" ]]; then
  echo "FAIL: $OUT_DIR not found. Run 'GITHUB_PAGES=true npm run build' first." >&2
  exit 1
fi

# Scope the check to rendered HTML only. Compiled JS chunks legitimately contain
# the raw string `"/manifests/sample-manifest.json"` as the argument to the
# `withBasePath(...)` helper — those are not final URLs and would false-positive
# any raw-form check. The thing that actually causes a 404 on GH Pages is a
# *rendered href / query-string* in an HTML page pointing to a bare manifest
# path; that is what we look for here.
#
# `find ... | xargs grep` is used instead of bash 4's `mapfile` so this also
# runs on macOS bash 3.2 during local verification.
HTML_COUNT=$(find "$OUT_DIR" -type f -name '*.html' | wc -l)
if [[ "$HTML_COUNT" -eq 0 ]]; then
  echo "FAIL: no HTML files under $OUT_DIR." >&2
  exit 1
fi

# Bad pattern: bare encoded manifest path immediately after a `=` (URL param
# boundary). Anchoring on `=` is required because the correct, basePath-prefixed
# URL `%2Fiiif-3d-viewer%2Fmanifests%2F...` contains `%2Fmanifests%2F...` as a
# substring; without the boundary the check matches the good URL.
BAD_ENCODED='=%2Fmanifests%2Fsample-manifest'

# `grep -r --include='*.html'` keeps the scope to HTML and avoids array
# plumbing. `|| true` suppresses grep's exit 1 on no-match so `set -e` does
# not terminate the script before we can branch on the result.
BAD_HITS=$(grep -rEl --include='*.html' "$BAD_ENCODED" "$OUT_DIR" || true)
if [[ -n "$BAD_HITS" ]]; then
  echo "FAIL: found bare encoded manifest path (missing basePath) in HTML:" >&2
  echo "$BAD_HITS" | head -5 >&2
  exit 1
fi

GOOD_HITS=$(grep -rEl --include='*.html' "$ENCODED" "$OUT_DIR" || true)
if [[ -z "$GOOD_HITS" ]]; then
  echo "FAIL: did not find basePath-prefixed manifest URL ('$ENCODED') in HTML." >&2
  echo "      Did the sample buttons get removed?" >&2
  exit 1
fi

echo "OK: sample manifest URLs in $OUT_DIR include basePath ($BASE)."
