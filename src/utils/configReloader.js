import config, { getConfigJson, buildConfig } from '../config/config.js';

/**
 * Reload configuration into the config object
 */
export function reloadConfig() {
  const newConfig = buildConfig(getConfigJson());
  Object.assign(config, newConfig);
}
