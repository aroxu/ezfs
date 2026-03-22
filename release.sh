#!/bin/bash

VERSION=$1
MESSAGE=$2

if [ -z "$VERSION" ] || [ -z "$MESSAGE" ]; then
    echo "Usage: ./release.sh <version> <message>"
    echo "Example: ./release.sh v1.0.0 \"Initial release\""
    exit 1
fi

if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Version must follow the format 'vX.Y.Z' (e.g. v1.0.0)"
    exit 1
fi

git add -A
git commit -m "$MESSAGE"
git tag -a "$VERSION" -m "$MESSAGE"
git push origin main --tags

echo ""
echo "Released $VERSION successfully!"
