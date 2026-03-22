package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/aroxu/ezfs/internal/api"
	"github.com/aroxu/ezfs/internal/db"
	"github.com/gin-gonic/gin"
)

//go:embed all:frontend/dist
var frontendAssets embed.FS

func main() {
	// Initialize Database
	if err := db.InitDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Create directories
	os.MkdirAll(filepath.Join("data", "public"), 0755)
	os.MkdirAll(filepath.Join("data", "private"), 0755)

	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.RedirectTrailingSlash = false
	r.RedirectFixedPath = false

	// API routes group
	apiGroup := r.Group("/api")
	{
		apiGroup.GET("/ping", func(c *gin.Context) {
			c.JSON(200, gin.H{"message": "pong"})
		})
		apiGroup.POST("/login", api.Login)
		apiGroup.GET("/files/public", api.ListPublicFiles)
		apiGroup.POST("/logout", api.Logout)

		// Share routes (Public)
		apiGroup.GET("/shares/:id", api.GetShareInfo)
		apiGroup.GET("/shares/:id/list", api.ListShareContents)
		apiGroup.POST("/shares/:id/access", api.AccessShare)
		apiGroup.GET("/shares/:id/download", api.DownloadShare)

		// Private routes
		admin := apiGroup.Group("/private")
		admin.Use(api.AuthMiddleware())
		{
			admin.GET("/status", func(c *gin.Context) {
				c.JSON(200, gin.H{"status": "ok", "user": c.MustGet("username")})
			})
			admin.GET("/files/private", api.ListPrivateFiles)
			admin.GET("/files/raw/*filepath", api.GetPrivateFile)
			admin.POST("/shares", api.CreateShare)
			admin.GET("/shares", api.ListShares)
			admin.PATCH("/shares/:id", api.UpdateShare)
			admin.DELETE("/shares/:id", api.DeleteShare)
			admin.POST("/profile", api.UpdateProfile)
		}
	}

	// Serve physical files
	r.StaticFS("/raw/public", http.Dir(filepath.Join("data", "public")))

	// Serve private files inline (auth required, no Content-Disposition: attachment)
	raw := r.Group("/raw/private")
	raw.Use(api.BrowserAuthMiddleware())
	raw.GET("/*filepath", api.ServePrivateFile)

	// Serve Static Files using embedding
	// Extract the dist folder from the embedded FS
	publicFS, err := fs.Sub(frontendAssets, "frontend/dist")
	if err != nil {
		log.Printf("Warning: frontend assets not found: %v", err)
	} else {
		serveEmbed(r, publicFS)
	}

	log.Printf("Server starting on :8080")
	r.Run(":8080")
}

func serveEmbed(r *gin.Engine, publicFS fs.FS) {
	r.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api") || strings.HasPrefix(c.Request.URL.Path, "/raw") {
			return
		}

		requestPath := c.Request.URL.Path
		path := strings.TrimPrefix(requestPath, "/")
		if path == "" {
			path = "index.html"
		}

		// Try to serve from physical public folder first.
		// Skip only when the user navigates to "/" (root) so the SPA loads.
		// Explicit requests like "/index.html" should check data/public first.
		if path != "index.html" || requestPath == "/index.html" {
			physicalPath := filepath.Join("data", "public", filepath.Clean(path))
			if rel, err := filepath.Rel(filepath.Join("data", "public"), physicalPath); err == nil && !strings.HasPrefix(rel, "..") {
				if info, err := os.Stat(physicalPath); err == nil && !info.IsDir() {
					f, fErr := os.Open(physicalPath)
					if fErr == nil {
						defer f.Close()
						http.ServeContent(c.Writer, c.Request, filepath.Base(physicalPath), info.ModTime(), f)
						return
					}
				}
			}
		}

		content, err := fs.ReadFile(publicFS, path)
		if err != nil {
			// SPA fallback: serve index.html for known SPA routes
			content, err = fs.ReadFile(publicFS, "index.html")
			if err != nil {
				c.String(404, "Not Found")
				return
			}

			// Determine status code: known SPA routes get 200, everything else 404
			status := 404
			spaRoutes := []string{"/", "/private", "/s/"}
			for _, route := range spaRoutes {
				if requestPath == route || strings.HasPrefix(requestPath, route) && route != "/" {
					status = 200
					break
				}
			}

			c.Data(status, "text/html", content)
			return
		}

		// Basic content-type detection
		contentType := "text/html"
		switch {
		case strings.HasSuffix(path, ".js"):
			contentType = "application/javascript"
		case strings.HasSuffix(path, ".css"):
			contentType = "text/css"
		case strings.HasSuffix(path, ".svg"):
			contentType = "image/svg+xml"
		case strings.HasSuffix(path, ".png"):
			contentType = "image/png"
		case strings.HasSuffix(path, ".jpg") || strings.HasSuffix(path, ".jpeg"):
			contentType = "image/jpeg"
		case strings.HasSuffix(path, ".ico"):
			contentType = "image/x-icon"
		}

		c.Data(200, contentType, content)
	})
}
