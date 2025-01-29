#!/usr/bin/env bash

# Check that a directory was passed in as the first argument
if [ -z "$1" ]; then
  echo "Usage: $0 <directory>"
  exit 1
fi

TARGET_DIR="$1"

# Validate that the provided argument is a directory
if [ ! -d "$TARGET_DIR" ]; then
  echo "Error: $TARGET_DIR is not a directory"
  exit 1
fi

# Find all files within the target directory (recursively)
while IFS= read -r -d '' file; do
  perl -pi -e '
    s{node_modules/viem/\\_types/([^:]+):(\d+)}{viem @ [$1](https://github.com/wevm/viem/blob/main/src/$1#L$2)}g;
    s{(https://github.com/wevm/viem/blob/main/src/[^)]+)\.d\.ts}{$1.ts}g;
  ' "$file"
done < <(find "$TARGET_DIR" -type f -print0)

echo "Replacement link complete in directory: $TARGET_DIR"