// src/components/Dashboard/AlcoholAlerts.jsx
// Mirrors HeartRateAlerts.jsx exactly — same structure, amber/orange theme

import React, { useState, useEffect } from 'react';
import {
  RefreshCw, Search, X, Filter, Info,
  CheckCircle, User, Phone, Clock, FileText, Activity
} from 'lucide-react';
import { alcoholAPI } from '../../services/api';

// ─── inline styles (same approach as HeartRateAlerts) ────────────────────────
const S = {
  container: { padding: '0', fontFamily: 'Inter, sans-serif' },

  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '20px',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  headerTitle: { fontSize: '20px', fontWeight: '700', color: '#1e293b', margin: 0 },

  refreshBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', border: '1px solid #e2e8f0',
    borderRadius: '8px', background: 'white', cursor: 'pointer',
    fontSize: '14px', color: '#475569',
  },

  statsBar: {
    display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px',
  },
  statCard: (color) => ({
    flex: '1', minWidth: '90px', background: 'white',
    border: `1px solid ${color}30`, borderRadius: '12px',
    padding: '14px 16px', textAlign: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  }),
  statNum: (color) => ({
    fontSize: '26px', fontWeight: '800', color, lineHeight: '1',
  }),
  statLabel: { fontSize: '12px', color: '#94a3b8', marginTop: '4px' },

  searchBar: {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: 'white', border: '1px solid #e2e8f0',
    borderRadius: '10px', padding: '10px 14px', marginBottom: '12px',
  },
  searchInput: {
    flex: 1, border: 'none', outline: 'none',
    fontSize: '14px', background: 'transparent', color: '#1e293b',
  },
  clearBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#94a3b8', display: 'flex', alignItems: 'center',
  },

  filters: {
    display: 'flex', alignItems: 'center', gap: '10px',
    flexWrap: 'wrap', marginBottom: '12px',
  },
  select: {
    padding: '8px 12px', border: '1px solid #e2e8f0',
    borderRadius: '8px', fontSize: '13px', background: 'white',
    color: '#475569', cursor: 'pointer',
  },
  dateInput: {
    padding: '8px 12px', border: '1px solid #e2e8f0',
    borderRadius: '8px', fontSize: '13px', background: 'white', color: '#475569',
  },
  clearFiltersBtn: {
    padding: '8px 14px', background: '#fef3c7', border: '1px solid #fde68a',
    borderRadius: '8px', fontSize: '13px', color: '#92400e', cursor: 'pointer',
  },

  resultsCount: { fontSize: '13px', color: '#94a3b8', marginBottom: '16px' },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
  },
  loading: { textAlign: 'center', padding: '48px', color: '#94a3b8' },
  noAlerts: {
    gridColumn: '1 / -1', textAlign: 'center', padding: '48px',
    color: '#94a3b8', display: 'flex', flexDirection: 'column',
    alignItems: 'center',
  },

  card: () => ({
    background: 'white',
    border: '1px solid #fde68a',
    borderTop: '4px solid #f59e0b',
    borderRadius: '12px',
    padding: '18px',
    display: 'flex', flexDirection: 'column', gap: '10px',
    boxShadow: '0 2px 8px rgba(245,158,11,0.08)',
  }),
  cardTopRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  alertBadge: {
    background: '#fef3c7', color: '#92400e',
    border: '1px solid #fde68a', borderRadius: '6px',
    padding: '3px 10px', fontSize: '12px', fontWeight: '700',
  },
  statusBadge: (status) => {
    const map = {
      NEW:          { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
      ACKNOWLEDGED: { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' },
      RESOLVED:     { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
    };
    return {
      ...(map[status] || map.NEW),
      borderRadius: '6px', padding: '3px 10px',
      fontSize: '12px', fontWeight: '600',
    };
  },

  valueDisplay: {
    fontSize: '48px', fontWeight: '900', color: '#f59e0b',
    lineHeight: '1', textAlign: 'center',
  },
  valueLabel: {
    fontSize: '12px', color: '#92400e', textAlign: 'center',
    textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px',
  },

  infoRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: '13px', color: '#475569',
  },

  actions: { display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' },
  btnView: {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '7px 12px', background: '#f8fafc',
    border: '1px solid #e2e8f0', borderRadius: '8px',
    fontSize: '13px', cursor: 'pointer', color: '#475569',
  },
  btnAcknowledge: {
    padding: '7px 12px', background: '#fffbeb',
    border: '1px solid #fde68a', borderRadius: '8px',
    fontSize: '13px', cursor: 'pointer', color: '#92400e', fontWeight: '600',
  },
  btnResolve: {
    padding: '7px 12px', background: '#f0fdf4',
    border: '1px solid #bbf7d0', borderRadius: '8px',
    fontSize: '13px', cursor: 'pointer', color: '#16a34a', fontWeight: '600',
  },

  // Modal
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '16px',
  },
  modal: {
    background: 'white', borderRadius: '16px',
    width: '100%', maxWidth: '480px', maxHeight: '90vh',
    overflowY: 'auto', padding: '24px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '16px',
  },
  modalTitle: { fontSize: '17px', fontWeight: '700', color: '#1e293b', margin: 0 },
  closeBtn: {
    background: 'none', border: 'none', fontSize: '24px',
    cursor: 'pointer', color: '#94a3b8', lineHeight: '1',
  },
  detailRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '10px 0', borderBottom: '1px solid #f1f5f9',
  },
  detailLabel: { fontSize: '13px', color: '#6b7280', fontWeight: '500' },
  detailValue: { fontSize: '13px', color: '#111827', fontWeight: '600', textAlign: 'right' },
  notesArea: {
    width: '100%', minHeight: '80px', border: '1px solid #e2e8f0',
    borderRadius: '8px', padding: '10px', fontSize: '13px',
    resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
  },
  modalActions: { display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' },
  btnAcknowledgeModal: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '10px 18px', background: '#fffbeb',
    border: '1px solid #fde68a', borderRadius: '10px',
    fontSize: '14px', cursor: 'pointer', color: '#92400e', fontWeight: '600',
  },
  btnResolveModal: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '10px 18px', background: '#f0fdf4',
    border: '1px solid #bbf7d0', borderRadius: '10px',
    fontSize: '14px', cursor: 'pointer', color: '#16a34a', fontWeight: '600',
  },
  btnCloseModal: {
    padding: '10px 18px', background: '#f1f5f9',
    border: '1px solid #e2e8f0', borderRadius: '10px',
    fontSize: '14px', cursor: 'pointer', color: '#475569',
  },
  contextBadge: (context) => ({
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '3px 10px', borderRadius: '20px',
    fontSize: '12px', fontWeight: '700',
    background: context === 'LOGIN' ? '#ede9fe' : '#fef3c7',
    color:      context === 'LOGIN' ? '#5b21b6' : '#92400e',
    border:     `1px solid ${context === 'LOGIN' ? '#c4b5fd' : '#fde68a'}`,
  }),
};

// ─── Component ────────────────────────────────────────────────────────────────
const AlcoholAlerts = ({ initialAlertId, onAlertOpened }) => {
  const [alerts, setAlerts]               = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [summary, setSummary]             = useState(null);
  const [loading, setLoading]             = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [showDetails, setShowDetails]     = useState(false);
  const [notesInput, setNotesInput]       = useState('');
  const [searchTerm, setSearchTerm]       = useState('');
  const [filter, setFilter]               = useState({ status: '', date: '' });

  // ── Auto-refresh every 30s (alcohol is real-time critical) ────────────────
  useEffect(() => {
    loadAlerts();
    loadSummary();
    const interval = setInterval(() => {
      loadAlerts();
      loadSummary();
    }, 30000);
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

  /* ── data loaders ─────────────────────────────────────────────────────── */
  const loadAlerts = async () => {
    setLoading(true);
    try {
      const res = await alcoholAPI.getAlerts();
      setAlerts(res.data || []);
    } catch (err) {
      console.error('Error loading alcohol alerts:', err);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const res = await alcoholAPI.getSummary();
      setSummary(res.data);
    } catch (err) {
      console.error('Error loading alcohol summary:', err);
    }
  };

  /* ── filtering ────────────────────────────────────────────────────────── */
  const applyFilters = () => {
    let filtered = [...alerts];

    if (filter.status)
      filtered = filtered.filter(a => a.status === filter.status);

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
        a.status?.toLowerCase().includes(q)
      );
    }

    const statusOrder = { NEW: 1, ACKNOWLEDGED: 2, RESOLVED: 3 };
    filtered.sort((a, b) => {
      const diff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      if (diff !== 0) return diff;
      return new Date(b.detected_at) - new Date(a.detected_at);
    });

    setFilteredAlerts(filtered);
  };

  const clearFilters = () => {
    setFilter({ status: '', date: '' });
    setSearchTerm('');
  };

  /* ── actions ──────────────────────────────────────────────────────────── */
  const handleViewDetails = async (alert) => {
    try {
      const res = await alcoholAPI.getAlertDetail(alert.id);
      setSelectedAlert(res.data);
      setNotesInput(res.data.notes || '');
      setShowDetails(true);
    } catch (err) {
      console.error('Error loading alert detail:', err);
    }
  };

  const handleUpdateStatus = async (alertId, newStatus, closeModal = false) => {
    try {
      await alcoholAPI.updateAlertStatus(alertId, {
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
      await alcoholAPI.updateAlertStatus(alertId, { status: newStatus });
      await loadAlerts();
      await loadSummary();
    } catch (err) {
      console.error('Error updating alert:', err);
    }
  };

  const hasActiveFilters = filter.status || filter.date || searchTerm;

  /* ── render ───────────────────────────────────────────────────────────── */
  return (
    <div style={S.container}>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <span style={{ fontSize: '28px' }}>🍺</span>
          <h2 style={S.headerTitle}>Alcohol Alerts</h2>
        </div>
        <button style={S.refreshBtn} onClick={() => { loadAlerts(); loadSummary(); }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Summary Stats */}
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
          <div style={S.statCard('#f59e0b')}>
            <div style={S.statNum('#f59e0b')}>{summary.today_alerts ?? 0}</div>
            <div style={S.statLabel}>Today</div>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={S.searchBar}>
        <Search size={18} color="#9ca3af" />
        <input
          style={S.searchInput}
          type="text"
          placeholder="Search by driver name, ID, or phone..."
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

      <div style={S.resultsCount}>
        Showing {filteredAlerts.length} of {alerts.length} alerts
      </div>

      {/* Cards Grid */}
      <div style={S.grid}>
        {loading ? (
          <div style={{ ...S.loading, gridColumn: '1 / -1' }}>
            Loading alcohol alerts…
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div style={S.noAlerts}>
            <CheckCircle size={48} color="#d1d5db" />
            <p style={{ marginTop: '12px', fontSize: '15px' }}>
              {hasActiveFilters ? 'No alerts match your filters' : 'No alcohol alerts found'}
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div key={alert.id} style={S.card()}>

              <div style={S.cardTopRow}>
                <span style={S.contextBadge(alert.alert_context)}>
                  {alert.alert_context === 'LOGIN' ? '🚫 Login Cancelled' : '⚠️ While Driving'}
                </span>
                <span style={S.statusBadge(alert.status)}>{alert.status}</span>
              </div>

              {/* Sensor Value display */}
              <div>
                <div style={S.valueDisplay}>{alert.sensor_value}</div>
                <div style={S.valueLabel}>Sensor Value · Threshold: {alert.threshold}</div>
              </div>

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
                <span>Employee ID: {alert.driver_id_no || 'N/A'}</span>
              </div>
              <div style={S.infoRow}>
                <Clock size={14} color="#6b7280" />
                <span>{alert.time_since_detection || new Date(alert.detected_at).toLocaleString()}</span>
              </div>

              <div style={S.actions}>
                <button style={S.btnView} onClick={() => handleViewDetails(alert)}>
                  <Info size={14} /> Details
                </button>
                {alert.status === 'NEW' && (
                  <button style={S.btnAcknowledge} onClick={() => handleQuickStatus(alert.id, 'ACKNOWLEDGED')}>
                    Acknowledge
                  </button>
                )}
                {alert.status === 'ACKNOWLEDGED' && (
                  <button style={S.btnResolve} onClick={() => handleQuickStatus(alert.id, 'RESOLVED')}>
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Details Modal */}
      {showDetails && selectedAlert && (
        <div style={S.overlay} onClick={() => setShowDetails(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>

            <div style={S.modalHeader}>
              <h2 style={S.modalTitle}>🍺 Alcohol Alert #{selectedAlert.id}</h2>
              <button style={S.closeBtn} onClick={() => setShowDetails(false)}>×</button>
            </div>

            {/* Sensor value hero */}
            <div style={{
              textAlign: 'center', padding: '16px 0', marginBottom: '8px',
              background: '#fffbeb', borderRadius: '10px',
            }}>
              <div style={S.valueDisplay}>{selectedAlert.sensor_value}</div>
              <div style={S.valueLabel}>Sensor Value · Threshold: {selectedAlert.threshold}</div>
            </div>

            {/* Detection Context — shown as a badge, not a plain text row */}
            <div style={{ ...S.detailRow }}>
              <span style={S.detailLabel}>Detection Context</span>
              <span style={S.contextBadge(selectedAlert.alert_context)}>
                {selectedAlert.alert_context === 'LOGIN' ? '🚫 Login Cancelled' : '⚠️ During Driving'}
              </span>
            </div>

            {[
              ['Status', selectedAlert.status],
              ['Sensor Value', selectedAlert.sensor_value],
              ['Threshold', selectedAlert.threshold],
              ['Driver', selectedAlert.driver_name || 'Unknown'],
              ['Employee ID', selectedAlert.driver_id_no || 'N/A'],
              ['Phone', selectedAlert.driver_phone || 'N/A'],
              ['Detected At', new Date(selectedAlert.detected_at).toLocaleString()],
              selectedAlert.acknowledged_at && ['Acknowledged At', new Date(selectedAlert.acknowledged_at).toLocaleString()],
              selectedAlert.acknowledged_by_name && ['Acknowledged By', selectedAlert.acknowledged_by_name],
              ['Email Sent', selectedAlert.email_sent ? '✅ Yes' : '❌ No'],
            ].filter(Boolean).map(([label, value]) => (
              <div key={label} style={S.detailRow}>
                <span style={S.detailLabel}>{label}</span>
                <span style={S.detailValue}>{String(value)}</span>
              </div>
            ))}

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

            <div style={S.modalActions}>
              {selectedAlert.status === 'NEW' && (
                <button style={S.btnAcknowledgeModal} onClick={() => handleUpdateStatus(selectedAlert.id, 'ACKNOWLEDGED', true)}>
                  <CheckCircle size={16} /> Acknowledge
                </button>
              )}
              {(selectedAlert.status === 'NEW' || selectedAlert.status === 'ACKNOWLEDGED') && (
                <button style={S.btnResolveModal} onClick={() => handleUpdateStatus(selectedAlert.id, 'RESOLVED', true)}>
                  <CheckCircle size={16} /> Mark Resolved
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

export default AlcoholAlerts;