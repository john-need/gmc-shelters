#!/bin/bash
set -euo pipefail

DB="./database/gmc_shelters.sqlite"
SRC="./shelters.json"
PHOTOS="./photos.json"
TIMELINES="./timelines.json"
DEST="./shelter-manifest.json"
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

if [ ! -f "$DB" ]; then
  echo "Error: $DB not found" >&2
  exit 1
fi

if ! command -v pandoc &>/dev/null; then
  echo "Error: pandoc is required for markdown conversion. Install with: brew install pandoc" >&2
  exit 1
fi

warn() { printf '\033[31mWarning: %s\033[0m\n' "$*" >&2; }

echo "Exporting shelters from database..."
sqlite3 -json "$DB" 'SELECT * FROM shelters ORDER BY id' > "$SRC"

echo "Exporting timelines from database..."
sqlite3 -json "$DB" 'SELECT * FROM timelines ORDER BY id' > "$TIMELINES"

echo "Exporting photos from database..."
sqlite3 -json "$DB" 'SELECT * FROM photos ORDER BY id' > "$PHOTOS"

JQ_FILTER='
  .[$idx] as $raw |
  ($raw | if (.is_extant == 1) and (.end_year == 0) then .end_year = null else . end) as $s |
  ([$timelines[0][] | select(.shelter_id == $s.id)] | sort_by(.year)) as $sorted |
  (
    if ($sorted | length) == 0 then
      [{id: null, name: $s.name, latitude: $s.latitude, longitude: $s.longitude,
        notes: null, shelter_id: $s.id, startYear: $s.start_year, endYear: $s.end_year,
        slug: $s.slug, default_photo_id: $s.default_photo_id, is_extant: ($s.is_extant == 1)}]
    else
      ($sorted | length) as $n |
      [range($n) | . as $i |
        $sorted[$i] +
        {startYear: $sorted[$i].year,
         endYear: (if $i < ($n - 1) then $sorted[$i+1].year - 1 else $s.end_year end),
         slug: $s.slug, default_photo_id: $s.default_photo_id, is_extant: ($s.is_extant == 1)}
      ] |
      if $s.start_year < $sorted[0].year then
        [{id: null, name: $s.name, latitude: $s.latitude, longitude: $s.longitude,
          notes: null, shelter_id: $s.id, startYear: $s.start_year, endYear: ($sorted[0].year - 1),
          slug: $s.slug, default_photo_id: $s.default_photo_id, is_extant: ($s.is_extant == 1)}] + .
      else . end
    end
  ) as $markers |
  $s + {
    is_extant: ($s.is_extant == 1),
    is_gmc: ($s.is_gmc == 1),
    mapMarkers: [$markers[] | del(.year)],
    photos: [$photos[0][] | select(.shelter_id == $s.id and .include_in_post == 1 and (.file_name | IN($valid_photos[]))) | del(.include_in_post)],
    description: $description,
    content: $content
  } | del(.post_file, .show_on_web)
'

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
count=0

while IFS=$'\t' read -r idx slug; do
  if [ ! -d "./shelters/$slug" ]; then
    warn "No folder found for shelter '$slug' -- skipping"
    continue
  fi

  echo "Finding photos for $slug..."
  echo "Populating map markers for $slug..."

  POST_FILE=$(jq -r ".[$idx].post_file // empty" "$SRC")
  CONTENT=""
  if [ -n "$POST_FILE" ]; then
    CONTENT_FILE="./shelters/$slug/$POST_FILE"
    if [ -f "$CONTENT_FILE" ]; then
      echo "Reading content from $CONTENT_FILE..."
      CONTENT=$(pandoc -f markdown -t plain --wrap=none "$CONTENT_FILE")
    else
      warn "post_file not found: $CONTENT_FILE"
    fi
  fi

  RAW_DESCRIPTION=$(jq -r ".[$idx].description // empty" "$SRC")
  DESCRIPTION=""
  if [ -n "$RAW_DESCRIPTION" ]; then
    DESCRIPTION=$(printf '%s' "$RAW_DESCRIPTION" | pandoc -f markdown -t plain --wrap=none)
  fi

  shelter_id=$(jq -r ".[$idx].id" "$SRC")
  valid_files=()
  while IFS= read -r file; do
    if [ -f "$file" ]; then
      valid_files+=("$file")
    else
      warn "Photo not found: $file -- skipping"
    fi
  done < <(jq -r --argjson sid "$shelter_id" \
    '.[] | select(.shelter_id == $sid and .include_in_post == 1) | .file_name' "$PHOTOS")

  if [ ${#valid_files[@]} -eq 0 ]; then
    VALID_PHOTOS='[]'
  else
    VALID_PHOTOS=$(printf '%s\n' "${valid_files[@]}" | jq -R . | jq -s .)
  fi

  jq --slurpfile photos "$PHOTOS" --slurpfile timelines "$TIMELINES" --argjson idx "$idx" \
    --arg content "$CONTENT" \
    --arg description "$DESCRIPTION" \
    --argjson valid_photos "$VALID_PHOTOS" \
    "$JQ_FILTER" "$SRC" >> "$TMPFILE"
  count=$((count + 1))
done < <(jq -r 'to_entries[] | select(.value.show_on_web == 1) | [.key, .value.slug] | @tsv' "$SRC")

jq -n --arg ts "$TS" --slurpfile shelters "$TMPFILE" \
  '{created: $ts, shelters: $shelters}' > "$DEST"

echo "Converting snake_case keys to camelCase..."
CAMEL_TMP=$(mktemp)
trap 'rm -f "$TMPFILE" "$CAMEL_TMP"' EXIT
jq '
  def to_camel: gsub("_(?<x>[a-z])"; .x | ascii_upcase);
  def convert:
    if type == "object" then
      with_entries({key: (.key | to_camel), value: (.value | convert)})
    elif type == "array" then map(convert)
    else . end;
  convert
' "$DEST" > "$CAMEL_TMP" && mv "$CAMEL_TMP" "$DEST"

echo "Done! Built manifest with $count shelters -> $DEST"

echo ""
echo "Validating mapMarkers..."

VALIDATION_FILTER='
[.shelters[] | . as $s | (.mapMarkers) as $m |
  [
    if ($m | length) == 0 then
      "no mapMarkers"
    else empty end,

    ($m | to_entries[] | .key as $i | .value |
      select(
        (.startYear == null) or
        (.endYear == null and (($s.isExtant and $i == (($m | length) - 1)) | not))
      ) |
      "marker \(.id // "null") missing startYear or endYear"),

    ($m[] | select(.startYear != null and .endYear != null and .startYear > .endYear) |
      "marker \(.id // "null") startYear \(.startYear) > endYear \(.endYear)"),

    if ($m | length) > 0 and $m[0].startYear != null and $m[0].startYear != $s.startYear then
      "first marker startYear \($m[0].startYear) != shelter startYear \($s.startYear)"
    else empty end,

    if $s.isExtant and ($m | length) > 0 and $m[-1].endYear != null then
      "last marker endYear should be null for extant shelter but got \($m[-1].endYear)"
    else empty end,

    if ($s.isExtant | not) and ($m | length) > 0 and $m[-1].endYear != $s.endYear then
      "last marker endYear \($m[-1].endYear // "null") != shelter endYear \($s.endYear)"
    else empty end,

    if ($m | length) > 1 then
      range(($m | length) - 1) | . as $i |
      if ($m[$i].endYear != null) and ($m[$i+1].startYear != null) then
        if $m[$i].endYear >= $m[$i+1].startYear then
          "overlap: marker \($i) endYear \($m[$i].endYear) >= marker \($i+1) startYear \($m[$i+1].startYear)"
        elif $m[$i].endYear + 1 < $m[$i+1].startYear then
          "gap: marker \($i) endYear \($m[$i].endYear) -> marker \($i+1) startYear \($m[$i+1].startYear)"
        else empty end
      else empty end
    else empty end
  ] |
  if length > 0 then {slug: $s.slug, errors: .} else empty end
]'

ERRORS=$(jq "$VALIDATION_FILTER" "$DEST")
ERROR_COUNT=$(echo "$ERRORS" | jq 'length')

if [ "$ERROR_COUNT" -eq 0 ]; then
  echo "Validation passed."
else
  echo "Validation found $ERROR_COUNT shelter(s) with issues:" >&2
  echo "$ERRORS" | jq -r '.[] | "  \(.slug): \(.errors | join("; "))"' >&2
  exit 1
fi
