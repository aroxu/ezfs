package api

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aroxu/ezfs/internal/auth"
	"github.com/aroxu/ezfs/internal/db"
	"github.com/gin-gonic/gin"
)

func generateID() string {
	b := make([]byte, 4)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func CreateShare(c *gin.Context) {
	var input struct {
		FilePath  string     `json:"file_path"`
		IsFolder  bool       `json:"is_folder"`
		Password  string     `json:"password"`
		ExpiresAt *time.Time `json:"expires_at"`
		MaxAccess int        `json:"max_access"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if input.MaxAccess < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Max access cannot be negative"})
		return
	}

	id := generateID()
	passwordHash := ""
	if input.Password != "" {
		passwordHash, _ = auth.HashPassword(input.Password)
	}

	share := db.Share{
		ID:           id,
		FilePath:     input.FilePath,
		IsFolder:     input.IsFolder,
		PasswordHash: passwordHash,
		ExpiresAt:    input.ExpiresAt,
		MaxAccess:    input.MaxAccess,
		AccessCount:  0,
	}

	if err := db.DB.Create(&share).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create share"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"id": id})
}

func GetShareInfo(c *gin.Context) {
	id := c.Param("id")
	var share db.Share
	if err := db.DB.First(&share, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Share not found"})
		return
	}

	if share.ExpiresAt != nil && time.Now().After(*share.ExpiresAt) {
		c.JSON(http.StatusGone, gin.H{"error": "Share expired"})
		return
	}

	if share.MaxAccess > 0 && share.AccessCount >= share.MaxAccess {
		c.JSON(http.StatusGone, gin.H{"error": "Access limit reached"})
		return
	}

	expiresAtMs := int64(0)
	if share.ExpiresAt != nil {
		expiresAtMs = share.ExpiresAt.UnixMilli()
	}

	c.JSON(http.StatusOK, gin.H{
		"id":          share.ID,
		"fileName":    filepath.Base(share.FilePath),
		"isFolder":    share.IsFolder,
		"hasPassword": share.PasswordHash != "",
		"expiresAt":   expiresAtMs,
		"maxAccess":   share.MaxAccess,
		"accessCount": share.AccessCount,
	})
}

func fetchShareAndCheck(_ *gin.Context, id string, password string) (*db.Share, error) {
	var share db.Share
	if err := db.DB.First(&share, "id = ?", id).Error; err != nil {
		return nil, err
	}

	if share.ExpiresAt != nil && time.Now().After(*share.ExpiresAt) {
		return nil, fmt.Errorf("expired")
	}

	if share.MaxAccess > 0 && share.AccessCount >= share.MaxAccess {
		return nil, fmt.Errorf("limit reached")
	}

	if share.PasswordHash != "" && !auth.CheckPasswordHash(password, share.PasswordHash) {
		return nil, fmt.Errorf("unauthorized")
	}

	return &share, nil
}

func AccessShare(c *gin.Context) {
	id := c.Param("id")
	var input struct {
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	_, err := fetchShareAndCheck(c, id, input.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Access granted"})
}

func ListShareContents(c *gin.Context) {
	id := c.Param("id")
	password := c.Query("p")

	share, err := fetchShareAndCheck(c, id, password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	if !share.IsFolder {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Not a folder share"})
		return
	}

	root := filepath.Join("data", "private", share.FilePath)
	relPath := c.Query("path")
	fullPath := filepath.Join(root, relPath)

	// Security: ensure fullPath is within root
	if !filepath.HasPrefix(fullPath, root) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	files, err := os.ReadDir(fullPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read directory"})
		return
	}

	var results []gin.H
	for _, f := range files {
		info, _ := f.Info()
		results = append(results, gin.H{
			"name":  f.Name(),
			"size":  info.Size(),
			"isDir": f.IsDir(),
			"path":  filepath.Join(relPath, f.Name()),
		})
	}

	c.JSON(http.StatusOK, results)
}

func DownloadShare(c *gin.Context) {
	id := c.Param("id")
	password := c.Query("p")
	subPath := c.Query("path")
	// Check for custom header instead of query parameter
	isCompressing := c.GetHeader("X-Browser-Compressing") == "true"
	count := !isCompressing

	share, err := fetchShareAndCheck(c, id, password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	targetPath := share.FilePath
	if share.IsFolder && subPath != "" {
		targetPath = filepath.Join(share.FilePath, subPath)
	}

	fullPath := filepath.Join("data", "private", targetPath)

	// Increment access count if requested
	if count {
		db.DB.Model(&share).Update("AccessCount", share.AccessCount+1)
	}

	// If it's a directory or a dummy request to increment count, return success instead of file
	info, err := os.Stat(fullPath)
	if err == nil && info.IsDir() {
		if count && subPath == "" {
			c.JSON(http.StatusOK, gin.H{"message": "Access counted"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot download a directory"})
		return
	}

	// If the file is being requested without a subpath in a folder share,
	// it might be a request for the "root" of the share which is a folder.
	if share.IsFolder && subPath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please specify a file path within the folder"})
		return
	}

	f, err := os.Open(fullPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file"})
		return
	}
	defer f.Close()
	fInfo, _ := f.Stat()

	// Set headers only after confirming the file is valid
	ext := filepath.Ext(fullPath)
	contentType := mime.TypeByExtension(ext)
	if contentType == "" {
		if strings.ToLower(ext) == ".apk" {
			contentType = "application/vnd.android.package-archive"
		} else {
			contentType = "application/octet-stream"
		}
	}
	c.Header("Content-Type", contentType)

	filename := filepath.Base(fullPath)
	encodedName := url.PathEscape(filename)
	disposition := "attachment"
	if c.Query("inline") == "1" {
		disposition = "inline"
	}
	c.Header("Content-Disposition", fmt.Sprintf("%s; filename=\"%s\"; filename*=UTF-8''%s", disposition, filename, encodedName))

	http.ServeContent(c.Writer, c.Request, filename, fInfo.ModTime(), f)
}

func ListShares(c *gin.Context) {
	var shares []db.Share
	if err := db.DB.Order("created_at desc").Find(&shares).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch shares"})
		return
	}

	var results []gin.H
	for _, s := range shares {
		exp := int64(0)
		if s.ExpiresAt != nil {
			exp = s.ExpiresAt.UnixMilli()
		}
		results = append(results, gin.H{
			"id":           s.ID,
			"file_path":    s.FilePath,
			"is_folder":    s.IsFolder,
			"expires_at":   exp,
			"max_access":   s.MaxAccess,
			"access_count": s.AccessCount,
			"created_at":   s.CreatedAt.UnixMilli(),
		})
	}
	c.JSON(http.StatusOK, results)
}

func DeleteShare(c *gin.Context) {
	id := c.Param("id")
	if err := db.DB.Delete(&db.Share{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete share"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Share deleted"})
}

func UpdateShare(c *gin.Context) {
	id := c.Param("id")
	var input struct {
		Password  *string    `json:"password"`
		ExpiresAt *time.Time `json:"expires_at"`
		MaxAccess *int       `json:"max_access"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	var share db.Share
	if err := db.DB.First(&share, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Share not found"})
		return
	}

	if input.Password != nil {
		if *input.Password == "" {
			share.PasswordHash = ""
		} else {
			share.PasswordHash, _ = auth.HashPassword(*input.Password)
		}
	}
	if input.ExpiresAt != nil {
		share.ExpiresAt = input.ExpiresAt
	}
	if input.MaxAccess != nil {
		if *input.MaxAccess < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Max access cannot be negative"})
			return
		}
		share.MaxAccess = *input.MaxAccess
	}

	if err := db.DB.Save(&share).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update share"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Share updated"})
}
