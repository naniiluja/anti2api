// Tool name mapping cache: by sessionId + model + safeName dimension
// Problem: tool names must be sanitized when sending upstream, need to restore to original name on return

import memoryManager, { MemoryPressure } from './memoryManager.js';

// safeKey: `${sessionId}::${model}::${safeName}` -> { originalName, ts }
const toolNameMap = new Map();

const MAX_ENTRIES = 512;
const ENTRY_TTL_MS = 30 * 60 * 1000;      // 30 minutes
const CLEAN_INTERVAL_MS = 10 * 60 * 1000; // Clean every 10 minutes

function makeKey(sessionId, model, safeName) {
  return `${sessionId || ''}::${model || ''}::${safeName || ''}`;
}

function pruneSize(targetSize) {
  if (toolNameMap.size <= targetSize) return;
  const removeCount = toolNameMap.size - targetSize;
  let removed = 0;
  for (const key of toolNameMap.keys()) {
    toolNameMap.delete(key);
    removed++;
    if (removed >= removeCount) break;
  }
}

function pruneExpired(now) {
  for (const [key, entry] of toolNameMap.entries()) {
    if (!entry || typeof entry.ts !== 'number') continue;
    if (now - entry.ts > ENTRY_TTL_MS) {
      toolNameMap.delete(key);
    }
  }
}

// Shrink cache based on memory pressure
memoryManager.registerCleanup((pressure) => {
  if (pressure === MemoryPressure.MEDIUM) {
    pruneSize(Math.floor(MAX_ENTRIES / 2));
  } else if (pressure === MemoryPressure.HIGH) {
    pruneSize(Math.floor(MAX_ENTRIES / 4));
  } else if (pressure === MemoryPressure.CRITICAL) {
    toolNameMap.clear();
  }
});

// Periodic cleanup by TTL
setInterval(() => {
  const now = Date.now();
  pruneExpired(now);
}).unref?.();

export function setToolNameMapping(sessionId, model, safeName, originalName) {
  if (!safeName || !originalName || safeName === originalName) return;
  const key = makeKey(sessionId, model, safeName);
  toolNameMap.set(key, { originalName, ts: Date.now() });
  pruneSize(MAX_ENTRIES);
}

export function getOriginalToolName(sessionId, model, safeName) {
  if (!safeName) return null;
  const key = makeKey(sessionId, model, safeName);
  const entry = toolNameMap.get(key);
  if (!entry) return null;
  const now = Date.now();
  if (typeof entry.ts === 'number' && now - entry.ts > ENTRY_TTL_MS) {
    toolNameMap.delete(key);
    return null;
  }
  return entry.originalName || null;
}

export function clearToolNameMappings() {
  toolNameMap.clear();
}
