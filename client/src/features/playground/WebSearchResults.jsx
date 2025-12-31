import { useState } from 'react';
import { VscChevronDown, VscChevronUp, VscGlobe } from 'react-icons/vsc';
import ShinyText from '../../components/common/ShinyText';

const extractDomain = (url) => {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return '';
    }
};

const getFaviconUrl = (url) => {
    const domain = extractDomain(url);
    return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=16` : null;
};

const WebSearchResults = ({ query, results, isSearching = false }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    // Show loading state when searching
    if (isSearching) {
        return (
            <div className="web-search-results searching">
                <div className="web-search-header">
                    <div className="web-search-query">
                        <span className="search-spinner-icon">🔄</span>
                        <ShinyText
                            text={query ? `Đang tìm kiếm: ${query}` : 'Đang tìm kiếm web...'}
                            speed={2}
                        />
                    </div>
                </div>
            </div>
        );
    }

    if (!results || results.length === 0) return null;

    return (
        <div className="web-search-results">
            <div
                className="web-search-header"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="web-search-query">
                    <VscGlobe size={14} />
                    <span className="query-text">{query}</span>
                </div>
                <div className="web-search-meta">
                    <span className="results-count">{results.length} results</span>
                    {isExpanded ? <VscChevronUp size={14} /> : <VscChevronDown size={14} />}
                </div>
            </div>

            {isExpanded && (
                <div className="web-search-list">
                    {results.map((result, index) => {
                        const domain = extractDomain(result.url);
                        const faviconUrl = getFaviconUrl(result.url);

                        return (
                            <a
                                key={index}
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="web-search-item"
                            >
                                <div className="search-item-favicon">
                                    {faviconUrl ? (
                                        <img
                                            src={faviconUrl}
                                            alt=""
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'flex';
                                            }}
                                        />
                                    ) : null}
                                    <VscGlobe
                                        size={14}
                                        style={{ display: faviconUrl ? 'none' : 'flex' }}
                                    />
                                </div>
                                <span className="search-item-title">{result.title}</span>
                                <span className="search-item-domain">{domain}</span>
                            </a>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default WebSearchResults;
