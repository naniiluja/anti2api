import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../../context/I18nContext';
import { useToast } from '../../context/ToastContext';
import { VscAdd, VscTrash, VscDesktopDownload, VscClose, VscCloudUpload } from 'react-icons/vsc';
import ImageGallery from './ImageGallery';
import ImageViewer from './ImageViewer';
import { getImageModels, generateImage, transformImage } from './playgroundService';
import { addGalleryImage, getGalleryImages, deleteGalleryImage } from './storageService';
import { addHistory } from '../history/historyService';

const IMAGE_SIZES = [
    { label: '512×512', model: 'gemini-3-pro-image', size: '512' },
    { label: '1024×1024', model: 'gemini-3-pro-image', size: '1024' },
    { label: '2K', model: 'gemini-3-pro-image-2K', size: '2k' },
    { label: '4K', model: 'gemini-3-pro-image-4K', size: '4k' }
];

const ImagePlayground = () => {
    const { t } = useI18n();
    const { showToast } = useToast();
    const [mode, setMode] = useState('txt2img'); // 'txt2img' | 'img2img'
    const [prompt, setPrompt] = useState('');
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [uploadedImage, setUploadedImage] = useState(null);
    const [generatedImage, setGeneratedImage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [gallery, setGallery] = useState([]);
    const [showGallery, setShowGallery] = useState(true);
    const [showViewer, setShowViewer] = useState(false);
    const [generationQueue, setGenerationQueue] = useState([]); // Background queue
    const [generationProgress, setGenerationProgress] = useState(0);
    const fileInputRef = useRef(null);

    // Load models and gallery on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                const imageModels = await getImageModels();
                setModels(imageModels);
                // Auto-select first image model
                if (imageModels.length > 0) {
                    setSelectedModel(imageModels[0].id);
                }
            } catch (err) {
                console.error('Failed to load image models:', err);
            }
            setGallery(getGalleryImages());
        };
        loadData();
    }, []);

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result.split(',')[1];
                setUploadedImage({
                    file,
                    base64,
                    preview: event.target.result
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim() || !selectedModel) return;
        if (mode === 'img2img' && !uploadedImage) {
            setError(t('playground.uploadRequired') || 'Please upload an image first');
            return;
        }

        // Create generation task
        const taskId = Date.now();
        const task = {
            id: taskId,
            prompt: prompt.trim(),
            model: selectedModel,
            mode,
            uploadedBase64: uploadedImage?.base64,
            status: 'pending'
        };

        // Add to queue
        setGenerationQueue(prev => [...prev, task]);
        setError('');
        showToast(t('playground.generationStarted') || 'Image generation started...', 'info');

        // Start generation in background
        setIsLoading(true);
        setGenerationProgress(0);

        // Simulate progress
        const progressInterval = setInterval(() => {
            setGenerationProgress(prev => Math.min(prev + 10, 90));
        }, 500);

        try {
            let result;
            if (mode === 'txt2img') {
                result = await generateImage(task.prompt, task.model);
            } else {
                result = await transformImage(task.prompt, [task.uploadedBase64], task.model);
            }

            clearInterval(progressInterval);
            setGenerationProgress(100);

            if (result.images && result.images.length > 0) {
                const newImage = {
                    data: result.images[0],
                    prompt: task.prompt,
                    model: task.model
                };
                setGeneratedImage(newImage);

                // Auto-save to gallery
                const saved = addGalleryImage(newImage);
                setGallery(prev => [saved, ...prev.slice(0, 49)]);

                showToast(t('playground.generationComplete') || 'Image generated successfully!', 'success');
            } else {
                setError(t('playground.noImageGenerated') || 'No image was generated');
                showToast(t('playground.generationFailed') || 'Failed to generate image', 'error');
            }
        } catch (err) {
            clearInterval(progressInterval);
            const errorMsg = err.message || 'Failed to generate image';
            setError(errorMsg);
            showToast(errorMsg, 'error');

            // Log error to history for tracking
            try {
                await addHistory({
                    model: task.model,
                    status: 'error',
                    statusCode: 500,
                    duration: Date.now() - taskId,
                    errorMessage: errorMsg,
                    source: 'image-playground'
                });
            } catch (logErr) {
                console.error('Failed to log error to history:', logErr);
            }
        } finally {
            setIsLoading(false);
            setGenerationProgress(0);
            // Remove from queue
            setGenerationQueue(prev => prev.filter(t => t.id !== taskId));
        }
    };

    const handleSaveToGallery = () => {
        if (generatedImage) {
            const saved = addGalleryImage(generatedImage);
            setGallery([saved, ...gallery.slice(0, 49)]);
        }
    };

    const handleDeleteFromGallery = (imageId) => {
        deleteGalleryImage(imageId);
        setGallery(gallery.filter(img => img.id !== imageId));
    };

    const handleDownload = () => {
        if (generatedImage) {
            const link = document.createElement('a');
            link.href = `data:image/png;base64,${generatedImage.data}`;
            link.download = `generated-${Date.now()}.png`;
            link.click();
        }
    };

    const handleSelectFromGallery = (image) => {
        setGeneratedImage(image);
        setPrompt(image.prompt || '');
    };

    const handleEditImage = () => {
        // Set the generated image as input for img2img
        if (generatedImage) {
            setMode('img2img');
            setUploadedImage({
                base64: generatedImage.data,
                preview: `data:image/png;base64,${generatedImage.data}`
            });
        }
    };

    return (
        <div className="image-playground">
            {/* Sidebar toggle for mobile */}
            <button
                className="sidebar-toggle btn-ghost"
                onClick={() => setShowGallery(!showGallery)}
            >
                ☰
            </button>

            {/* Gallery Sidebar */}
            <ImageGallery
                images={gallery}
                onSelect={handleSelectFromGallery}
                onDelete={handleDeleteFromGallery}
                isVisible={showGallery}
                onClose={() => setShowGallery(false)}
            />

            {/* Main Image Area */}
            <div className="image-main">
                {/* Mode Toggle */}
                <div className="image-mode-toggle">
                    <button
                        className={`mode-btn ${mode === 'txt2img' ? 'active' : ''}`}
                        onClick={() => setMode('txt2img')}
                    >
                        {t('playground.textToImage') || 'Text to Image'}
                    </button>
                    <button
                        className={`mode-btn ${mode === 'img2img' ? 'active' : ''}`}
                        onClick={() => setMode('img2img')}
                    >
                        {t('playground.imageToImage') || 'Image to Image'}
                    </button>
                </div>

                {/* Model Selector */}
                <div className="model-selector-area">
                    <label>{t('playground.selectModel') || 'Model'}:</label>
                    <select
                        className="model-select"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                    >
                        {models.map(m => (
                            <option key={m.id} value={m.id}>{m.id}</option>
                        ))}
                    </select>
                </div>

                {/* Image Upload for img2img */}
                {mode === 'img2img' && (
                    <div className="image-upload-area">
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                        />
                        {uploadedImage ? (
                            <div className="uploaded-preview">
                                <img src={uploadedImage.preview} alt="Uploaded" />
                                <button
                                    className="btn-icon remove-image"
                                    onClick={() => setUploadedImage(null)}
                                >
                                    <VscClose size={16} />
                                </button>
                            </div>
                        ) : (
                            <button
                                className="upload-btn"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <VscCloudUpload size={32} />
                                <span>{t('playground.uploadImage') || 'Upload Image'}</span>
                            </button>
                        )}
                    </div>
                )}

                {/* Prompt Input */}
                <div className="prompt-input-area">
                    <textarea
                        className="prompt-input"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={t('playground.enterPrompt') || 'Describe the image you want to generate...'}
                        rows={3}
                    />
                    <button
                        className="generate-btn btn-primary"
                        onClick={handleGenerate}
                        disabled={isLoading || !prompt.trim() || (mode === 'img2img' && !uploadedImage)}
                    >
                        {isLoading ? (
                            <span className="loading-spinner"></span>
                        ) : (
                            t('playground.generate') || 'Generate'
                        )}
                    </button>
                </div>

                {/* Generated Image Preview */}
                {generatedImage && (
                    <div className="generated-image-area">
                        <div
                            className="image-preview clickable"
                            onClick={() => setShowViewer(true)}
                            title={t('playground.clickToView') || 'Click to zoom'}
                        >
                            <img
                                src={`data:image/png;base64,${generatedImage.data}`}
                                alt="Generated"
                            />
                        </div>
                        <div className="image-actions">
                            <button className="btn btn-secondary" onClick={handleSaveToGallery}>
                                <VscAdd size={14} />
                                {t('playground.saveToGallery') || 'Save to Gallery'}
                            </button>
                            <button className="btn btn-secondary" onClick={handleDownload}>
                                <VscDesktopDownload size={14} />
                                {t('playground.download') || 'Download'}
                            </button>
                            <button className="btn btn-secondary" onClick={handleEditImage}>
                                {t('playground.editImage') || 'Edit Image'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Loading State with Progress Bar */}
                {isLoading && (
                    <div className="generation-progress-container">
                        <div className="generation-progress-header">
                            <span className="loading-spinner"></span>
                            <span>{t('playground.generatingImage') || 'Generating image...'}</span>
                            <span className="progress-percent">{generationProgress}%</span>
                        </div>
                        <div className="progress-bar">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${generationProgress}%` }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Image Viewer Modal */}
            {generatedImage && (
                <ImageViewer
                    isOpen={showViewer}
                    onClose={() => setShowViewer(false)}
                    src={`data:image/png;base64,${generatedImage.data}`}
                    alt="Generated Image"
                />
            )}
        </div>
    );
};

export default ImagePlayground;
