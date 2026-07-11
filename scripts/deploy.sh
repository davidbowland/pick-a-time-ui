#!/usr/bin/env bash

# Stop immediately on error
set -e

if [[ -z "$1" ]]; then
  $(./scripts/assumeDeveloperRole.sh)
fi

# Deploy infrastructure

sam deploy --stack-name choosee-ui-test \
  --template-file template.yaml --region us-east-2 \
  --capabilities CAPABILITY_NAMED_IAM --no-fail-on-empty-changeset \
  --parameter-overrides Environment=test

# Copy project to S3

./scripts/copyToS3.sh choosee-ui-test
