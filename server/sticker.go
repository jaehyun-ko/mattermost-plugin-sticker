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
	Filename  string `json:"filename"`
	CreatorID string `json:"creator_id"`
	CreatedAt int64  `json:"created_at"`
}

type StickerList struct {
	Stickers []*Sticker `json:"stickers"`
	Total    int        `json:"total"`
}

func NewSticker(name, fileID, filename, creatorID string) *Sticker {
	return &Sticker{
		ID:        model.NewId(),
		Name:      name,
		FileID:    fileID,
		Filename:  filename,
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

func (p *Plugin) CreateStickerPost(channelID, userID, stickerID, rootID string) (*model.Post, error) {
	sticker, err := p.GetSticker(stickerID)
	if err != nil {
		return nil, err
	}

	// Use file_ids for mobile compatibility
	post := &model.Post{
		UserId:    userID,
		ChannelId: channelID,
		RootId:    rootID,
		FileIds:   []string{sticker.FileID},
	}

	return p.API.CreatePost(post)
}
