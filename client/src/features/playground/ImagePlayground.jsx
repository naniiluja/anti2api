import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../../context/I18nContext';
import { useToast } from '../../context/ToastContext';
import { VscAdd, VscTrash, VscDesktopDownload, VscClose, VscCloudUpload } from 'react-icons/vsc';
import ImageGallery from './ImageGallery';
import ImageViewer from './ImageViewer';
import { getImageModels, generateImage, transformImage, improveImagePrompt } from './playgroundService';
import { addGalleryImage, getGalleryImages, deleteGalleryImage } from './storageService';
import { addHistory } from '../history/historyService';

const IMAGE_SIZES = [
    { label: '512×512', model: 'gemini-3-pro-image', size: '512' },
    { label: '1024×1024', model: 'gemini-3-pro-image', size: '1024' },
    { label: '2K', model: 'gemini-3-pro-image-2K', size: '2k' },
    { label: '4K', model: 'gemini-3-pro-image-4K', size: '4k' }
];

// Gemini 3 Pro Image supports up to 14 reference images
const MAX_IMAGES = 14;

const ImagePlayground = () => {
    const { t } = useI18n();
    const { showToast } = useToast();
    const [mode, setMode] = useState('txt2img'); // 'txt2img' | 'img2img'
    const [prompt, setPrompt] = useState('');
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('');
    // Changed from single uploadedImage to array of uploadedImages
    const [uploadedImages, setUploadedImages] = useState([]);
    const [generatedImage, setGeneratedImage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [gallery, setGallery] = useState([]);
    const [showGallery, setShowGallery] = useState(true);
    const [showViewer, setShowViewer] = useState(false);
    const [generationQueue, setGenerationQueue] = useState([]); // Background queue
    const [generationProgress, setGenerationProgress] = useState(0);
    const [isImproving, setIsImproving] = useState(false);
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
                console.error('Failed to load models:', err);
            }
            // Load gallery images from server
            try {
                const galleryImages = await getGalleryImages();
                setGallery(galleryImages);
            } catch (err) {
                console.error('Failed to load gallery:', err);
            }
        };
        loadData();
    }, []);

    // Handle file upload - now supports multiple files
    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const remainingSlots = MAX_IMAGES - uploadedImages.length;
        const filesToProcess = files.slice(0, remainingSlots);

        filesToProcess.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result.split(',')[1];
                const newImage = {
                    id: Date.now() + index + Math.random(),
                    file,
                    base64,
                    preview: event.target.result
                };
                setUploadedImages(prev => {
                    if (prev.length >= MAX_IMAGES) return prev;
                    return [...prev, newImage];
                });
            };
            reader.readAsDataURL(file);
        });

        // Reset file input to allow selecting same file again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Remove a specific image by id
    const handleRemoveImage = (imageId) => {
        setUploadedImages(prev => prev.filter(img => img.id !== imageId));
    };

    // Build enhanced prompt with image labels
    const buildEnhancedPrompt = (originalPrompt, imageCount) => {
        if (imageCount === 0) return originalPrompt;

        const imageLabels = Array.from({ length: imageCount }, (_, i) => `Image ${i + 1}`).join(', ');
        return `[Reference images provided: ${imageLabels}]\n\nUser request: ${originalPrompt}`;
    };

    const handleGenerate = async () => {
        if (!prompt.trim() || !selectedModel) return;
        if (mode === 'img2img' && uploadedImages.length === 0) {
            setError(t('playground.uploadRequired') || 'Please upload at least one image');
            return;
        }

        // Create generation task
        const taskId = Date.now();
        // Get base64 data from all uploaded images in order
        const uploadedBase64Array = uploadedImages.map(img => img.base64);
        // Build enhanced prompt with image labels
        const enhancedPrompt = mode === 'img2img'
            ? buildEnhancedPrompt(prompt.trim(), uploadedImages.length)
            : prompt.trim();

        const task = {
            id: taskId,
            prompt: enhancedPrompt,
            model: selectedModel,
            mode,
            uploadedBase64Array,
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
                result = await transformImage(task.prompt, task.uploadedBase64Array, task.model);
            }

            clearInterval(progressInterval);
            setGenerationProgress(100);

            if (result.images && result.images.length > 0) {
                const newImage = {
                    data: result.images[0],
                    prompt: prompt.trim(), // Store original prompt, not enhanced
                    model: task.model
                };
                setGeneratedImage(newImage);

                // Auto-save to gallery (async)
                const saved = await addGalleryImage(newImage);
                if (saved) {
                    setGallery(prev => [saved, ...prev.slice(0, 99)]);
                }

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

    const handleSaveToGallery = async () => {
        if (generatedImage) {
            const saved = await addGalleryImage(generatedImage);
            if (saved) {
                setGallery([saved, ...gallery.slice(0, 99)]);
            }
        }
    };

    const handleDeleteFromGallery = async (imageId) => {
        const deleted = await deleteGalleryImage(imageId);
        if (deleted) {
            setGallery(gallery.filter(img => img.id !== imageId));
        }
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
            // Add generated image to uploaded images array
            const newImage = {
                id: Date.now(),
                base64: generatedImage.data,
                preview: `data:image/png;base64,${generatedImage.data}`
            };
            setUploadedImages([newImage]);
        }
    };

    const handleImprovePrompt = async () => {
        if (!prompt.trim() || isImproving || isLoading) return;
        setIsImproving(true);
        try {
            const improved = await improveImagePrompt(prompt);
            setPrompt(improved);
        } catch (error) {
            console.error('Failed to improve prompt:', error);
            showToast('Failed to improve prompt', 'error');
        } finally {
            setIsImproving(false);
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

                {/* Image Upload for img2img - Now supports multiple images */}
                {mode === 'img2img' && (
                    <div className="multi-image-upload-area">
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            multiple
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                        />

                        <div className="upload-header">
                            <span className="upload-title">
                                {t('playground.referenceImages') || 'Reference Images'}
                                <span className="image-count">({uploadedImages.length}/{MAX_IMAGES})</span>
                            </span>
                            <span className="upload-hint">
                                {t('playground.multiImageHint') || 'Use "Image 1", "Image 2" in your prompt to reference specific images'}
                            </span>
                        </div>

                        <div className="multi-image-grid">
                            {/* Display uploaded images with labels */}
                            {uploadedImages.map((img, index) => (
                                <div key={img.id} className="uploaded-image-item">
                                    <img src={img.preview} alt={`Image ${index + 1}`} />
                                    <span className="image-label-badge">
                                        {t('playground.image') || 'Image'} {index + 1}
                                    </span>
                                    <button
                                        className="btn-icon remove-image-btn"
                                        onClick={() => handleRemoveImage(img.id)}
                                        title={t('playground.removeImage') || 'Remove image'}
                                    >
                                        <VscClose size={14} />
                                    </button>
                                </div>
                            ))}

                            {/* Add image button - only show if under max limit */}
                            {uploadedImages.length < MAX_IMAGES && (
                                <button
                                    className="add-image-btn"
                                    onClick={() => fileInputRef.current?.click()}
                                    title={t('playground.addImage') || 'Add image'}
                                >
                                    <VscCloudUpload size={24} />
                                    <span>{t('playground.addImage') || 'Add Image'}</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Prompt Input */}
                <div className="prompt-input-area">
                    <div className="prompt-input-wrapper">
                        <textarea
                            className="prompt-input"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={
                                mode === 'img2img'
                                    ? (t('playground.multiImagePromptPlaceholder') || 'Describe your edit... e.g. "Put the hat from Image 1 onto the person in Image 2"')
                                    : (t('playground.enterPrompt') || 'Describe the image you want to generate...')
                            }
                            rows={3}
                        />
                        <button
                            className="improve-prompt-btn image-improve-btn"
                            onClick={handleImprovePrompt}
                            disabled={!prompt.trim() || isImproving || isLoading}
                            title={t('playground.improvePrompt') || 'Improve prompt'}
                        >
                            {isImproving ? (
                                <span className="improve-spinner"></span>
                            ) : (
                                <span className="improve-icon">✨</span>
                            )}
                        </button>
                    </div>
                    <button
                        className="generate-btn btn-primary"
                        onClick={handleGenerate}
                        disabled={isLoading || !prompt.trim() || (mode === 'img2img' && uploadedImages.length === 0)}
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
