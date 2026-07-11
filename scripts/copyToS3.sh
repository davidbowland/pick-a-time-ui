#!/usr/bin/env bash

# Stop immediately on error
set -e

S3_BUCKET="$1"
if [[ -z "$1" ]]; then
  S3_BUCKET=choosee-ui-test
fi

### Deploy code by copying build output to S3

cd out
# Cache "forever" (one year)
aws s3 sync . "s3://$S3_BUCKET/" --exclude "*.html" --exclude "*.json" --exclude "*.xml" \
  --metadata-directive REPLACE --cache-control "public, max-age=31536000, immutable" --acl public-read
# Do not cache
aws s3 sync . "s3://$S3_BUCKET/" --include "*.html" --include "*.json" --include "*.xml" \
  --metadata-directive REPLACE --cache-control "public, no-cache" --acl public-read
# Cleanup unused files
aws s3 sync . "s3://$S3_BUCKET/" --delete
