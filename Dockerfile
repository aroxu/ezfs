# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build

# Stage 2: Build Go binary
FROM golang:1.25-alpine AS go-builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

ENV CGO_ENABLED=0
RUN go build -ldflags="-s -w" -o ezfs main.go

# Stage 3: Runtime
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app
COPY --from=go-builder /app/ezfs .

RUN mkdir -p /app/data/public /app/data/private

ENV DB_PATH=/app/data/ezfs.db

EXPOSE 8080

VOLUME ["/app/data"]

ENTRYPOINT ["./ezfs"]
