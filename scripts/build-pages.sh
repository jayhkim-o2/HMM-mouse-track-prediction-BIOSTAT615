#!/usr/bin/env bash
# Assembles the folder that GitHub Pages publishes (_site/).
# The same script is used by the deploy workflow and for local preview,
# so what you see locally is exactly what goes live.
#
# Published layout (SPEC Section 4):
#   /index.html      <- site/index.html (the study site is the home page)
#   /site/...        <- the site's CSS and JS (index.html loads them as ./site/...)
#   /core/...        <- the shared math modules
#   /tests.html      <- browser test page
#   /dashboard/...   <- built React dashboard (or a placeholder until it exists)
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf _site
mkdir -p _site

cp site/index.html _site/index.html
cp -r site _site/site
cp -r core _site/core
cp tests.html _site/tests.html
cp -r tests _site/tests

# Build the dashboard only once it has a package.json (checkpoint step 8).
if [ -f dashboard/package.json ]; then
  (cd dashboard && npm ci && npm run build)
  cp -r dashboard/dist _site/dashboard
else
  mkdir -p _site/dashboard
  cp dashboard/placeholder.html _site/dashboard/index.html
fi

# Tell GitHub Pages not to run Jekyll (it would hide files starting with _).
touch _site/.nojekyll
echo "Built _site/"
