package main

import (
	"encoding/json"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

type Sticker struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	FileID    string `json:"file_id"`
	CreatorID string `json:"creator_id"`
	CreatedAt int64  `json:"created_at"`
}

type StickerList struct {
	Stickers []*Sticker `json:"stickers"`
	Total    int        `json:"total"`
}

func NewSticker(name, fileID, creatorID string) *Sticker {
	return &Sticker{
		ID:        model.NewId(),
		Name:      name,
		FileID:    fileID,
		CreatorID: creatorID,
		CreatedAt: time.Now().UnixMilli(),
	}
}

func (s *Sticker) ToJSON() ([]byte, error) {
	return json.Marshal(s)
}

func StickerFromJSON(data []byte) (*Sticker, error) {
	var s Sticker
	if err := json.Unmarshal(data, &s); err != nil {
		return nil, err
	}
	return &s, nil
}

func (p *Plugin) CreateStickerPost(channelID, userID, stickerID string) (*model.Post, error) {
	sticker, err := p.GetSticker(stickerID)
	if err != nil {
		return nil, err
	}

	post := &model.Post{
		UserId:    userID,
		ChannelId: channelID,
		Type:      "custom_sticker",
		Props: map[string]interface{}{
			"sticker_id":   sticker.ID,
			"sticker_name": sticker.Name,
			"file_id":      sticker.FileID,
		},
	}

	return p.API.CreatePost(post)
}
