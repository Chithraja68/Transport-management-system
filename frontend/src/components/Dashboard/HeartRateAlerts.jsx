import React, { useState, useEffect } from 'react';
import {
  Heart, Search, Filter, RefreshCw, X, Info, CheckCircle,
  Clock, User, Phone, AlertTriangle, Activity, FileText
} from 'lucide-react';
import { heartRateAPI } from '../../services/api';

/* ─── inline styles (no extra CSS file needed) ─────────────────────────── */
const S = {
  container: {
    padding: '24px',
    fontFamily: 'Arial, sans-serif',
    maxWidth: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1f2937',
    margin: 0,
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '8px 14px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#374151',
    fontWeight: '500',
  },

  /* search */
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    padding: '10px 14px',
    marginBottom: '14px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    color: '#111827',
    background: 'transparent',
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#6b7280',
    padding: '0',
    display: 'flex',
  },

  /* filters */
  filters: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '12px',
  },
  select: {
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '7px 12px',
    fontSize: '13px',
    color: '#374151',
    background: '#fff',
    cursor: 'pointer',
    outline: 'none',
  },
  dateInput: {
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '7px 12px',
    fontSize: '13px',
    color: '#374151',
    outline: 'none',
  },
  clearFiltersBtn: {
    background: '#fef2f2',
    border: '1px solid #fca5a5',
    color: '#dc2626',
    borderRadius: '8px',
    padding: '7px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },

  /* results count */
  resultsCount: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '14px',
  },

  /* grid */
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
  },
  loading: {
    textAlign: 'center',
    padding: '60px 0',
    color: '#6b7280',
    fontSize: '15px',
  },
  noAlerts: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '60px 0',
    color: '#9ca3af',
  },

  /* card */
  card: (alertType) => ({
    background: '#fff',
    border: `2px solid ${alertType === 'HIGH' ? '#fecaca' : '#bfdbfe'}`,
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  }),
  cardTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertTypeBadge: (alertType) => ({
    background: alertType === 'HIGH' ? '#dc2626' : '#2563eb',
    color: '#fff',
    borderRadius: '6px',
    padding: '3px 10px',
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.5px',
  }),
  statusBadge: (status) => ({
    color: status === 'NEW' ? '#dc2626' : status === 'ACKNOWLEDGED' ? '#d97706' : '#10b981',
    fontSize: '12px',
    fontWeight: '600',
    background: status === 'NEW' ? '#fef2f2' : status === 'ACKNOWLEDGED' ? '#fffbeb' : '#f0fdf4',
    border: `1px solid ${status === 'NEW' ? '#fca5a5' : status === 'ACKNOWLEDGED' ? '#fde68a' : '#6ee7b7'}`,
    borderRadius: '6px',
    padding: '3px 10px',
  }),

  bpmDisplay: (alertType) => ({
    textAlign: 'center',
    fontSize: '44px',
    fontWeight: '900',
    color: alertType === 'HIGH' ? '#dc2626' : '#2563eb',
    lineHeight: 1,
    padding: '4px 0',
  }),
  bpmLabel: {
    fontSize: '12px',
    color: '#6b7280',
    textAlign: 'center',
    marginTop: '-4px',
  },

  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#374151',
  },

  actions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '4px',
  },
  btnView: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1d4ed8',
    borderRadius: '7px',
    padding: '7px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },
  btnAcknowledge: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    color: '#92400e',
    borderRadius: '7px',
    padding: '7px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },
  btnResolve: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    background: '#f0fdf4',
    border: '1px solid #6ee7b7',
    color: '#065f46',
    borderRadius: '7px',
    padding: '7px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },

  /* modal */
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modal: {
    background: '#fff',
    borderRadius: '14px',
    width: '460px',
    maxWidth: '95vw',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '28px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#111827',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '24px',
    color: '#6b7280',
    lineHeight: 1,
    padding: '0',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '10px 0',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '14px',
    gap: '12px',
  },
  detailLabel: {
    color: '#6b7280',
    fontWeight: '500',
    minWidth: '130px',
  },
  detailValue: {
    color: '#111827',
    fontWeight: '600',
    textAlign: 'right',
  },
  notesArea: {
    width: '100%',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '14px',
    marginTop: '12px',
    resize: 'vertical',
    minHeight: '70px',
    outline: 'none',
    fontFamily: 'Arial, sans-serif',
    boxSizing: 'border-box',
  },
  modalActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '20px',
    flexWrap: 'wrap',
  },
  btnAcknowledgeModal: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#d97706',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  btnResolveModal: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#10b981',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  btnCloseModal: {
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    color: '#374151',
    borderRadius: '8px',
    padding: '10px 16px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },

  /* summary stats bar */
  statsBar: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '20px',
  },
  statCard: (color) => ({
    flex: '1',
    minWidth: '110px',
    background: color + '10',
    border: `1px solid ${color}40`,
    borderRadius: '10px',
    padding: '12px 16px',
    textAlign: 'center',
  }),
  statNum: (color) => ({
    fontSize: '26px',
    fontWeight: '900',
    color: color,
    lineHeight: 1,
  }),
  statLabel: {
    fontSize: '11px',
    color: '#6b7280',
    marginTop: '4px',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
};

/* ─── component ─────────────────────────────────────────────────────────── */
const HeartRateAlerts = ({ initialAlertId, onAlertOpened }) => {
  const [alerts, setAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [notesInput, setNotesInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState({ status: '', alert_type: '', date: '' });

  useEffect(() => { 
    loadAlerts(); 
    loadSummary();
    const interval = setInterval(() => {
      loadAlerts();
      loadSummary();
    }, 60000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
  if (initialAlertId && alerts.length > 0) {
    const target = alerts.find(a => a.id === initialAlertId);
    if (target) {
      setSelectedAlert(target);
      setShowDetails(true);
      onAlertOpened?.();
    }
  }
}, [initialAlertId, alerts]);

  useEffect(() => { applyFilters(); }, [alerts, filter, searchTerm]);

  /* ── data loaders ───────────────────────────────────────────────────── */
  const loadAlerts = async () => {
    setLoading(true);
    try {
      const res = await heartRateAPI.getAlerts();
      setAlerts(res.data || []);
    } catch (err) {
      console.error('Error loading heart rate alerts:', err);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const res = await heartRateAPI.getSummary();
      setSummary(res.data);
    } catch (err) {
      console.error('Error loading heart rate summary:', err);
    }
  };

  /* ── filtering ──────────────────────────────────────────────────────── */
  const applyFilters = () => {
    let filtered = [...alerts];

    if (filter.status)
      filtered = filtered.filter(a => a.status === filter.status);

    if (filter.alert_type)
      filtered = filtered.filter(a => a.alert_type === filter.alert_type);

    if (filter.date)
      filtered = filtered.filter(a => {
        const d = new Date(a.detected_at).toISOString().split('T')[0];
        return d === filter.date;
      });

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(a =>
        a.driver_name?.toLowerCase().includes(q) ||
        a.driver_id_no?.toLowerCase().includes(q) ||
        a.driver_phone?.toLowerCase().includes(q) ||
        a.alert_type?.toLowerCase().includes(q) ||
        a.status?.toLowerCase().includes(q)
      );
    }

    // Sort: NEW first, then ACKNOWLEDGED, then RESOLVED
    const statusOrder = { 'NEW': 1, 'ACKNOWLEDGED': 2, 'RESOLVED': 3 };
    filtered.sort((a, b) => {
      const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      if (statusDiff !== 0) return statusDiff;
      // Within same status, show most recent first
      return new Date(b.detected_at) - new Date(a.detected_at);
    });

    setFilteredAlerts(filtered);
  };

  const clearFilters = () => {
    setFilter({ status: '', alert_type: '', date: '' });
    setSearchTerm('');
  };

  /* ── actions ────────────────────────────────────────────────────────── */
  const handleViewDetails = async (alert) => {
    try {
      const res = await heartRateAPI.getAlertDetail(alert.id);
      setSelectedAlert(res.data);
      setNotesInput(res.data.notes || '');
      setShowDetails(true);
    } catch (err) {
      console.error('Error loading alert detail:', err);
    }
  };

  const handleUpdateStatus = async (alertId, newStatus, closeModal = false) => {
    try {
      await heartRateAPI.updateAlertStatus(alertId, {
        status: newStatus,
        notes: notesInput || undefined,
      });
      await loadAlerts();
      await loadSummary();
      if (closeModal) { setShowDetails(false); setSelectedAlert(null); }
    } catch (err) {
      console.error('Error updating alert:', err);
    }
  };

  const handleQuickStatus = async (alertId, newStatus) => {
    try {
      await heartRateAPI.updateAlertStatus(alertId, { status: newStatus });
      await loadAlerts();
      await loadSummary();
    } catch (err) {
      console.error('Error updating alert:', err);
    }
  };

  /* ── render helpers ─────────────────────────────────────────────────── */
  const alertEmoji = (type) => type === 'HIGH' ? '🔥' : '❄️';

  const hasActiveFilters =
    filter.status || filter.alert_type || filter.date || searchTerm;

  /* ── render ─────────────────────────────────────────────────────────── */
  return (
    <div style={S.container}>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <Heart size={28} color="#dc2626" />
          <h2 style={S.headerTitle}>Heart Rate Alerts</h2>
        </div>
        <button style={S.refreshBtn} onClick={() => { loadAlerts(); loadSummary(); }}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Summary Stats Bar */}
      {summary && (
        <div style={S.statsBar}>
          <div style={S.statCard('#6b7280')}>
            <div style={S.statNum('#6b7280')}>{summary.total_alerts ?? 0}</div>
            <div style={S.statLabel}>Total</div>
          </div>
          <div style={S.statCard('#dc2626')}>
            <div style={S.statNum('#dc2626')}>{summary.new_alerts ?? 0}</div>
            <div style={S.statLabel}>New</div>
          </div>
          <div style={S.statCard('#f97316')}>
            <div style={S.statNum('#f97316')}>{summary.today_alerts ?? 0}</div>
            <div style={S.statLabel}>Today</div>
          </div>
          <div style={S.statCard('#dc2626')}>
            <div style={S.statNum('#dc2626')}>{summary.high_bpm_alerts ?? 0}</div>
            <div style={S.statLabel}>🔥 High BPM</div>
          </div>
          <div style={S.statCard('#2563eb')}>
            <div style={S.statNum('#2563eb')}>{summary.low_bpm_alerts ?? 0}</div>
            <div style={S.statLabel}>❄️ Low BPM</div>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={S.searchBar}>
        <Search size={18} color="#9ca3af" />
        <input
          style={S.searchInput}
          type="text"
          placeholder="Search by driver name, ID, phone, or alert type..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button style={S.clearBtn} onClick={() => setSearchTerm('')}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={S.filters}>
        <Filter size={16} color="#6b7280" />

        <select
          style={S.select}
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
        >
          <option value="">All Status</option>
          <option value="NEW">New</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="RESOLVED">Resolved</option>
        </select>

        <select
          style={S.select}
          value={filter.alert_type}
          onChange={(e) => setFilter({ ...filter, alert_type: e.target.value })}
        >
          <option value="">All Types</option>
          <option value="HIGH">🔥 High BPM</option>
          <option value="LOW">❄️ Low BPM</option>
        </select>

        <input
          style={S.dateInput}
          type="date"
          value={filter.date}
          onChange={(e) => setFilter({ ...filter, date: e.target.value })}
        />

        {hasActiveFilters && (
          <button style={S.clearFiltersBtn} onClick={clearFilters}>
            Clear Filters
          </button>
        )}
      </div>

      {/* Results count */}
      <div style={S.resultsCount}>
        Showing {filteredAlerts.length} of {alerts.length} alerts
      </div>

      {/* Cards grid */}
      <div style={S.grid}>
        {loading ? (
          <div style={{ ...S.loading, gridColumn: '1 / -1' }}>
            Loading heart rate alerts…
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div style={S.noAlerts}>
            <CheckCircle size={48} color="#d1d5db" />
            <p style={{ marginTop: '12px', fontSize: '15px' }}>
              {hasActiveFilters
                ? 'No alerts match your filters'
                : 'No heart rate alerts found'}
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div key={alert.id} style={S.card(alert.alert_type)}>

              {/* Top row: type badge + status badge */}
              <div style={S.cardTopRow}>
                <span style={S.alertTypeBadge(alert.alert_type)}>
                  {alertEmoji(alert.alert_type)} {alert.alert_type}
                </span>
                <span style={S.statusBadge(alert.status)}>
                  {alert.status}
                </span>
              </div>

              {/* BPM display */}
              <div>
                <div style={S.bpmDisplay(alert.alert_type)}>
                  {Math.round(alert.heart_rate)}
                </div>
                <div style={S.bpmLabel}>BPM</div>
              </div>

              {/* Driver info */}
              <div style={S.infoRow}>
                <User size={14} color="#6b7280" />
                <strong>{alert.driver_name || 'Unknown Driver'}</strong>
              </div>
              <div style={S.infoRow}>
                <Phone size={14} color="#6b7280" />
                <span>{alert.driver_phone || 'N/A'}</span>
              </div>
              <div style={S.infoRow}>
                <Activity size={14} color="#6b7280" />
                <span>
                  Threshold: {alert.threshold_low} – {alert.threshold_high} BPM
                </span>
              </div>
              <div style={S.infoRow}>
                <Clock size={14} color="#6b7280" />
                <span>{alert.time_since_detection || new Date(alert.detected_at).toLocaleString()}</span>
              </div>

              {/* Actions */}
              <div style={S.actions}>
                <button style={S.btnView} onClick={() => handleViewDetails(alert)}>
                  <Info size={14} />
                  Details
                </button>

                {alert.status === 'NEW' && (
                  <button
                    style={S.btnAcknowledge}
                    onClick={() => handleQuickStatus(alert.id, 'ACKNOWLEDGED')}
                  >
                    Acknowledge
                  </button>
                )}

                {alert.status === 'ACKNOWLEDGED' && (
                  <button
                    style={S.btnResolve}
                    onClick={() => handleQuickStatus(alert.id, 'RESOLVED')}
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Details modal */}
      {showDetails && selectedAlert && (
        <div style={S.overlay} onClick={() => setShowDetails(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>

            <div style={S.modalHeader}>
              <h3 style={S.modalTitle}>
                {alertEmoji(selectedAlert.alert_type)} Heart Rate Alert #{selectedAlert.id}
              </h3>
              <button style={S.closeBtn} onClick={() => setShowDetails(false)}>×</button>
            </div>

            {/* BPM hero */}
            <div style={{
              textAlign: 'center',
              padding: '16px 0',
              marginBottom: '8px',
              background: selectedAlert.alert_type === 'HIGH' ? '#fef2f2' : '#eff6ff',
              borderRadius: '10px',
            }}>
              <div style={S.bpmDisplay(selectedAlert.alert_type)}>
                {Math.round(selectedAlert.heart_rate)}
              </div>
              <div style={S.bpmLabel}>BPM — {selectedAlert.alert_type === 'HIGH' ? 'TOO HIGH' : 'TOO LOW'}</div>
            </div>

            {/* Detail rows */}
            {[
              ['Alert Type', `${alertEmoji(selectedAlert.alert_type)} ${selectedAlert.alert_type}`],
              ['Status', selectedAlert.status],
              ['Threshold', `${selectedAlert.threshold_low} – ${selectedAlert.threshold_high} BPM`],
              ['Driver', selectedAlert.driver_name || 'Unknown'],
              ['Employee ID', selectedAlert.driver_id_no || 'N/A'],
              ['Phone', selectedAlert.driver_phone || 'N/A'],
              ['Detected At', new Date(selectedAlert.detected_at).toLocaleString()],
              selectedAlert.acknowledged_at && ['Acknowledged At', new Date(selectedAlert.acknowledged_at).toLocaleString()],
              selectedAlert.acknowledged_by_name && ['Acknowledged By', selectedAlert.acknowledged_by_name],
              selectedAlert.email_sent !== undefined && ['Email Sent', selectedAlert.email_sent ? '✅ Yes' : '❌ No'],
            ].filter(Boolean).map(([label, value]) => (
              <div key={label} style={S.detailRow}>
                <span style={S.detailLabel}>{label}</span>
                <span style={S.detailValue}>{value}</span>
              </div>
            ))}

            {/* Notes */}
            {(selectedAlert.status === 'NEW' || selectedAlert.status === 'ACKNOWLEDGED') && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <FileText size={13} /> Notes (optional)
                </div>
                <textarea
                  style={S.notesArea}
                  placeholder="Add notes about this alert…"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                />
              </div>
            )}

            {selectedAlert.notes && selectedAlert.status === 'RESOLVED' && (
              <div style={{ ...S.detailRow, flexDirection: 'column', gap: '4px' }}>
                <span style={S.detailLabel}>Notes</span>
                <span style={{ color: '#374151', fontSize: '13px' }}>{selectedAlert.notes}</span>
              </div>
            )}

            {/* Modal actions */}
            <div style={S.modalActions}>
              {selectedAlert.status === 'NEW' && (
                <button
                  style={S.btnAcknowledgeModal}
                  onClick={() => handleUpdateStatus(selectedAlert.id, 'ACKNOWLEDGED', true)}
                >
                  <CheckCircle size={16} />
                  Acknowledge
                </button>
              )}
              {(selectedAlert.status === 'NEW' || selectedAlert.status === 'ACKNOWLEDGED') && (
                <button
                  style={S.btnResolveModal}
                  onClick={() => handleUpdateStatus(selectedAlert.id, 'RESOLVED', true)}
                >
                  <CheckCircle size={16} />
                  Mark Resolved
                </button>
              )}
              <button style={S.btnCloseModal} onClick={() => setShowDetails(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeartRateAlerts;