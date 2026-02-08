package api

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/aroxu/ezfs/internal/auth"
	"github.com/aroxu/ezfs/internal/db"
	"github.com/gin-gonic/gin"
)

func Login(c *gin.Context) {
	var input struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	clientIP := c.ClientIP()
	var bannedIP db.BannedIP
	db.DB.Where("ip = ?", clientIP).First(&bannedIP)

	// Check if IP is permanently banned
	if bannedIP.IsBanned {
		c.JSON(http.StatusForbidden, gin.H{"error": "Your IP is permanently locked due to excessive failed attempts"})
		return
	}

	// Check if IP is temporarily locked
	if bannedIP.LockUntil != nil && time.Now().Before(*bannedIP.LockUntil) {
		remaining := time.Until(*bannedIP.LockUntil).Round(time.Second)
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":      fmt.Sprintf("Too many failed attempts from this IP. Try again in %v", remaining),
			"lock_until": bannedIP.LockUntil.UnixMilli(),
		})
		return
	}

	var user db.User
	userFound := db.DB.Where("username = ?", input.Username).First(&user).Error == nil

	// Check if user account itself is banned
	if userFound && user.IsBanned {
		c.JSON(http.StatusForbidden, gin.H{"error": "Account is permanently locked"})
		return
	}

	passwordCorrect := userFound && auth.CheckPasswordHash(input.Password, user.Password)

	if !passwordCorrect {
		// Increment IP-based attempts
		if bannedIP.IP == "" {
			bannedIP.IP = clientIP
		}
		bannedIP.Attempts++
		
		var lockDuration time.Duration
		msg := "Invalid credentials"

		switch {
		case bannedIP.Attempts >= 20:
			bannedIP.IsBanned = true
			msg = "IP permanently locked"
		case bannedIP.Attempts >= 15:
			lockDuration = 1 * time.Hour
		case bannedIP.Attempts >= 10:
			lockDuration = 10 * time.Minute
		case bannedIP.Attempts >= 3:
			lockDuration = 1 * time.Minute
		}

		if lockDuration > 0 {
			until := time.Now().Add(lockDuration)
			bannedIP.LockUntil = &until
			msg = fmt.Sprintf("Too many failed attempts. IP locked for %v", lockDuration)
			db.DB.Save(&bannedIP)
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":      msg,
				"lock_until": until.UnixMilli(),
			})
			return
		}

		db.DB.Save(&bannedIP)
		c.JSON(http.StatusUnauthorized, gin.H{"error": msg})
		return
	}

	// Success: Reset IP attempts
	if bannedIP.IP != "" {
		bannedIP.Attempts = 0
		bannedIP.LockUntil = nil
		db.DB.Save(&bannedIP)
	}

	token, err := auth.GenerateToken(user.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// Set HttpOnly Cookie
	c.SetCookie("token", token, 3600*24, "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{"message": "Logged in successfully"})
}

func Logout(c *gin.Context) {
	c.SetCookie("token", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

func UpdateProfile(c *gin.Context) {
	var input struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	currentUsername := c.MustGet("username").(string)
	var user db.User
	if err := db.DB.Where("username = ?", currentUsername).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if input.Username != "" {
		user.Username = input.Username
	}
	if input.Password != "" {
		hashed, err := auth.HashPassword(input.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}
		user.Password = hashed
	}

	if err := db.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	// Generate new token if username changed
	token, _ := auth.GenerateToken(user.Username)
	c.SetCookie("token", token, 3600*24, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"message": "Profile updated"})
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString, err := c.Cookie("token")
		if err != nil {
			// Fallback to Header for non-browser/API clients if needed
			tokenString = c.GetHeader("Authorization")
			tokenString = strings.TrimPrefix(tokenString, "Bearer ")
		}

		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			c.Abort()
			return
		}

		claims, err := auth.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		c.Set("username", claims.Username)
		c.Next()
	}
}
