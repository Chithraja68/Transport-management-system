// GPSTracking.jsx - COMPLETE WITH BUS SELECTION AND AUTO-OPEN POPUP
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin, Navigation, RefreshCw, Search, AlertCircle, Clock, 
   Calendar, History as HistoryIcon,
  CheckCircle, X,Ban
} from 'lucide-react';
import { transport } from '../../services/api';
import './GPSTracking.css';

// ✅ FIX LEAFLET DEFAULT MARKERS
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ✅ CUSTOM ICONS
const driverIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const conductorIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// ✅ MAP CONTROLLER - HANDLES ZOOM TO SELECTED BUS ONLY
function MapController({ locations, selectedBusId }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedBusId) return; // ✅ Do nothing when nothing is selected

    const selectedBus = locations.find(b => b.id === selectedBusId);
    if (!selectedBus) return;

    const hardwareTime  = selectedBus.hardware_update?.timestamp  ? new Date(selectedBus.hardware_update.timestamp).getTime()  : 0;
    const driverTime    = selectedBus.driver_update?.timestamp    ? new Date(selectedBus.driver_update.timestamp).getTime()    : 0;
    const conductorTime = selectedBus.conductor_update?.timestamp ? new Date(selectedBus.conductor_update.timestamp).getTime() : 0;
    const maxTime = Math.max(hardwareTime, driverTime, conductorTime);

    const latestUpdate =
      maxTime === hardwareTime && selectedBus.hardware_update ? selectedBus.hardware_update :
      maxTime === driverTime   && selectedBus.driver_update   ? selectedBus.driver_update :
      selectedBus.conductor_update;

    if (latestUpdate?.latitude && latestUpdate?.longitude) {
      map.setView(
        [parseFloat(latestUpdate.latitude), parseFloat(latestUpdate.longitude)],
        15,
        { animate: true, duration: 1 }
      );
    }
  }, [locations, selectedBusId, map]);

  return null; // ✅ Required - MapController renders nothing
}

const GPSTracking = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [selectedBus, setSelectedBus] = useState(null);
  const [selectedBusId, setSelectedBusId] = useState(null);
  const [selectedSource, setSelectedSource] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  
  const refreshInterval = useRef(null);
  const markerRefs = useRef({});

  const getLatestSource = (bus) => {
    const hardwareTime  = bus.hardware_update?.timestamp  ? new Date(bus.hardware_update.timestamp).getTime()  : 0;
    const driverTime    = bus.driver_update?.timestamp    ? new Date(bus.driver_update.timestamp).getTime()    : 0;
    const conductorTime = bus.conductor_update?.timestamp ? new Date(bus.conductor_update.timestamp).getTime() : 0;
    const maxTime = Math.max(hardwareTime, driverTime, conductorTime);
    if (maxTime === 0) return null;
    if (maxTime === hardwareTime && bus.hardware_update) return 'hardware';
    if (maxTime === driverTime   && bus.driver_update)   return 'driver';
    return 'conductor';
  };

  // ✅ OPEN POPUP WHEN BUS IS SELECTED
  useEffect(() => {
    if (!selectedBusId) return;
    const bus = locations.find(b => b.id === selectedBusId);
    const source = selectedSource || (bus ? getLatestSource(bus) : null);
    if (!source) return;
    setTimeout(() => {
      const marker = markerRefs.current[`${selectedBusId}_${source}`];
      if (marker) marker.openPopup();
    }, 1100);
  }, [selectedBusId, selectedSource, locations]);

  const loadLocations = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await transport.getAllBusLocations();
      
      const uniqueLocations = [];
      const seenScheduleIds = new Set();
      
      const sortedData = [...response.data].sort((a, b) => {
        const aTime = Math.max(
          a.driver_update?.timestamp    ? new Date(a.driver_update.timestamp).getTime()    : 0,
          a.conductor_update?.timestamp ? new Date(a.conductor_update.timestamp).getTime() : 0,
          a.hardware_update?.timestamp  ? new Date(a.hardware_update.timestamp).getTime()  : 0
        );
        const bTime = Math.max(
          b.driver_update?.timestamp    ? new Date(b.driver_update.timestamp).getTime()    : 0,
          b.conductor_update?.timestamp ? new Date(b.conductor_update.timestamp).getTime() : 0,
          b.hardware_update?.timestamp  ? new Date(b.hardware_update.timestamp).getTime()  : 0
        );
        return bTime - aTime;
      });
      
      sortedData.forEach(loc => {
        const scheduleId = loc.schedule || loc.schedule_id || loc.id;
        if (!seenScheduleIds.has(scheduleId)) {
          seenScheduleIds.add(scheduleId);
          uniqueLocations.push(loc);
        }
      });
      
      setLocations(uniqueLocations);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Failed to load bus locations');
      console.error('Error loading locations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      loadLocations();
      refreshInterval.current = setInterval(loadLocations, 10000);
    }
    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
    };
  }, [autoRefresh]);

  const activeBuses = locations.filter(loc => 
    loc.schedule_status === 'SCHEDULED' || loc.schedule_status === 'IN_PROGRESS'
  );
  const completedBuses = locations.filter(loc => loc.schedule_status === 'COMPLETED');
  const cancelledBuses = locations.filter(loc => loc.schedule_status === 'CANCELLED');

  const tabBuses = activeTab === 'active' ? activeBuses : 
                   activeTab === 'completed' ? completedBuses : cancelledBuses;

  const filteredLocations = tabBuses.filter(loc => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      loc.route_name?.toLowerCase().includes(searchLower) ||
      loc.route_number?.toLowerCase().includes(searchLower) ||
      loc.vehicle_number?.toLowerCase().includes(searchLower) ||
      loc.driver_name?.toLowerCase().includes(searchLower) ||
      loc.conductor_name?.toLowerCase().includes(searchLower)
    );
  });

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Never';
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now - then) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const handleViewHistory = async (scheduleId, bus) => {
    try {
      setLoadingHistory(true);
      setSelectedBus(bus);
      const id = typeof scheduleId === 'object' ? scheduleId?.id : scheduleId;
      const response = await transport.getBusLocationHistory(id);
      setHistoryData(response.data);
      setShowHistoryModal(true);
    } catch (error) {
      console.error('Error loading history:', error);
      setError('Failed to load GPS history');
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="gps-tracking-container">
      {/* HEADER */}
      <div className="gps-header">
        <div className="gps-header-left">
          <MapPin className="header-icon" size={28} />
          <div>
            <h2>GPS Bus Tracking</h2>
            <div className="bus-counts">
              <span className="bus-count active">{activeBuses.length} Active</span>
              <span className="bus-count completed">{completedBuses.length} Completed</span>
              <span className="bus-count" style={{background:'#fee2e2', color:'#991b1b'}}>
                {cancelledBuses.length} Cancelled
              </span>
            </div>
          </div>
        </div>
        <div className="gps-header-right">
          <button
            className={`refresh-btn ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={autoRefresh ? 'spinning' : ''} size={16} />
            {autoRefresh ? 'Auto' : 'Manual'}
          </button>
          <button className="refresh-btn" onClick={loadLocations}>
            <RefreshCw size={16} />
            Refresh
          </button>
          {lastUpdate && (
            <span className="last-update">{formatTimeAgo(lastUpdate)}</span>
          )}
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="gps-tabs">
        <button
          className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => { setActiveTab('active'); setSelectedBusId(null); setSelectedSource(null); }}
        >
          <Navigation size={18} />
          Active Buses ({activeBuses.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => { setActiveTab('completed'); setSelectedBusId(null); setSelectedSource(null); }}
        >
          <CheckCircle size={18} />
          Completed Buses ({completedBuses.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'cancelled' ? 'active' : ''}`}
          onClick={() => { setActiveTab('cancelled'); setSelectedBusId(null); setSelectedSource(null); }}
        >
          <Ban size={18} />
          Cancelled Buses ({cancelledBuses.length})
        </button>
      </div>

      {/* SEARCH */}
      <div className="gps-filters">
        <div className="search-box">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            placeholder="Search by route, vehicle, driver, or conductor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="error-message">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="gps-content">
        {/* INTERACTIVE MAP */}
        {activeTab === 'active' && (
          <div className="gps-map-container">
            {activeBuses.length > 0 ? (
              <MapContainer
                center={[11.0168, 76.9558]}
                zoom={8}
                style={{ height: '100%', width: '100%', borderRadius: '12px' }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* ✅ MapController is a self-closing tag - nothing inside it */}
                <MapController locations={activeBuses} selectedBusId={selectedBusId} />

                {/* ✅ MARKERS - only render the selected bus */}
                {activeBuses.map((bus) => {
                  // ✅ Hide all markers when nothing selected; show only selected bus
                  if (!selectedBusId || bus.id !== selectedBusId) return null;

                  const latestSource = getLatestSource(bus);

                  const update =
                    latestSource === 'hardware' ? bus.hardware_update :
                    latestSource === 'driver'   ? bus.driver_update :
                    latestSource === 'conductor'? bus.conductor_update : null;

                  const icon =
                    latestSource === 'hardware' ? conductorIcon :
                    latestSource === 'driver'   ? driverIcon : conductorIcon;

                  const label =
                    latestSource === 'hardware' ? '📡 ESP32 Hardware GPS' :
                    latestSource === 'driver'   ? '🚗 Driver Phone' : '👤 Conductor Phone';

                  const name =
                    latestSource === 'hardware' ? 'ESP32 Hardware GPS' :
                    latestSource === 'driver'   ? bus.driver_name : bus.conductor_name;

                  if (!update?.latitude || !update?.longitude) return null;


                  return (
                    <Marker
                      key={bus.id}
                      position={[parseFloat(update.latitude), parseFloat(update.longitude)]}
                      icon={icon}
                      ref={(ref) => { if (ref) markerRefs.current[`${bus.id}_${latestSource}`] = ref; }}
                    >
                      <Popup maxWidth={300}>
                        <div className="map-popup">
                          <h3>{bus.route_name}</h3>
                          <p className="popup-subtitle">Route {bus.route_number}</p>
                          <span style={{ display:'inline-block', background:'#10b981', color:'white', fontSize:'11px', fontWeight:'700', padding:'2px 8px', borderRadius:'10px', marginBottom:'6px' }}>
                            ⭐ Most Recent
                          </span>
                          <div className="popup-section">
                            <strong>{label}</strong>
                            {latestSource !== 'hardware' && <p>👤 {name}</p>}
                            <p>🚌 {bus.vehicle_number}</p>
                          </div>
                          <div className="popup-section">
                            <p>📍 {parseFloat(update.latitude).toFixed(6)}, {parseFloat(update.longitude).toFixed(6)}</p>
                            <p>🕐 {formatTimeAgo(update.timestamp)}</p>
                          </div>
                          <button className="popup-btn" onClick={() => window.open(`https://www.google.com/maps?q=${update.latitude},${update.longitude}`, '_blank')}>
                            🗺️ Open in Google Maps
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            ) : (
              <div className="map-placeholder">
                <MapPin size={48} />
                <p>No Active Buses</p>
                <p className="map-note">Buses will appear on the map when GPS tracking is enabled</p>
              </div>
            )}

            {/* ✅ Hint overlay — OUTSIDE MapContainer, INSIDE gps-map-container */}
            {activeBuses.length > 0 && !selectedBusId && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'rgba(255,255,255,0.90)',
                padding: '12px 20px', borderRadius: '10px',
                zIndex: 1000, pointerEvents: 'none',
                fontSize: '14px', color: '#6b7280',
                display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}>
                <MapPin size={16} />
                Select a bus from the list to view on map
              </div>
            )}
          </div>
        )}

        {/* BUS LIST */}
        <div className={`gps-list-container ${activeTab !== 'active' ? 'fullwidth' : ''}`}>
          {loading && !locations.length ? (
            <div className="loading-state">
              <RefreshCw className="spinning" size={32} />
              <p>Loading bus locations...</p>
            </div>
          ) : filteredLocations.length === 0 ? (
            <div className="empty-state">
              <MapPin size={48} />
              <p>No {activeTab} buses found</p>
              <p className="empty-note">
                {searchTerm ? 'Try a different search term' : `No ${activeTab} buses at the moment`}
              </p>
            </div>
          ) : (
            <div className="bus-cards">
              {filteredLocations.map((bus) => (
                <div
                  key={bus.id}
                  className={`bus-card ${activeTab === 'completed' ? 'completed-card' : ''} ${selectedBusId === bus.id ? 'selected' : ''}`}
                  onClick={() => {
                    if (activeTab === 'active') {
                      setSelectedBusId(bus.id);
                      setSelectedSource(getLatestSource(bus));
                    }
                  }}
                  style={{ cursor: activeTab === 'active' ? 'pointer' : 'default' }}
                >
                  <div className="bus-card-header">
                    <div className="bus-route-info">
                      <h3>{bus.route_name}</h3>
                      <span className="route-badge">{bus.route_number}</span>
                      <span style={{
                        fontSize: '11px', background: '#f3f4f6',
                        color: '#6b7280', padding: '2px 8px',
                        borderRadius: '4px', fontFamily: 'monospace'
                      }}>
                        Schedule #{bus.schedule} · {bus.departure_time}
                      </span>
                      {activeTab === 'completed' && (
                        <span className="status-badge completed">
                          <CheckCircle size={14} />
                          Completed
                        </span>
                      )}
                    </div>
                    <div className="bus-meta">
                      <span className="vehicle-number">🚌 {bus.vehicle_number}</span>
                      <span className="schedule-date">
                        <Calendar size={14} />
                        {new Date(bus.schedule_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      marginTop: '6px', fontSize: '12px',
                      color: bus.device_type === 'GPS_HARDWARE' ? '#065f46' : '#1e40af',
                      background: bus.device_type === 'GPS_HARDWARE' ? '#f0fdf4' : '#eff6ff',
                      padding: '4px 10px', borderRadius: '6px', width: 'fit-content'
                    }}>
                      {bus.device_type === 'GPS_HARDWARE' ? '📡' : '📱'}
                      {bus.device_type === 'GPS_HARDWARE'
                        ? 'Location from ESP32 Hardware GPS'
                        : bus.updated_by_name === bus.driver_name
                          ? 'Location from Driver Phone'
                          : bus.updated_by_name === bus.conductor_name
                            ? 'Location from Conductor Phone'
                            : 'Location from Phone'}
                      &nbsp;·&nbsp; {formatTimeAgo(bus.timestamp)}
                    </div>
                  </div>

                  {/* ESP32 HARDWARE GPS UPDATE */}
                  {bus.hardware_update && (
                    <div className="update-box" style={{
                      borderLeft: '3px solid #065f46',
                      background: '#f0fdf4',
                      marginBottom: '12px',
                      padding: '12px',
                      borderRadius: '8px'
                    }}>
                      <div className="update-header">
                        <span className="update-badge" style={{
                          background: '#065f46', color: 'white',
                          padding: '4px 8px', borderRadius: '4px',
                          fontSize: '12px', fontWeight: '600'
                        }}>📡 GPS Device</span>
                        <span className="update-name">ESP32 Hardware GPS</span>
                      </div>
                      <div className="update-details">
                        <div className="detail-row">
                          <MapPin size={14} />
                          <span>
                            {parseFloat(bus.hardware_update.latitude).toFixed(4)},
                            {parseFloat(bus.hardware_update.longitude).toFixed(4)}
                          </span>
                        </div>
                        <div className="detail-row">
                          <Clock size={14} />
                          <span>{formatTimeAgo(bus.hardware_update.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DRIVER UPDATE */}
                  {bus.driver_update && (
                    <div className="update-box driver-update">
                      <div className="update-header">
                        <span className="update-badge">{bus.driver_update?.device_type === 'GPS_HARDWARE' ? '📡 ESP32 Hardware' : '🚗 Driver Phone'}</span>
                        <span className="update-name">{bus.driver_update?.device_type === 'GPS_HARDWARE' ? 'ESP32 Hardware GPS' : bus.driver_name}</span>
                      </div>
                      <div className="update-details">
                        <div className="detail-row">
                          <MapPin size={14} />
                          <span>
                            {parseFloat(bus.driver_update.latitude).toFixed(4)},
                            {parseFloat(bus.driver_update.longitude).toFixed(4)}
                          </span>
                        </div>
                        <div className="detail-row">
                          <Clock size={14} />
                          <span>{formatTimeAgo(bus.driver_update.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CONDUCTOR UPDATE */}
                  {bus.conductor_update && (
                    <div className="update-box conductor-update">
                      <div className="update-header">
                        <span className="update-badge">{bus.conductor_update?.device_type === 'GPS_HARDWARE' ? '📡 ESP32 Hardware' : '👤 Conductor Phone'}</span>
                        <span className="update-name">{bus.conductor_update?.device_type === 'GPS_HARDWARE' ? 'ESP32 Hardware GPS' : bus.conductor_name}</span>
                      </div>
                      <div className="update-details">
                        <div className="detail-row">
                          <MapPin size={14} />
                          <span>
                            {parseFloat(bus.conductor_update.latitude).toFixed(4)},
                            {parseFloat(bus.conductor_update.longitude).toFixed(4)}
                          </span>
                        </div>
                        <div className="detail-row">
                          <Clock size={14} />
                          <span>{formatTimeAgo(bus.conductor_update.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ACTIONS */}
                  <div className="bus-card-actions">
                    {activeTab === 'active' && (
                      <button
                        className="action-btn view-map-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBusId(bus.id);
                          setSelectedSource(getLatestSource(bus));
                        }}
                      >
                        <MapPin size={16} />
                        View on Map
                      </button>
                    )}
                    <button
                      className="action-btn history-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewHistory(bus.schedule_id || bus.schedule, bus);
                      }}
                      disabled={loadingHistory}
                    >
                      <HistoryIcon size={16} />
                      {loadingHistory ? 'Loading...' : 'View History'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* HISTORY MODAL */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal-content history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>GPS Location History</h3>
                {selectedBus && (
                  <p className="modal-subtitle">
                    {selectedBus.route_name} - {selectedBus.vehicle_number}
                    {selectedBus.schedule_status === 'COMPLETED' && (
                      <span className="completed-badge">✓ Completed</span>
                    )}
                  </p>
                )}
              </div>
              <button className="close-btn" onClick={() => setShowHistoryModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {historyData && historyData.length > 0 ? (
                <div className="history-timeline">
                  {historyData.map((entry, index) => {
                    const isHardwareGPS = entry.device_type === 'GPS_HARDWARE';
                    const isDriver = !isHardwareGPS && (
                      entry.device_type === 'DRIVER_PHONE' ||
                      entry.updated_by_name === selectedBus?.driver_name
                    );

                    const badgeClass = isHardwareGPS ? 'gps-badge' : isDriver ? 'driver-badge' : 'conductor-badge';
                    const badgeLabel = isHardwareGPS ? '📡 GPS Device' : isDriver ? '🚗 Driver Phone' : '👤 Conductor Phone';
                    const entryClass = isHardwareGPS ? 'gps-history' : isDriver ? 'driver-history' : 'conductor-history';
                    const sourceName = isHardwareGPS
                      ? 'ESP32 Hardware GPS'
                      : isDriver
                        ? (entry.updated_by_name || selectedBus?.driver_name)
                        : (entry.updated_by_name || selectedBus?.conductor_name);

                    return (
                      <div key={index} className={`history-entry ${entryClass}`}>
                        <div className="history-header-row">
                          <div className="history-time">
                            {new Date(entry.timestamp).toLocaleString()}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                            <span className={`history-badge ${badgeClass}`}>{badgeLabel}</span>
                            <span style={{ fontSize: '11px', color: '#555', fontWeight: '600' }}>{sourceName}</span>
                          </div>
                        </div>
                        <div className="history-details">
                          <p>📍 {parseFloat(entry.latitude).toFixed(6)}, {parseFloat(entry.longitude).toFixed(6)}</p>
                        </div>
                        <button
                          className="history-map-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`https://www.google.com/maps?q=${entry.latitude},${entry.longitude}`, '_blank');
                          }}
                        >
                          🗺️ View
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-history">
                  <HistoryIcon size={48} />
                  <p>No GPS history available for this trip</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GPSTracking;