#!/usr/bin/env zsh
# Verify that the static export under out/ contains sample manifest URLs that
# include the GH Pages basePath. Without this, the top page's sample buttons
# would point to `/manifests/...` and 404 when served from
# https://nakamura196.github.io/iiif-3d-viewer/.
#
# Usage: GITHUB_PAGES=true npm run build && ./scripts/check-basepath.sh
# (test:basepath script chains both.)
set -euo pipefail

OUT_DIR="out"
BASE="/iiif-3d-viewer"
# URL-encoded form of `/iiif-3d-viewer/manifests` (Footer links use encodeURIComponent).
ENCODED="%2Fiiif-3d-viewer%2Fmanifests"
# Raw form (Input onClick paths surface as inline JS data).
RAW="${BASE}/manifests"

if [[ ! -d "$OUT_DIR" ]]; then
  print -r -- "FAIL: $OUT_DIR not found. Run 'GITHUB_PAGES=true npm run build' first." >&2
  exit 1
fi

# Scope the check to rendered HTML only. Compiled JS chunks legitimately contain
# the raw string `"/manifests/sample-manifest.json"` as the argument to the
# `withBasePath(...)` helper — those are not final URLs and would false-positive
# any raw-form check. The thing that actually causes a 404 on GH Pages is a
# *rendered href / query-string* in an HTML page pointing to a bare manifest
# path; that is what we look for here.
HTML_FILES=("$OUT_DIR"/**/*.html(N))
if (( ${#HTML_FILES} == 0 )); then
  print -r -- "FAIL: no HTML files under $OUT_DIR." >&2
  exit 1
fi

# Bad pattern: bare encoded manifest path immediately after a `=` (URL param
# boundary). Anchoring on `=` is required because the correct, basePath-prefixed
# URL `%2Fiiif-3d-viewer%2Fmanifests%2F...` contains `%2Fmanifests%2F...` as a
# substring; without the boundary the check matches the good URL.
BAD_ENCODED='=%2Fmanifests%2Fsample-manifest'

if grep -Eq "$BAD_ENCODED" "${HTML_FILES[@]}"; then
  print -r -- "FAIL: found bare encoded manifest path (missing basePath) in HTML:" >&2
  grep -El "$BAD_ENCODED" "${HTML_FILES[@]}" | head -5 >&2
  exit 1
fi

# Good pattern: at least one occurrence of the basePath-prefixed manifest URL.
if ! grep -Eq "$ENCODED" "${HTML_FILES[@]}"; then
  print -r -- "FAIL: did not find basePath-prefixed manifest URL ('$ENCODED') in HTML." >&2
  print -r -- "      Did the sample buttons get removed?" >&2
  exit 1
fi

print -r -- "OK: sample manifest URLs in $OUT_DIR include basePath ($BASE)."
