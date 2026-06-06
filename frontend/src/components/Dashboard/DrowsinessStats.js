import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Activity, Clock, 
  AlertTriangle, Calendar, BarChart3, Users,
  Eye, Timer, Award, ChevronDown
} from 'lucide-react';
import { drowsinessAPI } from '../../services/api';
import './DrowsinessStats.css';

const DrowsinessStats = ({ driverId }) => {
  const [stats, setStats] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('7days');

  useEffect(() => {
    const loadData = () => {
      if (driverId) {
        loadDriverStats();
      } else {
        loadDashboard();
      }
    };

    loadData(); // first load

    const interval = setInterval(() => {
      loadData(); // auto refresh every 30 sec
    }, 30000);

    return () => clearInterval(interval); // cleanup
  }, [driverId, timeRange]);

  const loadDriverStats = async () => {
    setLoading(true);
    try {
      const response = await drowsinessAPI.getDriverStats(driverId, {
        days: timeRange === '7days' ? 7 : timeRange === '30days' ? 30 : 1
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await drowsinessAPI.getDashboardSummary();
      setDashboard(response.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate trend (mock data - replace with actual comparison)
  const getTrend = (current, previous) => {
    if (!previous) return null;
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      isUp: change > 0
    };
  };

  if (loading) return <div className="loading">Loading statistics...</div>;

  // Show driver-specific stats
  if (driverId && stats) {
    return (
      <div className="drowsiness-stats">
        <div className="stats-header">
          <h3>Drowsiness Statistics</h3>
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <AlertTriangle size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Total Alerts</span>
              <span className="stat-value">{stats.total_alerts}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Activity size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Avg EAR</span>
              <span className="stat-value">{stats.avg_ear?.toFixed(3) || 'N/A'}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Avg Closure Duration</span>
              <span className="stat-value">{stats.avg_closure?.toFixed(1) || 'N/A'}s</span>
            </div>
          </div>

          <div className="stat-card severity-breakdown">
            <h4>Severity Breakdown</h4>
            <div className="severity-list">
              <div className="severity-item">
                <span>Critical:</span>
                <strong style={{color: '#991b1b'}}>{stats.critical_alerts || 0}</strong>
              </div>
              <div className="severity-item">
                <span>High:</span>
                <strong style={{color: '#ef4444'}}>{stats.high_alerts || 0}</strong>
              </div>
              <div className="severity-item">
                <span>Medium:</span>
                <strong style={{color: '#f97316'}}>{stats.medium_alerts || 0}</strong>
              </div>
              <div className="severity-item">
                <span>Low:</span>
                <strong style={{color: '#fbbf24'}}>{stats.low_alerts || 0}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show admin dashboard summary (WITHOUT SAFETY TIPS)
  if (dashboard) {
    return (
      <div className="drowsiness-stats-page">
        {/* Header with Time Range Filter */}
        <div className="stats-header">
          <h3>Drowsiness Detection Overview</h3>
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>
        </div>
        
        {/* Main Stats Grid */}
        <div className="dashboard-grid">
          <div className="dashboard-card highlight-card">
            <div className="card-icon" style={{background: '#fee2e2', color: '#dc2626'}}>
              <AlertTriangle size={32} />
            </div>
            <div className="card-content">
              <span className="card-label">Active Alerts</span>
              <div className="card-value-row">
                <span className="card-value">{dashboard.active_alerts}</span>
                {dashboard.active_alerts > 0 && (
                  <span className="alert-badge">Requires Action</span>
                )}
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="card-icon" style={{background: '#dbeafe', color: '#2563eb'}}>
              <TrendingUp size={32} />
            </div>
            <div className="card-content">
              <span className="card-label">Total Alerts Today</span>
              <div className="card-value-row">
                <span className="card-value">{dashboard.today_alerts}</span>
                {getTrend(dashboard.today_alerts, dashboard.yesterday_alerts) && (
                  <span className={`trend-badge ${getTrend(dashboard.today_alerts, dashboard.yesterday_alerts).isUp ? 'trend-up' : 'trend-down'}`}>
                    {getTrend(dashboard.today_alerts, dashboard.yesterday_alerts).isUp ? '↑' : '↓'}
                    {getTrend(dashboard.today_alerts, dashboard.yesterday_alerts).value}%
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="card-icon" style={{background: '#f3e8ff', color: '#9333ea'}}>
              <BarChart3 size={32} />
            </div>
            <div className="card-content">
              <span className="card-label">This Week</span>
              <span className="card-value">{dashboard.week_alerts}</span>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="card-icon" style={{background: '#fef3c7', color: '#f59e0b'}}>
              <Calendar size={32} />
            </div>
            <div className="card-content">
              <span className="card-label">This Month</span>
              <span className="card-value">{dashboard.month_alerts}</span>
            </div>
          </div>
        </div>

        {/* Additional Metrics Row */}
        <div className="secondary-stats">
          <div className="secondary-stat-card">
            <Eye size={20} />
            <div>
              <span className="secondary-label">Avg EAR</span>
              <span className="secondary-value">{dashboard.avg_ear?.toFixed(3) || 'N/A'}</span>
            </div>
          </div>

          <div className="secondary-stat-card">
            <Timer size={20} />
            <div>
              <span className="secondary-label">Avg Closure</span>
              <span className="secondary-value">{dashboard.avg_closure?.toFixed(1) || 'N/A'}s</span>
            </div>
          </div>

          <div className="secondary-stat-card">
            <Users size={20} />
            <div>
              <span className="secondary-label">Drivers Monitored</span>
              <span className="secondary-value">{dashboard.total_drivers || 0}</span>
            </div>
          </div>

          <div className="secondary-stat-card">
            <Award size={20} />
            <div>
              <span className="secondary-label">Safest Driver</span>
              <span className="secondary-value">{dashboard.safest_driver || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Severity Distribution */}
        <div className="severity-section">
          <h4>Alert Severity Distribution</h4>
          <div className="severity-bars">
            <div className="severity-bar-item">
              <div className="severity-bar-header">
                <span className="severity-bar-label">Critical</span>
                <span className="severity-bar-count">{dashboard.critical_count || 0}</span>
              </div>
              <div className="severity-bar-track">
                <div 
                  className="severity-bar-fill critical-fill" 
                  style={{width: `${((dashboard.critical_count || 0) / (dashboard.total_alerts || 1)) * 100}%`}}
                ></div>
              </div>
            </div>

            <div className="severity-bar-item">
              <div className="severity-bar-header">
                <span className="severity-bar-label">High</span>
                <span className="severity-bar-count">{dashboard.high_count || 0}</span>
              </div>
              <div className="severity-bar-track">
                <div 
                  className="severity-bar-fill high-fill" 
                  style={{width: `${((dashboard.high_count || 0) / (dashboard.total_alerts || 1)) * 100}%`}}
                ></div>
              </div>
            </div>

            <div className="severity-bar-item">
              <div className="severity-bar-header">
                <span className="severity-bar-label">Medium</span>
                <span className="severity-bar-count">{dashboard.medium_count || 0}</span>
              </div>
              <div className="severity-bar-track">
                <div 
                  className="severity-bar-fill medium-fill" 
                  style={{width: `${((dashboard.medium_count || 0) / (dashboard.total_alerts || 1)) * 100}%`}}
                ></div>
              </div>
            </div>

            <div className="severity-bar-item">
              <div className="severity-bar-header">
                <span className="severity-bar-label">Low</span>
                <span className="severity-bar-count">{dashboard.low_count || 0}</span>
              </div>
              <div className="severity-bar-track">
                <div 
                  className="severity-bar-fill low-fill" 
                  style={{width: `${((dashboard.low_count || 0) / (dashboard.total_alerts || 1)) * 100}%`}}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Critical Alerts */}
        {dashboard.recent_alerts && dashboard.recent_alerts.length > 0 && (
          <div className="recent-alerts-section">
            <h4>Recent Critical Alerts</h4>
            <div className="recent-alerts-list">
              {dashboard.recent_alerts.map(alert => (
                <div key={alert.id} className="recent-alert-item">
                  <div className="alert-info-group">
                    <div className="alert-driver">{alert.driver_name}</div>
                    <div className="alert-details">
                      {alert.vehicle_number && <span className="alert-vehicle">{alert.vehicle_number}</span>}
                      <span className="alert-time">{alert.time_since_detection}</span>
                    </div>
                  </div>
                  <div className="alert-severity-badge" style={{
                    background: alert.severity === 'CRITICAL' ? '#991b1b' : '#ef4444',
                    color: 'white'
                  }}>
                    {alert.severity}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SAFETY TIPS SECTION REMOVED */}
      </div>
    );
  }

  return null;
};

export default DrowsinessStats;