# Project Structure - ezfs

```text
ezfs/
├── data/                      # Storage root (Created at runtime)
│   ├── public/                # Publicly accessible files
│   └── private/               # Authentication-protected files
├── frontend/                  # React Frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components (FileBrowser, PreviewModal, etc.)
│   │   ├── pages/             # Application routable pages (Home, Dashboard, Admin, etc.)
│   │   ├── utils/             # API clients and helpers (api.ts)
│   │   └── App.tsx            # Root routing and provider setup
│   ├── index.html             # HTML entry point with dynamic title support
│   └── package.json           # Frontend dependencies (HeroUI, Lucide, Framer Motion)
├── internal/                  # Go Backend Logic
│   ├── api/
│   │   ├── api.go             # Core file operations (Listing, Raw access)
│   │   ├── auth_handlers.go   # Authentication, sessions, and IP lockout
│   │   ├── share_handlers.go  # Sharing logic and Share Manager CRUD
│   │   └── types.go           # Shared API response/request structs
│   └── middleware/            # Gin middlewares (Auth, Logging)
├── build.ps1                  # Windows PowerShell build script
├── main.go                    # Entry point & Embedded filesystem configuration
├── go.mod                     # Go module definition
└── README.md                  # User documentation
```

## Data Management

- **ezfs.db**: SQLite database file located in the project root. Stores metadata for active shares, persistent sessions, and IP-based lockout state.
- **Embedded FS**: The `frontend/dist` directory is embedded into the binary using `go:embed`.
