import { useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import ChatPlayground from './ChatPlayground';
import ImagePlayground from './ImagePlayground';
import { VscComment, VscFileMedia } from 'react-icons/vsc';
import './Playground.css';

const PlaygroundPage = () => {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState('chat');

    return (
        <div className="playground-container">
            <div className="playground-tabs">
                <button
                    className={`playground-tab ${activeTab === 'chat' ? 'active' : ''}`}
                    onClick={() => setActiveTab('chat')}
                >
                    <VscComment size={18} />
                    <span>{t('playground.chatTab') || 'Chat'}</span>
                </button>
                <button
                    className={`playground-tab ${activeTab === 'image' ? 'active' : ''}`}
                    onClick={() => setActiveTab('image')}
                >
                    <VscFileMedia size={18} />
                    <span>{t('playground.imageTab') || 'Image'}</span>
                </button>
            </div>

            {/* Use CSS display to preserve component state instead of unmounting */}
            <div className="playground-content">
                <div style={{ display: activeTab === 'chat' ? 'contents' : 'none' }}>
                    <ChatPlayground />
                </div>
                <div style={{ display: activeTab === 'image' ? 'contents' : 'none' }}>
                    <ImagePlayground />
                </div>
            </div>
        </div>
    );
};

export default PlaygroundPage;
