import React from 'react';
import ReactDOM from 'react-dom';
import { PluginRegistry, Store, Sticker } from './types';
import StickerPicker from './components/StickerPicker';
import StickerPost from './components/StickerPost';
import { StickerIcon } from './components/StickerButton';
import { doPost } from './actions/api';

const PLUGIN_ID = 'com.example.sticker';

declare global {
    interface Window {
        registerPlugin: (id: string, plugin: Plugin) => void;
    }
}

interface PluginState {
    pickerVisible: boolean;
    channelId: string;
    rootId: string;
}

class Plugin {
    private registry: PluginRegistry | null = null;
    private store: Store | null = null;
    private registeredComponents: string[] = [];
    private pickerContainer: HTMLDivElement | null = null;
    private state: PluginState = {
        pickerVisible: false,
        channelId: '',
        rootId: '',
    };

    public initialize(registry: PluginRegistry, store: Store): void {
        this.registry = registry;
        this.store = store;

        // Register custom post type for stickers
        registry.registerPostTypeComponent('custom_sticker', StickerPost);

        // Register file upload method (appears in attachment menu, bottom left)
        if ((registry as any).registerFileUploadMethod) {
            (registry as any).registerFileUploadMethod(
                <StickerIcon />,
                this.openStickerPicker.bind(this),
                'Stickers'
            );
        }

        // Also register channel header button as fallback
        registry.registerChannelHeaderButtonAction(
            <StickerIcon />,
            this.openStickerPicker.bind(this),
            'Stickers',
            'Send a sticker'
        );

        // Create picker container
        this.createPickerContainer();
    }

    private createPickerContainer(): void {
        this.pickerContainer = document.createElement('div');
        this.pickerContainer.id = 'sticker-picker-container';
        document.body.appendChild(this.pickerContainer);
    }

    private openStickerPicker(channelIdOrObject: string | { id?: string; channel_id?: string } | undefined): void {
        if (!this.pickerContainer || !this.store) return;

        const state = this.store.getState();
        const currentUserId = state.entities?.users?.currentUserId || '';

        // Handle different formats that might be passed
        let channelId = '';
        if (typeof channelIdOrObject === 'string') {
            channelId = channelIdOrObject;
        } else if (channelIdOrObject && typeof channelIdOrObject === 'object') {
            channelId = channelIdOrObject.id || channelIdOrObject.channel_id || '';
        }

        // Fallback to current channel from state
        if (!channelId) {
            channelId = state.entities?.channels?.currentChannelId || '';
        }

        // Get root_id if we're in a thread (RHS)
        let rootId = '';
        const rhsState = state.views?.rhs;
        if (rhsState?.selectedPostId) {
            rootId = rhsState.selectedPostId;
        }

        this.state = {
            pickerVisible: true,
            channelId,
            rootId,
        };

        this.renderPicker(currentUserId);
    }

    private closeStickerPicker(): void {
        if (!this.pickerContainer) return;

        this.state.pickerVisible = false;
        ReactDOM.unmountComponentAtNode(this.pickerContainer);
    }

    private handleStickerSelect(sticker: Sticker): void {
        if (!this.store) return;

        const { channelId, rootId } = this.state;

        // Send sticker via REST API
        this.sendStickerPost(channelId, sticker, rootId);

        this.closeStickerPicker();
    }

    private async sendStickerPost(channelId: string, sticker: Sticker, rootId?: string): Promise<void> {
        try {
            // Use file_ids for mobile compatibility
            const postData: any = {
                channel_id: channelId,
                message: '',
                file_ids: [sticker.file_id],
            };

            // Add root_id for thread replies
            if (rootId) {
                postData.root_id = rootId;
            }

            await doPost('/api/v4/posts', postData);
        } catch (error) {
            console.error('Failed to send sticker:', error);
        }
    }

    private renderPicker(currentUserId: string): void {
        if (!this.pickerContainer) return;

        ReactDOM.render(
            <StickerPicker
                channelId={this.state.channelId}
                onSelect={this.handleStickerSelect.bind(this)}
                onClose={this.closeStickerPicker.bind(this)}
                currentUserId={currentUserId}
            />,
            this.pickerContainer
        );
    }

    public uninitialize(): void {
        if (this.pickerContainer) {
            ReactDOM.unmountComponentAtNode(this.pickerContainer);
            this.pickerContainer.remove();
            this.pickerContainer = null;
        }
    }
}

// Register the plugin
window.registerPlugin(PLUGIN_ID, new Plugin());
