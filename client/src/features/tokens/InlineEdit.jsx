import { useState, useRef, useEffect } from 'react';
import { VscEdit, VscCheck, VscClose } from 'react-icons/vsc';

const InlineEdit = ({ value, onSave, label, type = 'text', placeholder }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (editValue !== value) {
            onSave(editValue);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditValue(value);
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') handleCancel();
    };

    if (isEditing) {
        return (
            <div className="inline-edit-container">
                <span className="info-label">{label}</span>
                <input
                    ref={inputRef}
                    type={type}
                    className="inline-edit-input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    onClick={(e) => e.stopPropagation()}
                />
                <button className="btn-icon" onClick={handleSave} title="Save">
                    <VscCheck size={14} />
                </button>
                <button className="btn-icon" onClick={handleCancel} title="Cancel">
                    <VscClose size={14} />
                </button>
            </div>
        );
    }

    return (
        <div
            className="info-row editable"
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            title="Click to edit"
        >
            <span className="info-label">{label}</span>
            <span className="info-value">{value || placeholder || 'Not set'}</span>
            <button className="btn-icon edit-trigger">
                <VscEdit size={12} />
            </button>
        </div>
    );
};

export default InlineEdit;
