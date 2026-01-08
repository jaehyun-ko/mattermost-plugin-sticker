import React from 'react';
import { StickerPostProps } from '../types';
import { getFileUrl } from '../actions/api';

const StickerPost: React.FC<StickerPostProps> = ({ post }) => {
    const fileId = post.file_ids?.[0];
    const stickerName = post.props?.sticker_name;

    if (!fileId) {
        return <div>Invalid sticker</div>;
    }

    const imageUrl = getFileUrl(fileId);

    return (
        <div className="sticker-post" style={styles.container}>
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
