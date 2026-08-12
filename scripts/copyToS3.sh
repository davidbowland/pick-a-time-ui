#!/usr/bin/env bash

# Stop immediately on error
set -e

S3_BUCKET="$1"
if [[ -z "$1" ]]; then
  S3_BUCKET=pick-a-time-ui-test
fi

# CloudFront distribution to invalidate, resolved by the caller (deploy.sh or the pipeline), which
# is the layer that already knows this repo's stack name and region. Optional: an empty value skips
# the invalidation with a warning rather than failing the deploy. Losing an invalidation is a
# recoverable annoyance; failing here would abort a deploy whose files are already in the bucket.
DISTRIBUTION_ID="$2"

### Deploy code by copying build output to S3

cd out
# Cache "forever" (one year), which is only ever safe for a content-hashed URL:
# everything under _next/ carries a build hash in its filename, so changed bytes
# mean a changed URL and nothing ever has to be evicted.
#
# This is an allowlist rather than a list of excluded extensions, because the
# failure directions are not symmetric. A path wrongly marked immutable cannot be
# corrected for a year — `immutable` tells the browser not to revalidate at all,
# not on a reload, not when the origin has been right for weeks. A path wrongly
# left out of the allowlist merely loses caching it can be given back at any time.
# An extension blocklist fails the dangerous way every time someone adds a file
# type nobody listed; robots.txt was exactly that, and it would have shipped
# pinned for a year the first time it was generated.
aws s3 sync . "s3://$S3_BUCKET/" --exclude "*" --include "_next/*" \
  --metadata-directive REPLACE --cache-control "public, max-age=31536000, immutable"
# Do not cache: every stable URL whose bytes change — page HTML, robots.txt, the
# sitemaps, the brand assets, the service worker.
#
# This is `cp --recursive` and not `sync` because `sync` skips a file whose size
# and timestamp already match, and a skipped object keeps whatever Cache-Control
# it was last written with. A header fix would never reach a file that had not
# otherwise changed.
aws s3 cp . "s3://$S3_BUCKET/" --recursive --exclude "_next/*" \
  --cache-control "public, no-cache"
# Cleanup unused files
aws s3 sync . "s3://$S3_BUCKET/" --delete

### Invalidate the edge copy of the service worker

# Exactly one path is invalidated, and the shortness of that list is the decision, not an oversight.
#
# Nothing else needs it. /sw.js sits at the root of out/, so it already went up in the `no-cache`
# pass above — the `immutable` pass is an `--include "_next/*"` allowlist and cannot reach it — and
# `public, no-cache` is what makes a POP revalidate with the origin. Note it is the header doing
# that work and NOT the distribution's DefaultTTL: Managed-CachingOptimized is attached
# (template.yaml), which makes the legacy DefaultTTL setting inert. Every other stable URL
# propagates for the same header reason, and invalidating them each deploy would mask a future
# cache-header regression rather than surface it.
#
# sw.js is the exception on consequence, not on mechanism. A stale worker is not cosmetic: it keeps
# serving old HTML and assets out of Cache Storage indefinitely, and the only remote fix is
# deploying a replacement at this same URL (scripts/sw-killswitch.js) — which a browser pinned to a
# stale copy never fetches. "Probably revalidates" is a poor guarantee for the one file that can
# brick the origin, so this is belt and braces at one path per deploy against a 1000/month free
# quota.
#
# Both branches are non-fatal on purpose. The bytes are already in S3 by this line, so aborting the
# deploy here would leave the site half-updated and fix nothing that a manual invalidation cannot.
if [[ -n "$DISTRIBUTION_ID" && "$DISTRIBUTION_ID" != "None" ]]; then
  aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/sw.js" \
    || echo "::warning::invalidation failed; run it manually before trusting a sw.js change" >&2
else
  echo "::warning::no distribution ID given — skipping invalidation. A sw.js change may not reach browsers." >&2
fi
