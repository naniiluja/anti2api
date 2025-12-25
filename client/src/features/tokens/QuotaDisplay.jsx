import { useState, useEffect } from 'react';
import quotaService from './quotaService';
import { useI18n } from '../../context/I18nContext';

const QuotaDisplay = ({ refreshToken, isExpanded, onExpandToggle }) => {
    const { t } = useI18n();
    const [summary, setSummary] = useState(null);
    const [detail, setDetail] = useState(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [error, setError] = useState(null);

    // Initial Load - Summary
    useEffect(() => {
        let mounted = true;

        const loadSummary = async () => {
            setLoadingSummary(true);
            try {
                // Check cache logic here if needed, keeping it simple for now
                const res = await quotaService.getSummary(refreshToken);
                if (mounted && res.success && res.data) {
                    setSummary(res.data);
                } else if (mounted) {
                    setError('Failed to load');
                }
            } catch (err) {
                if (mounted) setError('Error');
            } finally {
                if (mounted) setLoadingSummary(false);
            }
        };

        loadSummary();
        return () => { mounted = false; };
    }, [refreshToken]);

    // Expand Load - Detail
    useEffect(() => {
        if (isExpanded && !detail && !loadingDetail) {
            loadDetail();
        }
    }, [isExpanded]);

    const loadDetail = async (forceRefresh = false) => {
        setLoadingDetail(true);
        try {
            const serviceCall = forceRefresh ? quotaService.refresh : quotaService.getSummary;
            const res = await serviceCall(refreshToken);
            if (res.success && res.data) {
                setDetail(res.data);
                if (forceRefresh) setSummary(res.data); // Update summary too
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleRefresh = (e) => {
        e.stopPropagation(); // Prevent toggling expand
        loadDetail(true);
    };

    // Helper to process data
    const getBestModel = (models) => {
        if (!models || Object.keys(models).length === 0) return null;
        let minModel = null;
        let minQuota = null;

        Object.entries(models).forEach(([id, quota]) => {
            if (!minQuota || quota.remaining < minQuota.remaining) {
                minQuota = quota;
                minModel = id;
            }
        });
        return { id: minModel, ...minQuota };
    };

    // Render Summary
    const renderSummary = () => {
        if (loadingSummary) return <span>📊 Loading...</span>;
        if (error) return <span className="quota-summary-error">📊 Error</span>;
        if (!summary || !summary.models) return <span>📊 No Quota</span>;

        const best = getBestModel(summary.models);
        if (!best) return <span>📊 No Quota</span>;

        const percentage = best.remaining * 100;
        const barColor = percentage > 50 ? '#10b981' : percentage > 20 ? '#f59e0b' : '#ef4444';
        const shortName = best.id.split('/').pop();

        return (
            <>
                <span className="quota-summary-icon">📊</span>
                <span className="quota-summary-model" title={best.id}>{shortName}</span>
                <span className="quota-summary-bar">
                    <span style={{ width: `${percentage}%`, background: barColor }}></span>
                </span>
                <span className="quota-summary-pct">{percentage.toFixed(2)}%</span>
            </>
        );
    };

    // Render Detail Rows
    const renderDetailGroup = (groupTitle, items, icon) => {
        if (!items || items.length === 0) return null;
        return (
            items.map((item) => {
                const percentage = item.quota.remaining * 100;
                const barColor = percentage > 50 ? '#10b981' : percentage > 20 ? '#f59e0b' : '#ef4444';
                const shortName = item.id.split('/').pop();

                return (
                    <div key={item.id} className="quota-detail-row" title={`${item.id} - Reset: ${item.quota.resetTime}`}>
                        <span className="quota-detail-icon">{icon}</span>
                        <span className="quota-detail-name">{shortName}</span>
                        <span className="quota-detail-bar">
                            <span style={{ width: `${percentage}%`, background: barColor }}></span>
                        </span>
                        <span className="quota-detail-pct">{percentage.toFixed(2)}%</span>
                    </div>
                );
            })
        );
    };

    const renderDetails = () => {
        if (loadingDetail && !detail) return <div className="quota-loading-small">Loading...</div>;
        if (!detail || !detail.models) return <div className="quota-empty-small">No Info</div>;

        const claude = [];
        const gemini = [];
        const other = [];

        Object.entries(detail.models).forEach(([id, quota]) => {
            const item = { id, quota };
            const lowerId = id.toLowerCase();
            if (lowerId.includes('claude')) claude.push(item);
            else if (lowerId.includes('gemini')) gemini.push(item);
            else other.push(item);
        });

        return (
            <div className="quota-detail-grid">
                {renderDetailGroup('Claude', claude, '🤖')}
                {renderDetailGroup('Gemini', gemini, '💎')}
                {renderDetailGroup('Other', other, '🔧')}
                <button className="btn btn-info btn-xs quota-refresh-btn" onClick={handleRefresh}>
                    🔄 {t('buttons.refreshQuota')}
                </button>
            </div>
        );
    };

    return (
        <div className="token-quota-inline">
            <div className="quota-inline-header" onClick={onExpandToggle}>
                <div className="quota-inline-summary">
                    {renderSummary()}
                </div>
                <span className={`quota-inline-toggle ${isExpanded ? 'expanded' : ''}`}>▼</span>
            </div>
            {isExpanded && (
                <div className="quota-inline-detail">
                    {renderDetails()}
                </div>
            )}
        </div>
    );
};

export default QuotaDisplay;
