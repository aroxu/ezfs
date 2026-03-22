package api

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

type FileItem struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	IsDir bool   `json:"is_dir"`
	Size  int64  `json:"size"`
}

func ListPublicFiles(c *gin.Context) {
	listFiles(c, "public")
}

func ListPrivateFiles(c *gin.Context) {
	listFiles(c, "private")
}

func GetPrivateFile(c *gin.Context) {
	subPath := c.Param("filepath")
	subPath = strings.TrimPrefix(subPath, "/")
	rootPath, _ := filepath.Abs(filepath.Join("data", "private"))
	targetPath, _ := filepath.Abs(filepath.Join(rootPath, filepath.Clean(subPath)))

	// Security: prevent path traversal
	if !strings.HasPrefix(targetPath, rootPath) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid path"})
		return
	}

	// Double check if file exists
	if _, err := os.Stat(targetPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	filename := filepath.Base(targetPath)
	encodedName := url.PathEscape(filename)
	disposition := "attachment"
	if c.Query("inline") == "1" {
		disposition = "inline"
	}
	c.Header("Content-Disposition", fmt.Sprintf("%s; filename=\"%s\"; filename*=UTF-8''%s", disposition, filename, encodedName))

	// Use http.ServeContent instead of c.File to avoid Go's
	// automatic 301 redirect for index.html files.
	f, err := os.Open(targetPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file"})
		return
	}
	defer f.Close()
	stat, _ := f.Stat()
	http.ServeContent(c.Writer, c.Request, filename, stat.ModTime(), f)
}

func ServePrivateFile(c *gin.Context) {
	subPath := c.Param("filepath")
	subPath = strings.TrimPrefix(subPath, "/")
	rootPath, _ := filepath.Abs(filepath.Join("data", "private"))
	targetPath, _ := filepath.Abs(filepath.Join(rootPath, filepath.Clean(subPath)))

	if !strings.HasPrefix(targetPath, rootPath) {
		c.Redirect(http.StatusFound, "/404")
		return
	}

	if _, err := os.Stat(targetPath); os.IsNotExist(err) {
		c.Redirect(http.StatusFound, "/404")
		return
	}

	filename := filepath.Base(targetPath)
	f, err := os.Open(targetPath)
	if err != nil {
		c.String(http.StatusInternalServerError, "Failed to open file")
		return
	}
	defer f.Close()
	stat, _ := f.Stat()
	http.ServeContent(c.Writer, c.Request, filename, stat.ModTime(), f)
}

func listFiles(c *gin.Context, folder string) {
	subPath := c.Query("path")
	rootPath, _ := filepath.Abs(filepath.Join("data", folder))
	targetPath, _ := filepath.Abs(filepath.Join(rootPath, filepath.Clean(subPath)))

	// Security: prevent path traversal
	if !strings.HasPrefix(targetPath, rootPath) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid path"})
		return
	}

	entries, err := os.ReadDir(targetPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	files := []FileItem{}
	for _, entry := range entries {
		info, _ := entry.Info()
		rel, _ := filepath.Rel(rootPath, filepath.Join(targetPath, entry.Name()))
		files = append(files, FileItem{
			Name:  entry.Name(),
			Path:  filepath.ToSlash(rel),
			IsDir: entry.IsDir(),
			Size:  info.Size(),
		})
	}

	c.JSON(http.StatusOK, files)
}
