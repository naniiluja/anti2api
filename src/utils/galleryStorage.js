/**
 * Gallery Storage
 * Manages image gallery in local filesystem
 * Images are stored as files in data/gallery/
 * Metadata is stored in data/gallery.json
 */

import fs from 'fs';
import path from 'path';
import { getDataDir } from './paths.js';
import logger from './logger.js';

const DATA_DIR = getDataDir();
const GALLERY_DIR = path.join(DATA_DIR, 'gallery');
const GALLERY_FILE = path.join(DATA_DIR, 'gallery.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(GALLERY_DIR)) {
    fs.mkdirSync(GALLERY_DIR, { recursive: true });
}

/**
 * Get all gallery images with their base64 data
 * @returns {Array} List of gallery images
 */
export function getGalleryImages() {
    try {
        if (!fs.existsSync(GALLERY_FILE)) {
            return [];
        }
        const metadata = JSON.parse(fs.readFileSync(GALLERY_FILE, 'utf-8'));

        // Load base64 data for each image
        return metadata.map(item => {
            const imagePath = path.join(GALLERY_DIR, `${item.id}.png`);
            if (fs.existsSync(imagePath)) {
                const data = fs.readFileSync(imagePath, 'base64');
                return { ...item, data };
            }
            return item;
        }).filter(item => item.data); // Only return items with valid data
    } catch (e) {
        logger.error('Failed to read gallery:', e.message);
        return [];
    }
}

/**
 * Add a new image to gallery
 * @param {Object} image - Image object with data, prompt, model
 * @returns {Object} Saved image with id
 */
export function addGalleryImage(image) {
    try {
        const id = Date.now().toString();
        const imagePath = path.join(GALLERY_DIR, `${id}.png`);

        // Save image file
        const imageData = image.data.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(imagePath, imageData, 'base64');

        // Save metadata
        const metadata = getGalleryMetadata();
        const newEntry = {
            id,
            prompt: image.prompt || '',
            model: image.model || '',
            createdAt: new Date().toISOString()
        };
        metadata.unshift(newEntry);

        // Keep only last 100 images
        const trimmedMetadata = metadata.slice(0, 100);
        saveGalleryMetadata(trimmedMetadata);

        // Clean up old image files
        if (metadata.length > 100) {
            const oldEntries = metadata.slice(100);
            oldEntries.forEach(entry => {
                const oldPath = path.join(GALLERY_DIR, `${entry.id}.png`);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            });
        }

        return { ...newEntry, data: image.data };
    } catch (e) {
        logger.error('Failed to save gallery image:', e.message);
        throw e;
    }
}

/**
 * Delete an image from gallery
 * @param {string} imageId - Image ID to delete
 * @returns {boolean} True if deleted
 */
export function deleteGalleryImage(imageId) {
    try {
        const metadata = getGalleryMetadata();
        const filtered = metadata.filter(item => item.id !== imageId);

        if (filtered.length !== metadata.length) {
            // Delete image file
            const imagePath = path.join(GALLERY_DIR, `${imageId}.png`);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
            saveGalleryMetadata(filtered);
            return true;
        }
        return false;
    } catch (e) {
        logger.error('Failed to delete gallery image:', e.message);
        return false;
    }
}

/**
 * Get gallery metadata only (without image data)
 * @returns {Array} Metadata list
 */
function getGalleryMetadata() {
    try {
        if (!fs.existsSync(GALLERY_FILE)) {
            return [];
        }
        return JSON.parse(fs.readFileSync(GALLERY_FILE, 'utf-8'));
    } catch (e) {
        return [];
    }
}

/**
 * Save gallery metadata
 * @param {Array} metadata - Metadata to save
 */
function saveGalleryMetadata(metadata) {
    fs.writeFileSync(GALLERY_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
}

export default {
    getGalleryImages,
    addGalleryImage,
    deleteGalleryImage
};
