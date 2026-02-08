#!/bin/bash

# Build script for ezfs (Easy File Server)

echo "--- 1. Building Frontend ---"
cd frontend
pnpm install
pnpm build
cd ..

echo -e "\n--- 2. Building Go Binary ---"
rm -f ezfs
go build -o ezfs main.go

if [ $? -eq 0 ]; then
    echo -e "\nBuild Successful! Run ./ezfs to start the server."
else
    echo -e "\nBuild Failed!"
    exit 1
fi
