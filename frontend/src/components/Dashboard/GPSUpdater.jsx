// GPSUpdater.jsx - COMPLETE FIXED VERSION
import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Power, Zap, Gauge, Battery, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { getCurrentPosition, watchPosition, clearWatch, getBatteryLevel } from '../../utils/geolocation';
import { transport } from '../../services/api';
import './GPSUpdater.css';

const GPSUpdater = ({ schedule }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [updateCount, setUpdateCount] = useState(0);
  
  // ✅ FIX 1: Use refs to avoid stale closures
  const watchId = useRef(null);
  const updateInterval = useRef(null);
  const currentPositionRef = useRef(null);  // ✅ NEW: Store position in ref

  // ✅ FIX 2: Update battery level continuously
  useEffect(() => {
    // Initial battery check
    getBatteryLevel().then(level => {
      setBatteryLevel(level);
    });
    
    // ✅ NEW: Refresh battery every 30 seconds
    const batteryInterval = setInterval(async () => {
      const level = await getBatteryLevel();
      setBatteryLevel(level);
    }, 30000);
    
    return () => clearInterval(batteryInterval);
  }, []);

  const startTracking = async () => {
    try {
      setError('');
      
      // Get initial position
      const position = await getCurrentPosition();
      setCurrentPosition(position);
      currentPositionRef.current = position;  // ✅ FIXED: Store in ref
      
      // Send first update
      await sendLocationUpdate(position);
      
      // Watch for position changes
      watchId.current = watchPosition(async (pos) => {
        setCurrentPosition(pos);
        currentPositionRef.current = pos;  // ✅ FIXED: Update ref
      });
      
      // ✅ FIXED: Auto-update every 30 seconds using ref
      updateInterval.current = setInterval(async () => {
        if (currentPositionRef.current) {  // ✅ FIXED: Use ref, not state
          await sendLocationUpdate(currentPositionRef.current);
        }
      }, 30000);
      
      setIsTracking(true);
    } catch (err) {
      setError(err.message || 'Failed to start GPS tracking');
      console.error('Error starting GPS tracking:', err);
    }
  };

  const stopTracking = () => {
    if (watchId.current) {
      clearWatch(watchId.current);
      watchId.current = null;
    }
    
    if (updateInterval.current) {
      clearInterval(updateInterval.current);
      updateInterval.current = null;
    }
    
    setIsTracking(false);
    currentPositionRef.current = null;  // ✅ FIXED: Clear ref
  };

  const sendLocationUpdate = async (position) => {
    try {
      // ✅ FIX 3: Null check BEFORE accessing properties
      if (!position) {
        console.warn('Position is null, skipping update');
        return;
      }
      
      // ✅ FIX 4: Get battery and update display
      const battery = await getBatteryLevel();
      setBatteryLevel(battery);  // ✅ FIXED: Update UI battery
      
      // ✅ FIX 5: Round coordinates to 6 decimals
    const response = await transport.updateBusLocation({
      schedule_id: schedule.id,
      latitude: parseFloat(position.latitude.toFixed(6)),
      longitude: parseFloat(position.longitude.toFixed(6)),
      speed: position.speed || 0,
      heading: position.heading || 0,
      accuracy: Math.round(position.accuracy || 0),
      is_moving: (position.speed || 0) > 1,
      battery_level: battery || 0,
      is_gps_enabled: true
    });

    // If hardware GPS is active, stop phone tracking automatically
    if (response?.data?.status === 'skipped') {
      setError('📡 Hardware GPS is active — phone tracking disabled automatically.');
      stopTracking();
      return;
    }

    setLastUpdate(new Date());
    setUpdateCount(prev => prev + 1);
    setError(''); 
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update location');
      console.error('Error updating location:', err);
    }
  };

  const manualUpdate = async () => {
    try {
      setError('');
      const position = await getCurrentPosition();
      setCurrentPosition(position);
      currentPositionRef.current = position;  // ✅ FIXED: Update ref
      await sendLocationUpdate(position);
    } catch (err) {
      setError(err.message || 'Failed to get location');
    }
  };

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Never';
    const now = new Date();
    const seconds = Math.floor((now - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const headingToDirection = (heading) => {
    if (!heading && heading !== 0) return 'Unknown';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(heading / 45) % 8;
    return directions[index];
  };

  return (
    <div className="gps-updater-card">
      <div className="gps-updater-header">
        <div className="header-left">
          <MapPin size={24} className="header-icon" />
          <div>
            <h3>GPS Tracking</h3>
            <span className="status-text">
              {isTracking ? (
                <>
                  <Zap size={14} className="status-active" />
                  Active
                </>
              ) : (
                <>
                  <Power size={14} className="status-inactive" />
                  Inactive
                </>
              )}
            </span>
          </div>
        </div>
        <div className="header-right">
          {isTracking ? (
            <button onClick={stopTracking} className="stop-btn">
              <Power size={16} />
              Stop Tracking
            </button>
          ) : (
            <button onClick={startTracking} className="start-btn">
              <Navigation size={16} />
              Start Tracking
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {isTracking && currentPosition && (
        <>
          <div className="location-info">
            <div className="info-row">
              <span className="info-label">Latitude:</span>
              <span className="info-value">{currentPosition.latitude.toFixed(6)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Longitude:</span>
              <span className="info-value">{currentPosition.longitude.toFixed(6)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Accuracy:</span>
              <span className="info-value">±{Math.round(currentPosition.accuracy)}m</span>
            </div>
          </div>

          <div className="gps-metrics">
            <div className="metric-box">
              <Gauge size={20} />
              <div>
                <span className="metric-label">Speed</span>
                <span className="metric-value">
                  {(currentPosition.speed || 0).toFixed(1)} km/h
                </span>
              </div>
            </div>
            <div className="metric-box">
              <Navigation size={20} />
              <div>
                <span className="metric-label">Direction</span>
                <span className="metric-value">
                  {headingToDirection(currentPosition.heading)}
                </span>
              </div>
            </div>
            {batteryLevel !== null && (
              <div className="metric-box">
                <Battery size={20} />
                <div>
                  <span className="metric-label">Battery</span>
                  <span className="metric-value">{batteryLevel}%</span>
                </div>
              </div>
            )}
          </div>

          <div className="update-stats">
            <div className="stat-item">
              <Clock size={16} />
              <span>Last update: {formatTimeAgo(lastUpdate)}</span>
            </div>
            <div className="stat-item">
              <RefreshCw size={16} />
              <span>{updateCount} updates sent</span>
            </div>
          </div>

          <button onClick={manualUpdate} className="manual-update-btn">
            <RefreshCw size={16} />
            Update Now
          </button>

          <div className="info-message">
            <AlertCircle size={16} />
            <span>Keep this page open while driving. GPS updates will continue in the background.</span>
          </div>
        </>
      )}
    </div>
  );
};

export default GPSUpdater;