package main

import (
	"encoding/json"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost/server/public/model"
)

func (p *Plugin) initAPI() {
	p.router.HandleFunc("/api/v1/stickers", p.handleGetStickers).Methods(http.MethodGet)
	p.router.HandleFunc("/api/v1/stickers", p.handleCreateSticker).Methods(http.MethodPost)
	p.router.HandleFunc("/api/v1/stickers/bulk", p.handleBulkUpload).Methods(http.MethodPost)
	p.router.HandleFunc("/api/v1/stickers/from-url", p.handleCreateStickerFromURL).Methods(http.MethodPost)
	p.router.HandleFunc("/api/v1/stickers/send", p.handleSendSticker).Methods(http.MethodPost)
	p.router.HandleFunc("/api/v1/stickers/{id}", p.handleDeleteSticker).Methods(http.MethodDelete)
	p.router.HandleFunc("/api/v1/stickers/{id}/image", p.handleGetStickerImage).Methods(http.MethodGet)
	p.router.HandleFunc("/api/v1/stickers/search", p.handleSearchStickers).Methods(http.MethodGet)
}

func (p *Plugin) handleGetStickers(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	list, err := p.GetAllStickers()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

func (p *Plugin) handleCreateSticker(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	name := r.FormValue("name")
	if name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}

	if p.IsStickerNameTaken(name) {
		http.Error(w, "Sticker name already exists", http.StatusConflict)
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "Image file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowedExts := strings.Split(p.getConfiguration().AllowedFormats, ",")
	isAllowed := false
	for _, allowed := range allowedExts {
		if "."+strings.TrimSpace(allowed) == ext {
			isAllowed = true
			break
		}
	}
	if !isAllowed {
		http.Error(w, "File format not allowed", http.StatusBadRequest)
		return
	}

	maxSize := int64(p.getConfiguration().MaxStickerSize * 1024)
	if header.Size > maxSize {
		http.Error(w, "File size exceeds limit", http.StatusBadRequest)
		return
	}

	fileData, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "Failed to read file", http.StatusInternalServerError)
		return
	}

	// Save to local filesystem
	filename, err := p.SaveStickerImageToLocal(fileData, header.Filename)
	if err != nil {
		http.Error(w, "Failed to save sticker image: "+err.Error(), http.StatusInternalServerError)
		return
	}

	sticker := NewSticker(name, "", filename, userID)
	if err := p.SaveSticker(sticker); err != nil {
		http.Error(w, "Failed to save sticker: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(sticker)
}

func (p *Plugin) handleDeleteSticker(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	stickerID := vars["id"]

	canDelete, err := p.CanDeleteSticker(userID, stickerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	if !canDelete {
		http.Error(w, "Permission denied: you can only delete your own stickers", http.StatusForbidden)
		return
	}

	// Get sticker to delete local file
	sticker, err := p.GetSticker(stickerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	// Delete local file
	if sticker.Filename != "" {
		p.DeleteStickerImageFromLocal(sticker.Filename)
	}

	if err := p.DeleteSticker(stickerID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (p *Plugin) handleGetStickerImage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	stickerID := vars["id"]

	sticker, err := p.GetSticker(stickerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	fileInfo, appErr := p.API.GetFileInfo(sticker.FileID)
	if appErr != nil {
		http.Error(w, "Failed to get file info", http.StatusInternalServerError)
		return
	}

	fileData, appErr := p.API.GetFile(sticker.FileID)
	if appErr != nil {
		http.Error(w, "Failed to get file", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", fileInfo.MimeType)
	w.Header().Set("Cache-Control", "public, max-age=31536000")
	w.Write(fileData)
}

func (p *Plugin) handleSearchStickers(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	query := r.URL.Query().Get("q")
	list, err := p.SearchStickers(query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

func (p *Plugin) handleCreateStickerFromURL(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Name      string `json:"name"`
		URL       string `json:"url"`
		ChannelID string `json:"channel_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.URL == "" {
		http.Error(w, "Name and URL are required", http.StatusBadRequest)
		return
	}

	if p.IsStickerNameTaken(req.Name) {
		http.Error(w, "Sticker name already exists", http.StatusConflict)
		return
	}

	// Download image from URL
	resp, err := http.Get(req.URL)
	if err != nil {
		http.Error(w, "Failed to download image: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		http.Error(w, "Failed to download image: status "+resp.Status, http.StatusBadRequest)
		return
	}

	contentType := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		http.Error(w, "URL does not point to an image", http.StatusBadRequest)
		return
	}

	maxSize := int64(p.getConfiguration().MaxStickerSize * 1024)
	fileData, err := io.ReadAll(io.LimitReader(resp.Body, maxSize+1))
	if err != nil {
		http.Error(w, "Failed to read image: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if int64(len(fileData)) > maxSize {
		http.Error(w, "Image size exceeds limit", http.StatusBadRequest)
		return
	}

	// Determine extension from content type
	ext := ".png"
	switch contentType {
	case "image/gif":
		ext = ".gif"
	case "image/jpeg":
		ext = ".jpg"
	case "image/webp":
		ext = ".webp"
	}

	// Save to local filesystem
	filename, err := p.SaveStickerImageToLocal(fileData, "sticker_"+req.Name+ext)
	if err != nil {
		http.Error(w, "Failed to save sticker image: "+err.Error(), http.StatusInternalServerError)
		return
	}

	sticker := NewSticker(req.Name, "", filename, userID)
	if err := p.SaveSticker(sticker); err != nil {
		http.Error(w, "Failed to save sticker: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(sticker)
}

type BulkUploadResult struct {
	Success []string          `json:"success"`
	Failed  map[string]string `json:"failed"`
}

func (p *Plugin) handleBulkUpload(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// 32MB max for bulk upload
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	allowedExts := strings.Split(p.getConfiguration().AllowedFormats, ",")
	maxSize := int64(p.getConfiguration().MaxStickerSize * 1024)

	result := BulkUploadResult{
		Success: []string{},
		Failed:  make(map[string]string),
	}

	files := r.MultipartForm.File["images"]
	if len(files) == 0 {
		http.Error(w, "No files provided", http.StatusBadRequest)
		return
	}

	for _, fileHeader := range files {
		filename := fileHeader.Filename
		ext := strings.ToLower(filepath.Ext(filename))
		name := strings.TrimSuffix(filename, ext)

		// Validate extension
		isAllowed := false
		for _, allowed := range allowedExts {
			if "."+strings.TrimSpace(allowed) == ext {
				isAllowed = true
				break
			}
		}
		if !isAllowed {
			result.Failed[filename] = "File format not allowed"
			continue
		}

		// Validate size
		if fileHeader.Size > maxSize {
			result.Failed[filename] = "File size exceeds limit"
			continue
		}

		// Check duplicate name
		if p.IsStickerNameTaken(name) {
			result.Failed[filename] = "Sticker name already exists"
			continue
		}

		// Read file
		file, err := fileHeader.Open()
		if err != nil {
			result.Failed[filename] = "Failed to open file"
			continue
		}

		fileData, err := io.ReadAll(file)
		file.Close()
		if err != nil {
			result.Failed[filename] = "Failed to read file"
			continue
		}

		// Save to local filesystem
		savedFilename, err := p.SaveStickerImageToLocal(fileData, "sticker_"+name+ext)
		if err != nil {
			result.Failed[filename] = "Failed to save: " + err.Error()
			continue
		}

		// Save sticker metadata
		sticker := NewSticker(name, "", savedFilename, userID)
		if err := p.SaveSticker(sticker); err != nil {
			result.Failed[filename] = "Failed to save: " + err.Error()
			continue
		}

		result.Success = append(result.Success, name)
	}

	w.Header().Set("Content-Type", "application/json")
	if len(result.Failed) > 0 && len(result.Success) == 0 {
		w.WriteHeader(http.StatusBadRequest)
	} else if len(result.Failed) > 0 {
		w.WriteHeader(http.StatusPartialContent)
	} else {
		w.WriteHeader(http.StatusCreated)
	}
	json.NewEncoder(w).Encode(result)
}

func (p *Plugin) handleSendSticker(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		ChannelID string `json:"channel_id"`
		StickerID string `json:"sticker_id"`
		RootID    string `json:"root_id,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.ChannelID == "" || req.StickerID == "" {
		http.Error(w, "channel_id and sticker_id are required", http.StatusBadRequest)
		return
	}

	sticker, err := p.GetSticker(req.StickerID)
	if err != nil {
		http.Error(w, "Sticker not found", http.StatusNotFound)
		return
	}

	// Verify user has access to the channel
	if _, appErr := p.API.GetChannelMember(req.ChannelID, userID); appErr != nil {
		http.Error(w, "You don't have access to this channel", http.StatusForbidden)
		return
	}

	// Get public URL for sticker image
	imageURL := p.GetStickerPublicURL(sticker.Filename)
	if imageURL == "" {
		http.Error(w, "Sticker server not configured", http.StatusInternalServerError)
		return
	}

	// Create post with markdown image (works on all platforms)
	post := &model.Post{
		UserId:    userID,
		ChannelId: req.ChannelID,
		Message:   "![" + sticker.Name + "](" + imageURL + ")",
	}

	if req.RootID != "" {
		post.RootId = req.RootID
	}

	createdPost, appErr := p.API.CreatePost(post)
	if appErr != nil {
		http.Error(w, "Failed to create post: "+appErr.Message, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(createdPost)
}
