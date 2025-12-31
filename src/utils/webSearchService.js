// Web Search Service using DuckDuckGo HTML scraping
// This approach is more reliable for avoiding rate limits
import logger from './logger.js';

// Retry configuration
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelayMs: 3000,
    maxDelayMs: 15000
};

// Random User-Agents to rotate
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Search using DuckDuckGo HTML (lite version, less likely to be rate limited)
 */
async function searchDDGHtml(query, maxResults = 5) {
    const { default: axios } = await import('axios');
    
    const url = 'https://html.duckduckgo.com/html/';
    const userAgent = getRandomUserAgent();
    
    const response = await axios.post(url, `q=${encodeURIComponent(query)}`, {
        headers: {
            'User-Agent': userAgent,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8'
        },
        timeout: 10000
    });

    const html = response.data;
    const results = [];
    
    // Parse results using regex (simple HTML parsing)
    const resultRegex = /<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([^<]*(?:<b>[^<]*<\/b>[^<]*)*)<\/a>/g;
    
    let match;
    while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
        const url = match[1];
        const title = match[2].trim();
        const description = match[3].replace(/<\/?b>/g, '').trim();
        
        // Skip DuckDuckGo internal links
        if (!url.startsWith('//duckduckgo.com') && url.startsWith('http')) {
            results.push({ title, url, description });
        }
    }

    // Fallback: try alternative regex if no results
    if (results.length === 0) {
        const altRegex = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<a class="result__a"[^>]*>([^<]+)<\/a>/g;
        while ((match = altRegex.exec(html)) !== null && results.length < maxResults) {
            results.push({
                title: match[2].trim(),
                url: match[1],
                description: ''
            });
        }
    }

    return results;
}

/**
 * Search the web using DuckDuckGo with retry logic
 */
export async function webSearch(query, options = {}) {
    const { maxResults = 5 } = options;
    let lastError;
    
    for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
            logger.info(`Web search attempt ${attempt}: "${query}"`);
            
            // Add random delay before each attempt (except first)
            if (attempt > 1) {
                const delay = Math.min(
                    RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000,
                    RETRY_CONFIG.maxDelayMs
                );
                logger.info(`Waiting ${Math.round(delay)}ms before retry...`);
                await sleep(delay);
            }

            const results = await searchDDGHtml(query, maxResults);
            
            if (results.length > 0) {
                logger.info(`Web search returned ${results.length} results`);
                return results;
            } else {
                throw new Error('No results found');
            }
        } catch (error) {
            lastError = error;
            logger.warn(`Web search attempt ${attempt} failed: ${error.message}`);
            
            if (attempt >= RETRY_CONFIG.maxRetries) break;
        }
    }

    logger.error('Web search failed after all retries:', lastError?.message);
    throw lastError || new Error('Web search failed');
}

/**
 * Format search results for AI context injection
 */
export function formatSearchResultsForContext(results) {
    if (!results || results.length === 0) {
        return 'No search results found.';
    }

    return results.map((r, i) => 
        `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.description}`
    ).join('\n\n');
}

export default { webSearch, formatSearchResultsForContext };
