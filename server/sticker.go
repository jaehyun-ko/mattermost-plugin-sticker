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

func (p *Plugin) CreateStickerPost(channelID, userID, stickerID, rootID string) (*model.Post, error) {
	sticker, err := p.GetSticker(stickerID)
	if err != nil {
		return nil, err
	}

	// Use markdown image for mobile compatibility
	imageURL := "/plugins/com.example.sticker/api/v1/stickers/" + sticker.ID + "/image"
	message := "![" + sticker.Name + "](" + imageURL + ")"

	post := &model.Post{
		UserId:    userID,
		ChannelId: channelID,
		RootId:    rootID,
		Message:   message,
	}

	return p.API.CreatePost(post)
}
