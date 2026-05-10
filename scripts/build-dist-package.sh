#!/bin/bash
set -euo pipefail

MANIFEST="./shelter-manifest.json"
DIST="./dist"

echo "Cleaning dist..."
rm -rf "$DIST"
mkdir -p "$DIST"

echo "Building shelter manifest..."
bash ./scripts/build-shelter-manifest.sh

echo "Copying manifest to dist..."
cp "$MANIFEST" "$DIST/"

echo "Creating shelter folders and copying photos..."
while IFS=$'\t' read -r slug file; do
  mkdir -p "$DIST/$slug"
  cp "$file" "$DIST/$slug/"
done < <(jq -r '
  .shelters[]
  | .slug as $slug
  | .photos[]
  | [$slug, .fileName]
  | @tsv
' "$MANIFEST")

SHELTER_COUNT=$(jq '.shelters | length' "$MANIFEST")
echo "Done! Built dist package at $DIST ($SHELTER_COUNT shelters)"

echo "Zipping dist..."
mkdir -p ./data
rm -f ./data/shelters-data.zip
(cd "$DIST" && zip -r ../data/shelters-data.zip .)
echo "Created data/shelters-data.zip"
