#!/bin/bash
set -e
# Send request to upload_photo without API key; expect unauthorized response.
out=$(REQUEST_METHOD=POST API_KEY=test php api/upload_photo.php 2>&1 || true)
echo "$out"
# Ensure response indicates unauthorized
if echo "$out" | grep -q 'unauthorized'; then
  exit 0
else
  echo "Expected unauthorized response" >&2
  exit 1
fi
