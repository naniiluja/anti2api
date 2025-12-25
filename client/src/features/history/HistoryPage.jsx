import { useState, useEffect } from 'react';
import { VscRefresh, VscTrash, VscError, VscCheck, VscClose } from 'react-icons/vsc';
import historyService from './historyService';
import { useI18n } from '../../context/I18nContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import Modal from '../../components/common/Modal';

const HistoryPage = () => {
    const { t } = useI18n();
    const { showToast } = useToast();
    const { confirm } = useConfirm();

    const [history, setHistory] = useState([]);
    const [stats, setStats] = useState({ total: 0, success: 0, error: 0, avgDuration: 0 });
    const [loading, setLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const res = await historyService.getHistory();
            if (res.success && res.data) {
                setHistory(res.data.history || []);
                setStats(res.data.stats || { total: 0, success: 0, error: 0, avgDuration: 0 });
            }
        } catch (err) {
            showToast('Failed to load history', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleClear = async () => {
        const ok = await confirm('Clear all history?', 'Confirm');
        if (!ok) return;

        try {
            await historyService.clearHistory();
            setHistory([]);
            setStats({ total: 0, success: 0, error: 0, avgDuration: 0 });
            showToast('History cleared', 'success');
        } catch (err) {
            showToast('Failed to clear history', 'error');
        }
    };

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const formatDuration = (ms) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    return (
        <div id="historyPage">
            <div className="top-bar">
                <div className="stats-inline">
                    <div className="stat-item">
                        <span className="stat-num">{stats.total}</span>
                        <span className="stat-text">Total</span>
                    </div>
                    <div className="stat-item success">
                        <span className="stat-num">{stats.success}</span>
                        <span className="stat-text">Success</span>
                    </div>
                    <div className="stat-item error">
                        <span className="stat-num">{stats.error}</span>
                        <span className="stat-text">Error</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-num">{formatDuration(stats.avgDuration)}</span>
                        <span className="stat-text">Avg</span>
                    </div>
                </div>
                <div className="action-btns">
                    <button className="btn btn-secondary btn-sm" onClick={loadHistory} disabled={loading}>
                        <VscRefresh size={14} className={loading ? 'spinning' : ''} />
                        Refresh
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={handleClear} disabled={history.length === 0}>
                        <VscTrash size={14} />
                        Clear
                    </button>
                </div>
            </div>

            <div className="history-table-wrapper">
                {loading && history.length === 0 ? (
                    <div className="empty-state"><div className="spinner"></div></div>
                ) : history.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-text">No API history yet</div>
                    </div>
                ) : (
                    <table className="history-table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Model</th>
                                <th>Token</th>
                                <th>Status</th>
                                <th>Duration</th>
                                <th>Tokens</th>
                                <th>Error</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((item) => (
                                <tr
                                    key={item.id}
                                    className={item.status === 'error' ? 'error-row' : ''}
                                    onClick={() => item.errorMessage && setSelectedItem(item)}
                                    style={{ cursor: item.errorMessage ? 'pointer' : 'default' }}
                                >
                                    <td>{formatTime(item.timestamp)}</td>
                                    <td className="model-cell" title={item.model}>
                                        {item.model?.split('/').pop() || item.model}
                                    </td>
                                    <td className="token-cell">{item.tokenId || '-'}</td>
                                    <td>
                                        {item.status === 'success' ? (
                                            <span className="status-badge success"><VscCheck size={12} /> OK</span>
                                        ) : (
                                            <span className="status-badge error"><VscError size={12} /> {item.statusCode}</span>
                                        )}
                                    </td>
                                    <td>{formatDuration(item.duration)}</td>
                                    <td>
                                        {item.inputTokens > 0 || item.outputTokens > 0
                                            ? `${item.inputTokens}/${item.outputTokens}`
                                            : '-'
                                        }
                                    </td>
                                    <td className="error-cell" title={item.errorMessage}>
                                        {item.errorMessage ? item.errorMessage.substring(0, 30) + '...' : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {selectedItem && (
                <Modal
                    isOpen={true}
                    onClose={() => setSelectedItem(null)}
                    title="Error Details"
                    actions={
                        <button className="btn btn-secondary" onClick={() => setSelectedItem(null)}>
                            Close
                        </button>
                    }
                >
                    <div className="error-detail">
                        <div className="error-detail-row">
                            <strong>Model:</strong> {selectedItem.model}
                        </div>
                        <div className="error-detail-row">
                            <strong>Status:</strong> {selectedItem.statusCode}
                        </div>
                        <div className="error-detail-row">
                            <strong>Time:</strong> {formatTime(selectedItem.timestamp)}
                        </div>
                        <div className="error-detail-row">
                            <strong>Error:</strong>
                            <pre className="error-message">{selectedItem.errorMessage}</pre>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default HistoryPage;
