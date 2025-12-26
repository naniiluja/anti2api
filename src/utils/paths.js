/**
 * Path utility module
 * Unified path handling for pkg packaged environment and development environment
 * @module utils/paths
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Detect if running in pkg packaged environment
 * @type {boolean}
 */
export const isPkg = typeof process.pkg !== 'undefined';

/**
 * Get project root directory
 * @returns {string} Project root directory path
 */
export function getProjectRoot() {
  if (isPkg) {
    return path.dirname(process.execPath);
  }
  return path.join(__dirname, '../..');
}

/**
 * Get data directory path
 * In pkg environment, use executable's directory or current working directory
 * @returns {string} Data directory path
 */
export function getDataDir() {
  if (isPkg) {
    // pkg environment: prefer data directory next to executable
    const exeDir = path.dirname(process.execPath);
    const exeDataDir = path.join(exeDir, 'data');
    // Check if we can create files in that directory
    try {
      if (!fs.existsSync(exeDataDir)) {
        fs.mkdirSync(exeDataDir, { recursive: true });
      }
      return exeDataDir;
    } catch (e) {
      // If cannot create, try current working directory
      const cwdDataDir = path.join(process.cwd(), 'data');
      try {
        if (!fs.existsSync(cwdDataDir)) {
          fs.mkdirSync(cwdDataDir, { recursive: true });
        }
        return cwdDataDir;
      } catch (e2) {
        // Finally use user home directory
        const homeDataDir = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.antigravity', 'data');
        if (!fs.existsSync(homeDataDir)) {
          fs.mkdirSync(homeDataDir, { recursive: true });
        }
        return homeDataDir;
      }
    }
  }
  // Development environment
  return path.join(__dirname, '..', '..', 'data');
}

/**
 * Get public static files directory
 * @returns {string} public directory path
 */
export function getPublicDir() {
  if (isPkg) {
    // pkg environment: prefer public directory next to executable
    const exeDir = path.dirname(process.execPath);
    const exePublicDir = path.join(exeDir, 'public');
    if (fs.existsSync(exePublicDir)) {
      return exePublicDir;
    }
    // Then use current working directory's public
    const cwdPublicDir = path.join(process.cwd(), 'public');
    if (fs.existsSync(cwdPublicDir)) {
      return cwdPublicDir;
    }
    // Finally use bundled public directory (via snapshot)
    return path.join(__dirname, '../../public');
  }
  // Development environment
  return path.join(__dirname, '../../public');
}

/**
 * Get image storage directory
 * @returns {string} Image directory path
 */
export function getImageDir() {
  if (isPkg) {
    // pkg environment: prefer public/images directory next to executable
    const exeDir = path.dirname(process.execPath);
    const exeImageDir = path.join(exeDir, 'public', 'images');
    try {
      if (!fs.existsSync(exeImageDir)) {
        fs.mkdirSync(exeImageDir, { recursive: true });
      }
      return exeImageDir;
    } catch (e) {
      // If cannot create, try current working directory
      const cwdImageDir = path.join(process.cwd(), 'public', 'images');
      try {
        if (!fs.existsSync(cwdImageDir)) {
          fs.mkdirSync(cwdImageDir, { recursive: true });
        }
        return cwdImageDir;
      } catch (e2) {
        // Finally use user home directory
        const homeImageDir = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.antigravity', 'images');
        if (!fs.existsSync(homeImageDir)) {
          fs.mkdirSync(homeImageDir, { recursive: true });
        }
        return homeImageDir;
      }
    }
  }
  // Development environment
  return path.join(__dirname, '../../public/images');
}

/**
 * Get .env file path
 * @returns {string} .env file path
 */
export function getEnvPath() {
  if (isPkg) {
    // pkg environment: prefer .env next to executable
    const exeDir = path.dirname(process.execPath);
    const exeEnvPath = path.join(exeDir, '.env');
    if (fs.existsSync(exeEnvPath)) {
      return exeEnvPath;
    }
    // Then use current working directory's .env
    const cwdEnvPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(cwdEnvPath)) {
      return cwdEnvPath;
    }
    // Return executable directory path (even if doesn't exist)
    return exeEnvPath;
  }
  // Development environment
  return path.join(__dirname, '../../.env');
}

/**
 * Get configuration file paths collection
 * @returns {{envPath: string, configJsonPath: string, examplePath: string}} Configuration file paths
 */
export function getConfigPaths() {
  if (isPkg) {
    // pkg environment: prefer config files next to executable
    const exeDir = path.dirname(process.execPath);
    const cwdDir = process.cwd();

    // Find .env file
    let envPath = path.join(exeDir, '.env');
    if (!fs.existsSync(envPath)) {
      const cwdEnvPath = path.join(cwdDir, '.env');
      if (fs.existsSync(cwdEnvPath)) {
        envPath = cwdEnvPath;
      }
    }

    // Find config.json file
    let configJsonPath = path.join(exeDir, 'config.json');
    if (!fs.existsSync(configJsonPath)) {
      const cwdConfigPath = path.join(cwdDir, 'config.json');
      if (fs.existsSync(cwdConfigPath)) {
        configJsonPath = cwdConfigPath;
      }
    }

    // Find .env.example file
    let examplePath = path.join(exeDir, '.env.example');
    if (!fs.existsSync(examplePath)) {
      const cwdExamplePath = path.join(cwdDir, '.env.example');
      if (fs.existsSync(cwdExamplePath)) {
        examplePath = cwdExamplePath;
      }
    }

    return { envPath, configJsonPath, examplePath };
  }

  // Development environment
  return {
    envPath: path.join(__dirname, '../../.env'),
    configJsonPath: path.join(__dirname, '../../config.json'),
    examplePath: path.join(__dirname, '../../.env.example')
  };
}

/**
 * Calculate relative path for log display
 * @param {string} absolutePath - Absolute path
 * @returns {string} Relative path or original path
 */
export function getRelativePath(absolutePath) {
  if (isPkg) {
    const exeDir = path.dirname(process.execPath);
    if (absolutePath.startsWith(exeDir)) {
      return '.' + absolutePath.slice(exeDir.length).replace(/\\/g, '/');
    }
    const cwdDir = process.cwd();
    if (absolutePath.startsWith(cwdDir)) {
      return '.' + absolutePath.slice(cwdDir.length).replace(/\\/g, '/');
    }
  }
  return absolutePath;
}