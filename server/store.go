package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	stickersKey     = "stickers"
	stickerKeyPrefix = "sticker_"
)

func (p *Plugin) GetAllStickers() (*StickerList, error) {
	data, appErr := p.API.KVGet(stickersKey)
	if appErr != nil {
		return nil, fmt.Errorf("failed to get stickers: %w", appErr)
	}

	if data == nil {
		return &StickerList{Stickers: []*Sticker{}, Total: 0}, nil
	}

	var ids []string
	if err := json.Unmarshal(data, &ids); err != nil {
		return nil, fmt.Errorf("failed to unmarshal sticker IDs: %w", err)
	}

	stickers := make([]*Sticker, 0, len(ids))
	for _, id := range ids {
		sticker, err := p.GetSticker(id)
		if err != nil {
			continue
		}
		stickers = append(stickers, sticker)
	}

	return &StickerList{
		Stickers: stickers,
		Total:    len(stickers),
	}, nil
}

func (p *Plugin) GetSticker(id string) (*Sticker, error) {
	data, appErr := p.API.KVGet(stickerKeyPrefix + id)
	if appErr != nil {
		return nil, fmt.Errorf("failed to get sticker: %w", appErr)
	}

	if data == nil {
		return nil, fmt.Errorf("sticker not found")
	}

	return StickerFromJSON(data)
}

func (p *Plugin) GetStickerByName(name string) (*Sticker, error) {
	list, err := p.GetAllStickers()
	if err != nil {
		return nil, err
	}

	normalizedName := strings.ToLower(strings.TrimSpace(name))
	for _, s := range list.Stickers {
		if strings.ToLower(s.Name) == normalizedName {
			return s, nil
		}
	}

	return nil, fmt.Errorf("sticker '%s' not found", name)
}

func (p *Plugin) SaveSticker(sticker *Sticker) error {
	data, err := sticker.ToJSON()
	if err != nil {
		return fmt.Errorf("failed to marshal sticker: %w", err)
	}

	if appErr := p.API.KVSet(stickerKeyPrefix+sticker.ID, data); appErr != nil {
		return fmt.Errorf("failed to save sticker: %w", appErr)
	}

	return p.addStickerToIndex(sticker.ID)
}

func (p *Plugin) DeleteSticker(id string) error {
	if appErr := p.API.KVDelete(stickerKeyPrefix + id); appErr != nil {
		return fmt.Errorf("failed to delete sticker: %w", appErr)
	}

	return p.removeStickerFromIndex(id)
}

func (p *Plugin) addStickerToIndex(id string) error {
	data, appErr := p.API.KVGet(stickersKey)
	if appErr != nil {
		return fmt.Errorf("failed to get sticker index: %w", appErr)
	}

	var ids []string
	if data != nil {
		if err := json.Unmarshal(data, &ids); err != nil {
			return fmt.Errorf("failed to unmarshal sticker index: %w", err)
		}
	}

	for _, existingID := range ids {
		if existingID == id {
			return nil
		}
	}

	ids = append(ids, id)

	newData, err := json.Marshal(ids)
	if err != nil {
		return fmt.Errorf("failed to marshal sticker index: %w", err)
	}

	if appErr := p.API.KVSet(stickersKey, newData); appErr != nil {
		return fmt.Errorf("failed to save sticker index: %w", appErr)
	}

	return nil
}

func (p *Plugin) removeStickerFromIndex(id string) error {
	data, appErr := p.API.KVGet(stickersKey)
	if appErr != nil {
		return fmt.Errorf("failed to get sticker index: %w", appErr)
	}

	if data == nil {
		return nil
	}

	var ids []string
	if err := json.Unmarshal(data, &ids); err != nil {
		return fmt.Errorf("failed to unmarshal sticker index: %w", err)
	}

	newIDs := make([]string, 0, len(ids))
	for _, existingID := range ids {
		if existingID != id {
			newIDs = append(newIDs, existingID)
		}
	}

	newData, err := json.Marshal(newIDs)
	if err != nil {
		return fmt.Errorf("failed to marshal sticker index: %w", err)
	}

	if appErr := p.API.KVSet(stickersKey, newData); appErr != nil {
		return fmt.Errorf("failed to save sticker index: %w", appErr)
	}

	return nil
}

func (p *Plugin) CanDeleteSticker(userID, stickerID string) (bool, error) {
	user, appErr := p.API.GetUser(userID)
	if appErr != nil {
		return false, fmt.Errorf("failed to get user: %w", appErr)
	}

	if user.IsSystemAdmin() {
		return true, nil
	}

	sticker, err := p.GetSticker(stickerID)
	if err != nil {
		return false, err
	}

	return sticker.CreatorID == userID, nil
}

func (p *Plugin) SearchStickers(query string) (*StickerList, error) {
	list, err := p.GetAllStickers()
	if err != nil {
		return nil, err
	}

	if query == "" {
		return list, nil
	}

	normalizedQuery := strings.ToLower(strings.TrimSpace(query))
	filtered := make([]*Sticker, 0)

	for _, s := range list.Stickers {
		if strings.Contains(strings.ToLower(s.Name), normalizedQuery) {
			filtered = append(filtered, s)
		}
	}

	return &StickerList{
		Stickers: filtered,
		Total:    len(filtered),
	}, nil
}

func (p *Plugin) IsStickerNameTaken(name string) bool {
	_, err := p.GetStickerByName(name)
	return err == nil
}

func (p *Plugin) UploadStickerImage(fileData []byte, filename, userID, channelID string) (*model.FileInfo, error) {
	fileInfo, appErr := p.API.UploadFile(fileData, channelID, filename)
	if appErr != nil {
		return nil, fmt.Errorf("failed to upload file: %w", appErr)
	}

	return fileInfo, nil
}

// SaveStickerImageToLocal saves sticker image to local filesystem and returns the filename
func (p *Plugin) SaveStickerImageToLocal(fileData []byte, originalFilename string) (string, error) {
	cfg := p.getConfiguration()
	if cfg.StickerStoragePath == "" {
		return "", fmt.Errorf("sticker storage path not configured")
	}

	// Generate unique filename
	ext := filepath.Ext(originalFilename)
	filename := model.NewId() + ext

	fullPath := filepath.Join(cfg.StickerStoragePath, filename)

	// Ensure directory exists
	if err := os.MkdirAll(cfg.StickerStoragePath, 0755); err != nil {
		return "", fmt.Errorf("failed to create storage directory: %w", err)
	}

	// Write file
	if err := os.WriteFile(fullPath, fileData, 0644); err != nil {
		return "", fmt.Errorf("failed to write sticker file: %w", err)
	}

	return filename, nil
}

// DeleteStickerImageFromLocal deletes sticker image from local filesystem
func (p *Plugin) DeleteStickerImageFromLocal(filename string) error {
	cfg := p.getConfiguration()
	if cfg.StickerStoragePath == "" || filename == "" {
		return nil
	}

	fullPath := filepath.Join(cfg.StickerStoragePath, filename)
	return os.Remove(fullPath)
}

// GetStickerPublicURL returns the public URL for a sticker
func (p *Plugin) GetStickerPublicURL(filename string) string {
	cfg := p.getConfiguration()
	if cfg.StickerServerURL == "" || filename == "" {
		return ""
	}

	return strings.TrimSuffix(cfg.StickerServerURL, "/") + "/" + filename
}
