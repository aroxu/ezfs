#!/bin/bash

echo "--- 1. Building Frontend ---"
cd frontend
pnpm install
pnpm build
cd ..

echo -e "\n--- 2. Building Go Binary ---"
rm -f ezfs
go build -o ezfs main.go

GIN_MODE=debug ./ezfs
