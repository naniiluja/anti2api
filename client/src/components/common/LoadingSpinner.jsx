export const LoadingSpinner = ({ text }) => (
    <div className="loading-overlay">
        <div className="spinner"></div>
        {text && <div className="loading-text">{text}</div>}
    </div>
);
