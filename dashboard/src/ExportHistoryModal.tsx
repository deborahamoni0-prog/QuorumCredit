import React, { useState } from 'react';
import './ExportHistoryModal.css';

interface ExportHistoryModalProps {
  isOpen: boolean;
  voucherAddress: string;
  onClose: () => void;
}

interface ExportOptions {
  format: 'csv' | 'json';
  startDate: string;
  endDate: string;
  transactionTypes: string[];
  offset: number;
  limit: number;
}

const TRANSACTION_TYPES = [
  { value: 'vouch', label: 'Vouch' },
  { value: 'increase_stake', label: 'Increase Stake' },
  { value: 'decrease_stake', label: 'Decrease Stake' },
  { value: 'withdraw_vouch', label: 'Withdraw Vouch' },
  { value: 'slash', label: 'Slash' },
  { value: 'yield_earned', label: 'Yield Earned' },
];

export const ExportHistoryModal: React.FC<ExportHistoryModalProps> = ({
  isOpen,
  voucherAddress,
  onClose,
}) => {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'csv',
    startDate: '',
    endDate: '',
    transactionTypes: [],
    offset: 0,
    limit: 100,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFormatChange = (format: 'csv' | 'json') => {
    setOptions({ ...options, format });
  };

  const handleDateChange = (
    type: 'startDate' | 'endDate',
    value: string
  ) => {
    setOptions({ ...options, [type]: value });
  };

  const handleTransactionTypeToggle = (type: string) => {
    const types = options.transactionTypes.includes(type)
      ? options.transactionTypes.filter(t => t !== type)
      : [...options.transactionTypes, type];
    setOptions({ ...options, transactionTypes: types });
  };

  const buildQueryParams = (): URLSearchParams => {
    const params = new URLSearchParams();
    
    params.append('format', options.format);
    
    if (options.startDate) {
      const startTs = Math.floor(new Date(options.startDate).getTime() / 1000);
      params.append('start_date', startTs.toString());
    }
    
    if (options.endDate) {
      const endTs = Math.floor(new Date(options.endDate).getTime() / 1000);
      params.append('end_date', endTs.toString());
    }
    
    if (options.transactionTypes.length > 0) {
      params.append('transaction_types', options.transactionTypes.join(','));
    }
    
    params.append('offset', options.offset.toString());
    params.append('limit', options.limit.toString());
    
    return params;
  };

  const handleExport = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const queryParams = buildQueryParams();
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        throw new Error('Authentication token not found. Please log in.');
      }

      const response = await fetch(
        `/api/voucher/${voucherAddress}/history/export?${queryParams}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Unauthorized: Can only export your own voucher history');
        } else if (response.status === 401) {
          throw new Error('Unauthorized: Please log in');
        } else {
          throw new Error(`API error: ${response.status}`);
        }
      }

      // Get filename from Content-Disposition header or generate default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `voucher_history_${voucherAddress}.${options.format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      // Handle different content types
      const contentType = response.headers.get('content-type');
      let blob: Blob;

      if (options.format === 'csv' || contentType?.includes('text/csv')) {
        const text = await response.text();
        blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
      } else {
        blob = new Blob([await response.text()], { type: 'application/json' });
      }

      // Trigger download
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Close modal after successful export
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export history';
      setError(message);
      console.error('Export error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Export Voucher History</h2>
          <button className="close-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Format Selection */}
          <div className="form-group">
            <label className="form-label">Export Format</label>
            <div className="format-options">
              <label className="radio-option">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={options.format === 'csv'}
                  onChange={() => handleFormatChange('csv')}
                  disabled={isLoading}
                />
                <span className="radio-label">CSV (spreadsheet)</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={options.format === 'json'}
                  onChange={() => handleFormatChange('json')}
                  disabled={isLoading}
                />
                <span className="radio-label">JSON (data)</span>
              </label>
            </div>
          </div>

          {/* Date Range */}
          <div className="form-group date-range">
            <label className="form-label">Date Range (Optional)</label>
            <div className="date-inputs">
              <div className="date-input-group">
                <label htmlFor="start-date">Start Date</label>
                <input
                  id="start-date"
                  type="datetime-local"
                  value={options.startDate}
                  onChange={e => handleDateChange('startDate', e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="date-input-group">
                <label htmlFor="end-date">End Date</label>
                <input
                  id="end-date"
                  type="datetime-local"
                  value={options.endDate}
                  onChange={e => handleDateChange('endDate', e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {/* Transaction Type Filters */}
          <div className="form-group">
            <label className="form-label">Transaction Types (Optional)</label>
            <div className="checkbox-group">
              {TRANSACTION_TYPES.map(type => (
                <label key={type.value} className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={options.transactionTypes.includes(type.value)}
                    onChange={() => handleTransactionTypeToggle(type.value)}
                    disabled={isLoading}
                  />
                  <span className="checkbox-label">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Pagination Settings */}
          <div className="form-group pagination-settings">
            <label className="form-label">Pagination</label>
            <div className="pagination-inputs">
              <div className="pagination-input-group">
                <label htmlFor="offset">Offset</label>
                <input
                  id="offset"
                  type="number"
                  min="0"
                  value={options.offset}
                  onChange={e => setOptions({ ...options, offset: parseInt(e.target.value, 10) })}
                  disabled={isLoading}
                />
              </div>
              <div className="pagination-input-group">
                <label htmlFor="limit">Limit (max 1000)</label>
                <input
                  id="limit"
                  type="number"
                  min="1"
                  max="1000"
                  value={options.limit}
                  onChange={e => setOptions({ ...options, limit: parseInt(e.target.value, 10) })}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {/* Info Message */}
          <div className="info-message">
            <span className="info-icon">ℹ️</span>
            <span>
              Exporting {options.format.toUpperCase()} format with {options.limit} records starting at offset {options.offset}
            </span>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="button button-secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            onClick={handleExport}
            disabled={isLoading}
          >
            {isLoading ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportHistoryModal;
