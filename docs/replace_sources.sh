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

# Define the pattern and replacement directly
PATTERN="node_modules/viem/\_types"
REPLACEMENT="https://github.com/wevm/viem/src"

# Find all files within the target directory (recursively)
while IFS= read -r -d '' file; do
  # Use perl for more reliable handling of backslashes
  echo $file;
  perl -pi -e "s#\Q$PATTERN\E#$REPLACEMENT#g" "$file"
done < <(find "$TARGET_DIR" -type f -print0)

echo "Replacement complete in directory: $TARGET_DIR"
