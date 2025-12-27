import { useState, useEffect, useMemo } from 'react';
import { VscRefresh, VscGraph, VscPulse, VscCheck, VscSymbolMethod } from 'react-icons/vsc';
import dashboardService from './dashboardService';
import { BentoCard, BentoGrid } from '../../components/ui/MagicBento';
import CountUp from '../../components/ui/CountUp';
import { useI18n } from '../../context/I18nContext';
import { useToast } from '../../context/ToastContext';

// Chart Colors
const CHART_COLORS = [
    '#6366f1', // accent
    '#22c55e', // success
    '#f59e0b', // warning
    '#ef4444', // danger
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#84cc16', // lime
];

// Bar Chart Component
const BarChart = ({ data, maxValue }) => {
    const currentHour = new Date().getHours();

    return (
        <div className="bar-chart">
            <div className="bar-chart-bars">
                {data.map((item, index) => {
                    const totalTokens = item.inputTokens + item.outputTokens;
                    const heightPercent = maxValue > 0 ? (totalTokens / maxValue) * 100 : 0;
                    const inputPercent = totalTokens > 0 ? (item.inputTokens / totalTokens) * 100 : 0;

                    return (
                        <div
                            key={index}
                            className={`bar-wrapper ${index === currentHour ? 'current' : ''}`}
                            title={`${item.hour}:00 - Input: ${item.inputTokens.toLocaleString()}, Output: ${item.outputTokens.toLocaleString()}`}
                        >
                            <div
                                className="bar"
                                style={{ height: `${Math.max(heightPercent, totalTokens > 0 ? 5 : 0)}%` }}
                            >
                                <div
                                    className="bar-input"
                                    style={{ height: `${inputPercent}%` }}
                                />
                            </div>
                            {index % 4 === 0 && (
                                <span className="bar-label">{item.hour}</span>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="bar-legend">
                <span className="legend-item"><span className="legend-color input"></span> Input</span>
                <span className="legend-item"><span className="legend-color output"></span> Output</span>
            </div>
        </div>
    );
};

// Pie Chart Component
const PieChart = ({ data }) => {
    const total = data.reduce((sum, item) => sum + item.calls, 0);

    if (total === 0) {
        return (
            <div className="pie-chart-empty">
                <VscSymbolMethod size={32} />
                <span>No API calls today</span>
            </div>
        );
    }

    // Calculate pie segments
    let cumulativePercent = 0;
    const segments = data.slice(0, 8).map((item, index) => {
        const percent = (item.calls / total) * 100;
        const startAngle = cumulativePercent * 3.6; // 360 / 100
        cumulativePercent += percent;
        const endAngle = cumulativePercent * 3.6;

        return {
            ...item,
            percent,
            startAngle,
            endAngle,
            color: CHART_COLORS[index % CHART_COLORS.length]
        };
    });

    // Create SVG path for each segment
    const createArcPath = (startAngle, endAngle, radius = 80) => {
        const startRad = (startAngle - 90) * Math.PI / 180;
        const endRad = (endAngle - 90) * Math.PI / 180;

        const x1 = 100 + radius * Math.cos(startRad);
        const y1 = 100 + radius * Math.sin(startRad);
        const x2 = 100 + radius * Math.cos(endRad);
        const y2 = 100 + radius * Math.sin(endRad);

        const largeArc = endAngle - startAngle > 180 ? 1 : 0;

        return `M 100 100 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    };

    return (
        <div className="pie-chart">
            <svg viewBox="0 0 200 200" className="pie-svg">
                {segments.map((seg, index) => (
                    <path
                        key={index}
                        d={createArcPath(seg.startAngle, seg.endAngle)}
                        fill={seg.color}
                        className="pie-segment"
                    >
                        <title>{seg.model}: {seg.calls} calls ({seg.percent.toFixed(1)}%)</title>
                    </path>
                ))}
                <circle cx="100" cy="100" r="40" className="pie-center" />
            </svg>
            <div className="pie-legend">
                {segments.map((seg, index) => (
                    <div key={index} className="pie-legend-item">
                        <span className="pie-legend-color" style={{ background: seg.color }}></span>
                        <span className="pie-legend-label">{seg.model}</span>
                        <span className="pie-legend-value">{seg.calls}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Stat Card Component
const StatCard = ({ icon, label, value, suffix = '', color = 'default' }) => (
    <BentoCard className={`stat-card stat-card--${color}`}>
        <div className="stat-card-icon">{icon}</div>
        <div className="stat-card-content">
            <div className="stat-card-value">
                <CountUp from={0} to={value} separator="," duration={1} />
                {suffix && <span className="stat-card-suffix">{suffix}</span>}
            </div>
            <div className="stat-card-label">{label}</div>
        </div>
    </BentoCard>
);

const DashboardPage = () => {
    const { t } = useI18n();
    const { showToast } = useToast();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadDashboard = async () => {
        setLoading(true);
        try {
            const res = await dashboardService.getDashboardData();
            if (res.success && res.data) {
                setData(res.data);
            }
        } catch (err) {
            showToast('Failed to load dashboard', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDashboard();

        // Auto-refresh every 30 seconds
        const interval = setInterval(loadDashboard, 30000);
        return () => clearInterval(interval);
    }, []);

    const maxTokenValue = useMemo(() => {
        if (!data?.hourlyUsage) return 0;
        return Math.max(...data.hourlyUsage.map(h => h.inputTokens + h.outputTokens));
    }, [data]);

    return (
        <div id="dashboardPage">
            <div className="top-bar">
                <div className="dashboard-title">
                    <VscGraph size={20} />
                    <h2>{t('dashboard.title') || 'Dashboard'}</h2>
                    {data && <span className="dashboard-date">{data.date}</span>}
                </div>
                <div className="action-btns">
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={loadDashboard}
                        disabled={loading}
                    >
                        <VscRefresh size={14} className={loading ? 'spinning' : ''} />
                        {t('buttons.refresh') || 'Refresh'}
                    </button>
                </div>
            </div>

            {loading && !data ? (
                <div className="empty-state"><div className="spinner"></div></div>
            ) : data ? (
                <div className="dashboard-content">
                    {/* Summary Stats */}
                    <BentoGrid className="dashboard-stats-grid" enableSpotlight={true}>
                        <StatCard
                            icon={<VscSymbolMethod size={24} />}
                            label={t('dashboard.totalRequests') || 'Total Requests'}
                            value={data.summary.totalRequests}
                            color="default"
                        />
                        <StatCard
                            icon={<VscPulse size={24} />}
                            label={t('dashboard.totalTokens') || 'Total Tokens'}
                            value={data.summary.totalTokens}
                            color="accent"
                        />
                        <StatCard
                            icon={<VscCheck size={24} />}
                            label={t('dashboard.successRate') || 'Success Rate'}
                            value={data.summary.successRate}
                            suffix="%"
                            color="success"
                        />
                        <StatCard
                            icon={<VscGraph size={24} />}
                            label={t('dashboard.avgDuration') || 'Avg Duration'}
                            value={data.summary.avgDuration}
                            suffix="ms"
                            color="warning"
                        />
                    </BentoGrid>

                    {/* Charts */}
                    <div className="dashboard-charts">
                        <BentoCard className="chart-card chart-card--wide">
                            <div className="chart-header">
                                <h3>{t('dashboard.hourlyUsage') || 'Hourly Token Usage'}</h3>
                            </div>
                            <BarChart data={data.hourlyUsage} maxValue={maxTokenValue} />
                        </BentoCard>

                        <BentoCard className="chart-card">
                            <div className="chart-header">
                                <h3>{t('dashboard.modelDistribution') || 'API Calls by Model'}</h3>
                            </div>
                            <PieChart data={data.modelBreakdown} />
                        </BentoCard>
                    </div>
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-state-text">{t('dashboard.noData') || 'No data available'}</div>
                </div>
            )}
        </div>
    );
};

export default DashboardPage;
