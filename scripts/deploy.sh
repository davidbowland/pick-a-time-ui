#!/usr/bin/env bash

# Stop immediately on error
set -e

if [[ -z "$1" ]]; then
  $(./scripts/assumeDeveloperRole.sh)
fi

# Deploy infrastructure

sam deploy --stack-name pick-a-time-ui-test \
  --template-file template.yaml --region us-east-2 \
  --capabilities CAPABILITY_NAMED_IAM --no-fail-on-empty-changeset \
  --parameter-overrides Environment=test

# Copy project to S3

# The distribution ID comes from the stack rather than being hardcoded, so a rebuilt stack cannot
# leave the deploy invalidating a distribution that no longer serves the site. An empty result is
# not fatal — copyToS3.sh warns and skips the invalidation. `|| true` keeps `set -e` from turning a
# missing stack or an expired role into a failed deploy of files that copied perfectly well.

DISTRIBUTION_ID=$(aws cloudformation describe-stacks --stack-name pick-a-time-ui-test --region us-east-2 \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text 2>/dev/null || true)

./scripts/copyToS3.sh pick-a-time-ui-test "$DISTRIBUTION_ID"
