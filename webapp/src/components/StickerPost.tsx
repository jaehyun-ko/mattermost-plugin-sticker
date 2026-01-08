import React, { useEffect, useRef } from 'react';
import { StickerPostProps } from '../types';
import { getStickerImageUrl } from '../actions/api';

const StickerPost: React.FC<StickerPostProps> = ({ post }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const stickerId = post.props?.sticker_id;
    const stickerName = post.props?.sticker_name;

    // Hide default file attachment UI
    useEffect(() => {
        if (containerRef.current) {
            const postContainer = containerRef.current.closest('.post__content');
            if (postContainer) {
                const filePreview = postContainer.querySelector('.file-preview__button, .post-image__columns, .post-image');
                if (filePreview) {
                    (filePreview as HTMLElement).style.display = 'none';
                }
            }
        }
    }, []);

    if (!stickerId) {
        return null;
    }

    const imageUrl = getStickerImageUrl(stickerId);

    return (
        <div ref={containerRef} className="sticker-post" style={styles.container}>
            <img
                src={imageUrl}
                alt={stickerName || 'Sticker'}
                style={styles.image}
                loading="lazy"
            />
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        display: 'inline-block',
        maxWidth: '200px',
        maxHeight: '200px',
    },
    image: {
        maxWidth: '100%',
        maxHeight: '200px',
        objectFit: 'contain',
        borderRadius: '4px',
    },
};

export default StickerPost;
