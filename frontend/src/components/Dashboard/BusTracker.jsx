import React, { useState, useEffect, useRef,useCallback  } from 'react';
import { 
  MapPin, Navigation, Clock, Gauge, Battery, 
  RefreshCw, AlertCircle, Bus, User, Calendar,
  XCircle, CheckCircle
} from 'lucide-react';
import { transport } from '../../services/api';
import { 
  calculateDistance, 
  formatDistance, 
  calculateETA,
  headingToDirection,
  getCurrentPosition
} from '../../utils/geolocation';
import './BusTracker.css';

const BusTracker = ({ scheduleId, onClose }) => {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [eta, setETA] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const refreshInterval = useRef(null);

  useEffect(() => {
    getCurrentPosition()
      .then(pos => {
        setUserLocation({
          latitude: pos.latitude,
          longitude: pos.longitude
        });
      })
      .catch(err => {
        console.error('Error getting user location:', err);
      });
  }, []);

  useEffect(() => {
    if (location && userLocation) {
      const dist = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        parseFloat(location.latitude),
        parseFloat(location.longitude)
      );
      setDistance(dist);
      
      if (location.speed > 0) {
        setETA(calculateETA(dist, location.speed));
      }
    }
  }, [location, userLocation]);

  const loadBusLocation = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await transport.getBusLocation(scheduleId);
      setLocation(response.data);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load bus location');
      console.error('Error loading bus location:', err);
    } finally {
      setLoading(false);
    }
  }, [scheduleId]);

  useEffect(() => {
    loadBusLocation();

    if (autoRefresh) {
      refreshInterval.current = setInterval(loadBusLocation, 10000);
    }

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [autoRefresh, scheduleId, loadBusLocation]);

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Never';
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now - then) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const getStatusBadge = () => {
    if (!location) return null;
    
    if (!location.is_gps_enabled) {
      return (
        <div className="status-badge gps-disabled">
          <XCircle size={16} />
          <span>GPS Disabled</span>
        </div>
      );
    }
    
    if (location.is_moving && location.speed > 5) {
      return (
        <div className="status-badge moving">
          <Navigation size={16} />
          <span>Bus is Moving • {location.speed.toFixed(1)} km/h</span>
        </div>
      );
    }
    
    if (location.is_moving && location.speed <= 5) {
      return (
        <div className="status-badge slow">
          <Clock size={16} />
          <span>Moving Slowly • {location.speed.toFixed(1)} km/h</span>
        </div>
      );
    }
    
    return (
      <div className="status-badge stopped">
        <AlertCircle size={16} />
        <span>Bus Stopped</span>
      </div>
    );
  };

  if (loading && !location) {
    return (
      <div className="bus-tracker-modal">
        <div className="tracker-content">
          <div className="loading-state">
            <RefreshCw className="spinning" size={48} />
            <p>Loading bus location...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bus-tracker-modal">
        <div className="tracker-content">
          <div className="error-state">
            <AlertCircle size={48} />
            <h3>Unable to Track Bus</h3>
            <p>{error}</p>
            <div className="error-actions">
              <button onClick={loadBusLocation} className="retry-btn">
                <RefreshCw size={16} />
                Try Again
              </button>
              <button onClick={onClose} className="close-btn">
                X
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bus-tracker-modal">
      <div className="tracker-content">
        <div className="tracker-header">
          <div className="tracker-header-left">
            <Bus className="header-icon" size={24} />
            <div>
              <h2>{location?.route_name}</h2>
              <span className="route-number">{location?.route_number}</span>
            </div>
          </div>
          <button onClick={onClose} className="close-modal-btn">
            <XCircle size={30} />
          </button>
        </div>

        {getStatusBadge()}

        {/* Distance & ETA Card */}
        {distance !== null && (
          <div className="distance-eta-card">
            <div className="distance-info">
              <MapPin size={24} />
              <div>
                <span className="label">Distance from You</span>
                <span className="value">{formatDistance(distance)}</span>
              </div>
            </div>
            {eta && location.speed > 0 && (
              <div className="eta-info">
                <Clock size={24} />
                <div>
                  <span className="label">Estimated Arrival</span>
                  <span className="value">{eta}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ✅ GET DIRECTIONS BUTTON - Large and Prominent */}
        <div className="directions-section">
          <button 
            className="get-directions-btn-large"
            onClick={() => {
              if (location?.latitude && location?.longitude) {
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}&travelmode=driving`,
                  '_blank'
                );
              } else {
                alert('GPS location not available');
              }
            }}
            disabled={!location?.latitude || !location?.longitude}
          >
            <Navigation size={20} />
            <div className="btn-text">
              <span className="btn-title">Get Directions</span>
              <span className="btn-subtitle">Open in Google Maps</span>
            </div>
          </button>
        </div>

        {/* Bus Information - Compact */}
        <div className="compact-info-section">
          <h3>Bus Information</h3>
          <div className="compact-info-grid">
            <div className="compact-info-item">
              <Bus size={16} />
              <div>
                <span className="compact-label">Vehicle</span>
                <span className="compact-value">{location?.vehicle_number}</span>
              </div>
            </div>
            
            <div className="compact-info-item">
              <User size={16} />
              <div>
                <span className="compact-label">Driver</span>
                <span className="compact-value">{location?.driver_name}</span>
              </div>
            </div>
            
            <div className="compact-info-item">
              <Calendar size={16} />
              <div>
                <span className="compact-label">Date</span>
                <span className="compact-value">{location?.schedule_date}</span>
              </div>
            </div>
            
            <div className="compact-info-item">
              <Clock size={16} />
              <div>
                <span className="compact-label">Departure</span>
                <span className="compact-value">{location?.departure_time}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Metrics */}
        <div className="metrics-compact">
          <h3>Live Tracking</h3>
          <div className="metrics-row">
            <div className="metric-badge">
              <Gauge size={16} />
              <span>{location?.speed?.toFixed(1)} km/h</span>
            </div>
            <div className="metric-badge">
              <Navigation size={16} />
              <span>{headingToDirection(location?.heading)}</span>
            </div>
            {location?.battery_level && (
              <div className="metric-badge">
                <Battery size={16} />
                <span>{location?.battery_level}%</span>
              </div>
            )}
            <div className="metric-badge">
              <Clock size={16} />
              <span>{formatTimeAgo(lastUpdate)}</span>
            </div>
          </div>
        </div>

        {/* GPS Accuracy */}
        {location?.accuracy && (
          <div className="accuracy-info">
            <CheckCircle size={16} />
            <span>GPS Accuracy: ±{Math.round(location.accuracy)} meters</span>
          </div>
        )}

        {/* Footer with Refresh Controls */}
        <div className="tracker-footer">
          <button
            className={`auto-refresh-btn ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={autoRefresh ? 'spinning' : ''} size={16} />
            {autoRefresh ? 'Auto ON' : 'Auto OFF'}
          </button>
          <button onClick={loadBusLocation} className="manual-refresh-btn">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default BusTracker;