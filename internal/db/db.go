package db

import (
	"time"

	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Username  string    `gorm:"unique;not null" json:"username"`
	Password  string    `json:"-"`
	LoginAttempts int    `gorm:"default:0" json:"-"`
	LockUntil     *time.Time `json:"-"`
	IsBanned      bool      `gorm:"default:false" json:"-"`
	CreatedAt time.Time `json:"created_at"`
}

type BannedIP struct {
	ID        uint      `gorm:"primaryKey"`
	IP        string    `gorm:"unique;not null;index"`
	Attempts  int       `gorm:"default:0"`
	LockUntil *time.Time
	IsBanned  bool      `gorm:"default:false"`
	UpdatedAt time.Time
}

type Share struct {
	ID           string    `gorm:"primaryKey" json:"id"` // Unique share code
	FilePath     string    `gorm:"not null" json:"file_path"`
	IsFolder     bool      `json:"is_folder"`
	PasswordHash string    `json:"-"`
	ExpiresAt    *time.Time `json:"expires_at"`
	MaxAccess    int       `json:"max_access"`   // 0 for unlimited
	AccessCount  int       `json:"access_count"`
	CreatedAt    time.Time `json:"created_at"`
}

var DB *gorm.DB

func InitDB() error {
	var err error
	DB, err = gorm.Open(sqlite.Open("ezfs.db"), &gorm.Config{})
	if err != nil {
		return err
	}

	if err := DB.AutoMigrate(&User{}, &Share{}, &BannedIP{}); err != nil {
		return err
	}

	// Create default admin if not exists
	var count int64
	DB.Model(&User{}).Count(&count)
	if count == 0 {
		hashed, _ := bcrypt.GenerateFromPassword([]byte("admin"), 14)
		admin := User{
			Username: "admin",
			Password: string(hashed),
		}
		DB.Create(&admin)
	}

	return nil
}
