import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, Clock, MapPin, Eye, Activity, 
  CheckCircle, XCircle, Info, RefreshCw, Filter,
  Calendar, User, Car, Search, X, ZoomIn
} from 'lucide-react';
import { drowsinessAPI } from '../../services/api';
import './DrowsinessAlerts.css';

const DrowsinessAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState({
    status: '',
    severity: '',
    date: ''
  });

  // Severity color mapping
  const getSeverityColor = (severity) => {
    const colors = {
      'LOW': '#fbbf24',      // yellow
      'MEDIUM': '#f97316',   // orange
      'HIGH': '#ef4444',     // red
      'CRITICAL': '#991b1b'  // dark red
    };
    return colors[severity] || '#6b7280';
  };

  // Status color mapping
  const getStatusColor = (status) => {
    const colors = {
      'ACTIVE': '#ef4444',
      'ACKNOWLEDGED': '#f97316',
      'RESOLVED': '#10b981'
    };
    return colors[status] || '#6b7280';
  };

  // Load alerts on mount and when filters change
  useEffect(() => {
    loadAlerts(); // initial load

    const interval = setInterval(() => {
      loadAlerts(); // auto refresh every 10 seconds
    }, 10000);

    return () => clearInterval(interval); // cleanup
  }, []);

  // Apply filters and search whenever alerts, filter, or searchTerm changes
  useEffect(() => {
    applyFiltersAndSearch();
  }, [alerts, filter, searchTerm]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const response = await drowsinessAPI.getAlerts();
      console.log('Alerts loaded:', response.data);
      setAlerts(response.data || []);
    } catch (error) {
      console.error('Error loading alerts:', error);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSearch = () => {
    let filtered = [...alerts];

    // Apply status filter
    if (filter.status) {
      filtered = filtered.filter(alert => alert.status === filter.status);
    }

    // Apply severity filter
    if (filter.severity) {
      filtered = filtered.filter(alert => alert.severity === filter.severity);
    }

    // Apply date filter
    if (filter.date) {
      filtered = filtered.filter(alert => {
        const alertDate = new Date(alert.detected_at).toISOString().split('T')[0];
        return alertDate === filter.date;
      });
    }

    // Apply search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(alert => 
        alert.driver_name?.toLowerCase().includes(searchLower) ||
        alert.vehicle_number?.toLowerCase().includes(searchLower) ||
        alert.severity?.toLowerCase().includes(searchLower) ||
        alert.status?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredAlerts(filtered);
  };

  const handleViewDetails = async (alert) => {
    try {
      const response = await drowsinessAPI.getAlertDetail(alert.id);
      console.log('Alert details:', response.data);
      setSelectedAlert(response.data);
      setShowDetails(true);
    } catch (error) {
      console.error('Error loading alert details:', error);
      alert('Failed to load alert details. Please try again.');
    }
  };

  const handleUpdateStatus = async (alertId, newStatus, closeModal = false) => {
    try {
      console.log('Updating alert status:', alertId, newStatus);
      await drowsinessAPI.updateAlertStatus(alertId, { 
        status: newStatus,
        admin_remarks: `Status changed to ${newStatus} at ${new Date().toLocaleString()}`
      });
      
      // Reload alerts to get updated data
      await loadAlerts();
      
      // Close modal if requested
      if (closeModal) {
        setShowDetails(false);
        setSelectedAlert(null);
      }
      
      alert(`Alert status updated to ${newStatus} successfully!`);
    } catch (error) {
      console.error('Error updating alert:', error);
      alert('Failed to update alert status. Please try again.');
    }
  };

  const handleImageClick = (imageUrl) => {
    setSelectedImage(imageUrl);
    setShowImageModal(true);
  };

  const clearFilters = () => {
    setFilter({
      status: '',
      severity: '',
      date: ''
    });
    setSearchTerm('');
  };

  return (
    <div className="drowsiness-alerts-container">
      <div className="alerts-header">
        <div className="header-title">
          <AlertTriangle size={28} />
          <h2>Drowsiness Detection Alerts</h2>
        </div>
        <button onClick={loadAlerts} className="refresh-btn">
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {/* Search Bar */}
      <div className="search-bar">
        <Search size={20} />
        <input
          type="text"
          placeholder="Search by driver name, vehicle, severity, or status..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="clear-search-btn">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="alerts-filters">
        <div className="filter-group">
          <Filter size={18} />
          <select 
            value={filter.status} 
            onChange={(e) => setFilter({...filter, status: e.target.value})}
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
          </select>

          <select 
            value={filter.severity} 
            onChange={(e) => setFilter({...filter, severity: e.target.value})}
          >
            <option value="">All Severity</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>

          <input 
            type="date" 
            value={filter.date}
            onChange={(e) => setFilter({...filter, date: e.target.value})}
          />

          {(filter.status || filter.severity || filter.date || searchTerm) && (
            <button onClick={clearFilters} className="clear-filters-btn">
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="results-count">
        Showing {filteredAlerts.length} of {alerts.length} alerts
      </div>

      {/* Alerts List */}
      <div className="alerts-grid">
        {loading ? (
          <div className="loading">Loading alerts...</div>
        ) : filteredAlerts.length === 0 ? (
          <div className="no-alerts">
            <CheckCircle size={48} />
            <p>{searchTerm || filter.status || filter.severity || filter.date 
              ? 'No alerts match your filters' 
              : 'No drowsiness alerts found'}</p>
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <div key={alert.id} className="alert-card">
              <div className="alert-header">
                <div className="alert-severity" 
                     style={{backgroundColor: getSeverityColor(alert.severity)}}>
                  {alert.severity}
                </div>
                <div className="alert-status"
                     style={{color: getStatusColor(alert.status)}}>
                  {alert.status}
                </div>
              </div>

              <div className="alert-body">
                <div className="alert-info">
                  <User size={16} />
                  <span><strong>{alert.driver_name}</strong></span>
                </div>

                <div className="alert-info">
                  <Car size={16} />
                  <span>{alert.vehicle_number || 'No vehicle'}</span>
                </div>

                <div className="alert-info">
                  <Eye size={16} />
                  <span>Eyes closed: <strong>{alert.eye_closure_duration}s</strong></span>
                </div>

                <div className="alert-info">
                  <Activity size={16} />
                  <span>EAR: <strong>{alert.ear_value?.toFixed(3)}</strong></span>
                </div>

                <div className="alert-info">
                  <Clock size={16} />
                  <span>{alert.time_since_detection || new Date(alert.detected_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="alert-actions">
                <button 
                  onClick={() => handleViewDetails(alert)}
                  className="btn-view"
                >
                  <Info size={16} />
                  View Details
                </button>

                {alert.status === 'ACTIVE' && (
                  <button 
                    onClick={() => handleUpdateStatus(alert.id, 'ACKNOWLEDGED')}
                    className="btn-acknowledge"
                  >
                    Acknowledge
                  </button>
                )}

                {alert.status === 'ACKNOWLEDGED' && (
                  <button 
                    onClick={() => handleUpdateStatus(alert.id, 'RESOLVED')}
                    className="btn-resolve"
                  >
                    Resolve
                  </button>
                )}
              </div>

              {alert.snapshot && (
                <div 
                  className="alert-snapshot"
                  onClick={() => handleImageClick(alert.snapshot)}
                  style={{cursor: 'pointer'}}
                  title="Click to enlarge"
                >
                  <img src={alert.snapshot} alt="Alert snapshot" />
                  <div className="zoom-overlay">
                    <ZoomIn size={24} />
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Alert Details Modal */}
      {showDetails && selectedAlert && (
        <div className="modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Alert Details</h3>
              <button onClick={() => setShowDetails(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="detail-row">
                <strong>Driver:</strong>
                <span>{selectedAlert.driver_name} ({selectedAlert.driver_phone})</span>
              </div>

              <div className="detail-row">
                <strong>Vehicle:</strong>
                <span>{selectedAlert.vehicle_number || 'N/A'}</span>
              </div>

              <div className="detail-row">
                <strong>Route:</strong>
                <span>{selectedAlert.route_name || 'N/A'}</span>
              </div>

              <div className="detail-row">
                <strong>Severity:</strong>
                <span className="badge" style={{backgroundColor: getSeverityColor(selectedAlert.severity)}}>
                  {selectedAlert.severity}
                </span>
              </div>

              <div className="detail-row">
                <strong>Status:</strong>
                <span className="badge" style={{backgroundColor: getStatusColor(selectedAlert.status)}}>
                  {selectedAlert.status}
                </span>
              </div>

              <div className="detail-row">
                <strong>Eye Closure Duration:</strong>
                <span>{selectedAlert.eye_closure_duration} seconds</span>
              </div>

              <div className="detail-row">
                <strong>EAR Value:</strong>
                <span>{selectedAlert.ear_value?.toFixed(3)}</span>
              </div>

              <div className="detail-row">
                <strong>Detected At:</strong>
                <span>{new Date(selectedAlert.detected_at).toLocaleString()}</span>
              </div>

              {selectedAlert.admin_remarks && (
                <div className="detail-row">
                  <strong>Admin Remarks:</strong>
                  <span>{selectedAlert.admin_remarks}</span>
                </div>
              )}

              {selectedAlert.snapshot && (
                <div className="snapshot-full">
                  <strong>Snapshot:</strong>
                  <img 
                    src={selectedAlert.snapshot} 
                    alt="Full snapshot" 
                    onClick={() => handleImageClick(selectedAlert.snapshot)}
                    style={{cursor: 'pointer'}}
                    title="Click to open in full screen"
                  />
                </div>
              )}
            </div>

            <div className="modal-actions">
              {/* Show Acknowledge button for ACTIVE alerts */}
              {selectedAlert.status === 'ACTIVE' && (
                <button 
                  onClick={() => handleUpdateStatus(selectedAlert.id, 'ACKNOWLEDGED', true)}
                  className="btn-acknowledge-modal"
                >
                  <CheckCircle size={18} />
                  Acknowledge
                </button>
              )}
              
              {/* Show Mark as Resolved button for ACTIVE or ACKNOWLEDGED alerts */}
              {(selectedAlert.status === 'ACTIVE' || selectedAlert.status === 'ACKNOWLEDGED') && (
                <button 
                  onClick={() => handleUpdateStatus(selectedAlert.id, 'RESOLVED', true)}
                  className="btn-resolve-modal"
                >
                  <CheckCircle size={18} />
                  Mark as Resolved
                </button>
              )}
              
              <button onClick={() => setShowDetails(false)} className="btn-close">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal for Full Screen View */}
      {showImageModal && selectedImage && (
        <div className="image-modal-overlay" onClick={() => setShowImageModal(false)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="image-modal-close" 
              onClick={() => setShowImageModal(false)}
              title="Close"
            >
              Close
            </button>
            <img src={selectedImage} alt="Full screen snapshot" />
          </div>
        </div>
      )}
    </div>
  );
};

export default DrowsinessAlerts;