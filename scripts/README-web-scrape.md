# GMC Website Scraper

Scrapes GMC shelter posts into `gmc-website-content/`.

## What it does

1. Creates `gmc-website-content/` (or your custom output path).
2. Finds shelter post links from an index page (or uses explicit post URLs).
3. Creates one folder per slug, e.g. `gmc-website-content/aeolus-view-camp/`.
4. Saves article text to markdown, e.g. `gmc-website-content/aeolus-view-camp/aeolus-view-camp.md`.
5. Downloads all post images into the same slug folder.

## Install dependencies

```zsh
python3 -m pip install -r /Users/johnneed/Projects/gmc-shelters/scripts/requirements-web-scrape.txt
```

## Quick run (discover links from shelter index page)

```zsh
python3 /Users/johnneed/Projects/gmc-shelters/scripts/scrape_gmc_website.py
```

## Run with explicit URLs

```zsh
python3 /Users/johnneed/Projects/gmc-shelters/scripts/scrape_gmc_website.py \
  --post-urls \
  https://gmcburlington.org/aeolus-view-camp/ \
  https://gmcburlington.org/aldrich-job-camp/
```

## Optional test run (limit pages)

```zsh
python3 /Users/johnneed/Projects/gmc-shelters/scripts/scrape_gmc_website.py \
  --max-posts 2
```

## API-only shelter export (recommended)

This script uses the WordPress REST API and only exports posts in category `GMC Shelter System`.

```zsh
python3 /Users/johnneed/Projects/gmc-shelters/scripts/fetch_gmc_shelter_system_api.py \
  --base-url https://gmcburlington.org \
  --category-name "GMC Shelter System" \
  --output-dir /Users/johnneed/Projects/gmc-shelters/gmc-website-content
```

Optional test run:

```zsh
python3 /Users/johnneed/Projects/gmc-shelters/scripts/fetch_gmc_shelter_system_api.py \
  --max-posts 2 \
  --output-dir /Users/johnneed/Projects/gmc-shelters/temp/gmc-website-content-test
```
