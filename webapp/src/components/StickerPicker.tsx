import React, { useState, useEffect, useCallback } from 'react';
import { Sticker } from '../types';
import { getStickers, searchStickers, uploadSticker, uploadStickerFromURL, deleteSticker, getStickerImageUrl, bulkUploadStickers, BulkUploadResult } from '../actions/api';

interface StickerPickerProps {
    channelId: string;
    onSelect: (sticker: Sticker) => void;
    onClose: () => void;
    currentUserId: string;
}

const StickerPicker: React.FC<StickerPickerProps> = ({
    channelId,
    onSelect,
    onClose,
    currentUserId,
}) => {
    const [stickers, setStickers] = useState<Sticker[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showUpload, setShowUpload] = useState(false);
    const [uploadMode, setUploadMode] = useState<'file' | 'url' | 'bulk'>('file');
    const [uploadName, setUploadName] = useState('');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadUrl, setUploadUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const [bulkFiles, setBulkFiles] = useState<FileList | null>(null);
    const [bulkResult, setBulkResult] = useState<BulkUploadResult | null>(null);

    const loadStickers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const result = searchQuery
                ? await searchStickers(searchQuery)
                : await getStickers();
            setStickers(result.stickers);
        } catch (err) {
            setError('Failed to load stickers');
        } finally {
            setLoading(false);
        }
    }, [searchQuery]);

    useEffect(() => {
        loadStickers();
    }, [loadStickers]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleUpload = async () => {
        console.log('[Sticker] Upload clicked', { uploadName, uploadFile, uploadUrl, uploadMode, channelId });

        if (!uploadName.trim()) {
            setError('Please provide a name');
            return;
        }

        if (uploadMode === 'file' && !uploadFile) {
            setError('Please select a file');
            return;
        }

        if (uploadMode === 'url' && !uploadUrl.trim()) {
            setError('Please provide an image URL');
            return;
        }

        try {
            setUploading(true);
            setError(null);

            if (uploadMode === 'file' && uploadFile) {
                console.log('[Sticker] Uploading file...', uploadName, uploadFile.name);
                await uploadSticker(uploadName.trim(), uploadFile, channelId);
            } else if (uploadMode === 'url') {
                console.log('[Sticker] Uploading from URL...', uploadName, uploadUrl);
                await uploadStickerFromURL(uploadName.trim(), uploadUrl.trim(), channelId);
            }

            console.log('[Sticker] Upload success');
            setUploadName('');
            setUploadFile(null);
            setUploadUrl('');
            setShowUpload(false);
            loadStickers();
        } catch (err) {
            console.error('[Sticker] Upload error:', err);
            setError(err instanceof Error ? err.message : 'Failed to upload sticker');
        } finally {
            setUploading(false);
        }
    };

    const handleBulkUpload = async () => {
        if (!bulkFiles || bulkFiles.length === 0) {
            setError('Please select files');
            return;
        }

        try {
            setUploading(true);
            setError(null);
            setBulkResult(null);

            const result = await bulkUploadStickers(bulkFiles, channelId);
            setBulkResult(result);

            if (result.success.length > 0) {
                loadStickers();
            }

            if (Object.keys(result.failed).length === 0) {
                setBulkFiles(null);
                setShowUpload(false);
            }
        } catch (err) {
            console.error('[Sticker] Bulk upload error:', err);
            setError(err instanceof Error ? err.message : 'Failed to upload stickers');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (sticker: Sticker) => {
        if (!window.confirm(`Delete sticker "${sticker.name}"?`)) {
            return;
        }

        try {
            await deleteSticker(sticker.id);
            loadStickers();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete sticker');
        }
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.container} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h3 style={styles.title}>Stickers</h3>
                    <button style={styles.closeButton} onClick={onClose}>
                        &times;
                    </button>
                </div>

                <div style={styles.searchContainer}>
                    <input
                        type="text"
                        placeholder="Search stickers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={styles.searchInput}
                    />
                    <button
                        style={styles.addButton}
                        onClick={() => setShowUpload(!showUpload)}
                    >
                        {showUpload ? 'Cancel' : '+ Add'}
                    </button>
                </div>

                {showUpload && (
                    <div style={styles.uploadContainer}>
                        <div style={styles.tabContainer}>
                            <button
                                style={{
                                    ...styles.tab,
                                    ...(uploadMode === 'file' ? styles.tabActive : {}),
                                }}
                                onClick={() => { setUploadMode('file'); setBulkResult(null); }}
                            >
                                File
                            </button>
                            <button
                                style={{
                                    ...styles.tab,
                                    ...(uploadMode === 'url' ? styles.tabActive : {}),
                                }}
                                onClick={() => { setUploadMode('url'); setBulkResult(null); }}
                            >
                                URL
                            </button>
                            <button
                                style={{
                                    ...styles.tab,
                                    ...(uploadMode === 'bulk' ? styles.tabActive : {}),
                                }}
                                onClick={() => { setUploadMode('bulk'); setBulkResult(null); }}
                            >
                                Bulk
                            </button>
                        </div>
                        {uploadMode === 'bulk' ? (
                            <>
                                <div style={styles.bulkHint}>
                                    Select multiple files. Sticker names will be set from filenames (without extension).
                                </div>
                                <div style={styles.fileInputWrapper}>
                                    <input
                                        type="file"
                                        id="sticker-bulk-input"
                                        accept="image/png,image/gif,image/jpeg,image/webp"
                                        multiple
                                        onChange={(e) => {
                                            setBulkFiles(e.target.files);
                                            setBulkResult(null);
                                        }}
                                        style={styles.fileInputHidden}
                                    />
                                    <label htmlFor="sticker-bulk-input" style={styles.fileInputLabel}>
                                        {bulkFiles ? `${bulkFiles.length} file(s) selected` : 'Choose files...'}
                                    </label>
                                </div>
                                {bulkResult && (
                                    <div style={styles.bulkResult}>
                                        {bulkResult.success.length > 0 && (
                                            <div style={styles.bulkSuccess}>
                                                Added: {bulkResult.success.join(', ')}
                                            </div>
                                        )}
                                        {Object.keys(bulkResult.failed).length > 0 && (
                                            <div style={styles.bulkFailed}>
                                                Failed:
                                                {Object.entries(bulkResult.failed).map(([file, reason]) => (
                                                    <div key={file} style={styles.bulkFailedItem}>
                                                        {file}: {reason}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <button
                                    style={{
                                        ...styles.uploadButton,
                                        ...(uploading || !bulkFiles || bulkFiles.length === 0 ? styles.uploadButtonDisabled : {}),
                                    }}
                                    onClick={handleBulkUpload}
                                    disabled={uploading || !bulkFiles || bulkFiles.length === 0}
                                >
                                    {uploading ? 'Uploading...' : !bulkFiles ? 'Select files' : `Upload ${bulkFiles.length} file(s)`}
                                </button>
                            </>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    placeholder="Sticker name"
                                    value={uploadName}
                                    onChange={(e) => setUploadName(e.target.value)}
                                    style={styles.uploadInput}
                                />
                                {uploadMode === 'file' ? (
                                    <div style={styles.fileInputWrapper}>
                                        <input
                                            type="file"
                                            id="sticker-file-input"
                                            accept="image/png,image/gif,image/jpeg,image/webp"
                                            onChange={(e) => {
                                                console.log('[Sticker] File selected:', e.target.files?.[0]);
                                                setUploadFile(e.target.files?.[0] || null);
                                            }}
                                            style={styles.fileInputHidden}
                                        />
                                        <label htmlFor="sticker-file-input" style={styles.fileInputLabel}>
                                            {uploadFile ? uploadFile.name : 'Choose file...'}
                                        </label>
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder="https://example.com/image.png"
                                        value={uploadUrl}
                                        onChange={(e) => setUploadUrl(e.target.value)}
                                        style={styles.uploadInput}
                                    />
                                )}
                                <button
                                    style={{
                                        ...styles.uploadButton,
                                        ...(uploading || !uploadName.trim() || (uploadMode === 'file' ? !uploadFile : !uploadUrl.trim())
                                            ? styles.uploadButtonDisabled
                                            : {}),
                                    }}
                                    onClick={handleUpload}
                                    disabled={uploading || !uploadName.trim() || (uploadMode === 'file' ? !uploadFile : !uploadUrl.trim())}
                                >
                                    {uploading
                                        ? 'Uploading...'
                                        : !uploadName.trim()
                                        ? 'Enter name'
                                        : uploadMode === 'file' && !uploadFile
                                        ? 'Select file'
                                        : uploadMode === 'url' && !uploadUrl.trim()
                                        ? 'Enter URL'
                                        : 'Upload'}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {error && <div style={styles.error}>{error}</div>}

                <div style={styles.grid}>
                    {loading ? (
                        <div style={styles.loading}>Loading...</div>
                    ) : stickers.length === 0 ? (
                        <div style={styles.empty}>
                            {searchQuery ? 'No stickers found' : 'No stickers yet. Add one!'}
                        </div>
                    ) : (
                        stickers.map((sticker) => (
                            <div
                                key={sticker.id}
                                style={styles.stickerItem}
                                onClick={() => onSelect(sticker)}
                                title={sticker.name}
                            >
                                <img
                                    src={getStickerImageUrl(sticker.id)}
                                    alt={sticker.name}
                                    style={styles.stickerImage}
                                    loading="lazy"
                                />
                                <span style={styles.stickerName}>{sticker.name}</span>
                                {sticker.creator_id === currentUserId && (
                                    <button
                                        style={styles.deleteButton}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(sticker);
                                        }}
                                        title="Delete"
                                    >
                                        &times;
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

// Use CSS variables from Mattermost theme
const styles: { [key: string]: React.CSSProperties } = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
    },
    container: {
        backgroundColor: 'var(--center-channel-bg, #fff)',
        color: 'var(--center-channel-color, #3d3c40)',
        borderRadius: '8px',
        width: '400px',
        maxHeight: '500px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid var(--center-channel-color-16, #e0e0e0)',
    },
    title: {
        margin: 0,
        fontSize: '16px',
        fontWeight: 600,
        color: 'var(--center-channel-color, #3d3c40)',
    },
    closeButton: {
        background: 'none',
        border: 'none',
        fontSize: '24px',
        cursor: 'pointer',
        color: 'var(--center-channel-color-56, #666)',
        padding: '0 4px',
    },
    searchContainer: {
        display: 'flex',
        gap: '8px',
        padding: '12px 16px',
        borderBottom: '1px solid var(--center-channel-color-16, #e0e0e0)',
    },
    searchInput: {
        flex: 1,
        padding: '8px 12px',
        border: '1px solid var(--center-channel-color-24, #ddd)',
        borderRadius: '4px',
        fontSize: '14px',
        backgroundColor: 'var(--center-channel-bg, #fff)',
        color: 'var(--center-channel-color, #3d3c40)',
    },
    addButton: {
        padding: '8px 16px',
        backgroundColor: 'var(--button-bg, #166de0)',
        color: 'var(--button-color, #fff)',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 600,
    },
    uploadContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '12px 16px',
        backgroundColor: 'var(--center-channel-color-04, #f5f5f5)',
        borderBottom: '1px solid var(--center-channel-color-16, #e0e0e0)',
    },
    uploadInput: {
        padding: '8px 12px',
        border: '1px solid var(--center-channel-color-24, #ddd)',
        borderRadius: '4px',
        fontSize: '14px',
        backgroundColor: 'var(--center-channel-bg, #fff)',
        color: 'var(--center-channel-color, #3d3c40)',
    },
    tabContainer: {
        display: 'flex',
        gap: '4px',
    },
    tab: {
        flex: 1,
        padding: '6px 12px',
        border: '1px solid var(--center-channel-color-24, #ddd)',
        borderRadius: '4px',
        backgroundColor: 'var(--center-channel-bg, #fff)',
        color: 'var(--center-channel-color, #3d3c40)',
        cursor: 'pointer',
        fontSize: '13px',
    },
    tabActive: {
        backgroundColor: 'var(--button-bg, #166de0)',
        color: 'var(--button-color, #fff)',
        borderColor: 'var(--button-bg, #166de0)',
    },
    fileInputWrapper: {
        position: 'relative',
    },
    fileInputHidden: {
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        border: 0,
    },
    fileInputLabel: {
        display: 'block',
        padding: '8px 12px',
        backgroundColor: 'var(--center-channel-color-08, #f0f0f0)',
        border: '1px solid var(--center-channel-color-24, #ddd)',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px',
        textAlign: 'center',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: 'var(--center-channel-color, #3d3c40)',
    },
    uploadButton: {
        padding: '8px 16px',
        backgroundColor: 'var(--button-bg, #166de0)',
        color: 'var(--button-color, #fff)',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 600,
    },
    uploadButtonDisabled: {
        backgroundColor: 'var(--center-channel-color-24, #ccc)',
        color: 'var(--center-channel-color-56, #888)',
        cursor: 'not-allowed',
    },
    error: {
        padding: '8px 16px',
        backgroundColor: 'var(--error-text-color-08, #ffebee)',
        color: 'var(--error-text-color, #c62828)',
        fontSize: '14px',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px',
        padding: '16px',
        overflowY: 'auto',
        flex: 1,
    },
    stickerItem: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    stickerImage: {
        width: '64px',
        height: '64px',
        objectFit: 'contain',
    },
    stickerName: {
        fontSize: '10px',
        marginTop: '4px',
        textAlign: 'center',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: '100%',
        color: 'var(--center-channel-color, #3d3c40)',
    },
    deleteButton: {
        position: 'absolute',
        top: '2px',
        right: '2px',
        background: 'var(--error-text-color, #d24b4e)',
        color: '#fff',
        border: 'none',
        borderRadius: '50%',
        width: '18px',
        height: '18px',
        fontSize: '12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loading: {
        gridColumn: '1 / -1',
        textAlign: 'center',
        padding: '20px',
        color: 'var(--center-channel-color-56, #666)',
    },
    empty: {
        gridColumn: '1 / -1',
        textAlign: 'center',
        padding: '20px',
        color: 'var(--center-channel-color-56, #666)',
    },
    bulkHint: {
        fontSize: '12px',
        color: 'var(--center-channel-color-56, #666)',
        marginBottom: '4px',
    },
    bulkResult: {
        padding: '8px',
        borderRadius: '4px',
        backgroundColor: 'var(--center-channel-bg, #fff)',
        border: '1px solid var(--center-channel-color-24, #ddd)',
        fontSize: '12px',
        maxHeight: '100px',
        overflowY: 'auto',
    },
    bulkSuccess: {
        color: 'var(--online-indicator, #3db887)',
        marginBottom: '4px',
    },
    bulkFailed: {
        color: 'var(--error-text-color, #d24b4e)',
    },
    bulkFailedItem: {
        marginLeft: '8px',
        fontSize: '11px',
    },
};

export default StickerPicker;
