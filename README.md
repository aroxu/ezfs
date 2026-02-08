# ezfs (Easy File Server)

A minimalist single-binary file server built with Go (Gin) and React (NextUI).

## Features

- **Single Binary**: Frontend is embedded into the Go binary.
- **Public Folder**: `data/public` is accessible to everyone.
- **Private Sharing**: Admin can password-protect files in `data/private` and generate unique share links.
- **Media Preview**: In-browser preview for images, videos, and markdown files using NextUI modals.
- **Admin Dashboard**: Manage private files and sharing links.

## Build & Run

### Automated Build (Recommended)

**Windows (PowerShell):**

```powershell
./build.ps1
```

**Linux/macOS:**

```bash
chmod +x build.sh
./build.sh
```

### Manual Build

1. **Frontend**:
   ```bash
   cd frontend
   pnpm install
   pnpm build
   ```
2. **Backend**:
   ```bash
   go build -o ezfs.exe main.go
   ```

## Configuration

- Default port: `8080`
- Default Admin: `admin` / `admin`
- Data Folders: `data/public` and `data/private` (created automatically on first run)

## Tech Stack

- **Backend**: Go, Gin, GORM, SQLite (CGO-free)
- **Frontend**: React 19, NextUI, Tailwind CSS, Vite
