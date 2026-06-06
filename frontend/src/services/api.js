// src/services/api.js - UPDATED WITH BETTER ERROR HANDLING
import axios from 'axios';
const getApiUrl = () => {
  const hostname = window.location.hostname;
  
  // If accessing via localhost or 127.0.0.1, use localhost backend
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8000/api';
  }
  
  // If accessing via network IP, use network IP for backend
  // This automatically works for ANY network IP (192.168.x.x, 10.x.x.x, etc.)
  return `http://${hostname}:8000/api`;
};
const API_URL = getApiUrl();
console.log('🌐 API URL:', API_URL);

axios.defaults.withCredentials = true;
axios.defaults.headers.common['Content-Type'] = 'application/json';


// Create axios instance with credentials
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Get CSRF cookie helper function
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// Add CSRF token to requests
api.interceptors.request.use(
  (config) => {
    const csrftoken = getCookie('csrftoken');
    if (csrftoken) {
      config.headers['X-CSRFToken'] = csrftoken;
    }
    
    // ✅ Log request for debugging
    console.log('🚀 API Request:', {
      method: config.method,
      url: config.url,
      hasCSRF: !!csrftoken,
      contentType: config.headers['Content-Type']
    });
    
    return config;
  },
  (error) => {
    console.error('❌ Request error:', error);
    return Promise.reject(error);
  }
);

// ✅ Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', {
      status: response.status,
      url: response.config.url
    });
    return response;
  },
  (error) => {
    console.error('❌ API Error:', {
      status: error.response?.status,
      url: error.config?.url,
      data: error.response?.data
    });
    return Promise.reject(error);
  }
);

// Auth endpoints
export const auth = {
  // Get CSRF Token
  getCsrfToken: () => api.get('/accounts/csrf/'),
  
  // Passenger registration
  passengerRegisterStep1: (data) => api.post('/accounts/register/passenger/step1/', data),
  
  // Staff registration
  staffRegisterStep1: (data) => api.post('/accounts/register/staff/step1/', data),
  
  // Verify OTP
  verifyOTP: (data) => api.post('/accounts/verify-otp/', data),
  
  // Complete registration
  completePassengerRegistration: (data) => api.post('/accounts/register/passenger/complete/', data),
  completeStaffRegistration: (data) => api.post('/accounts/register/staff/complete/', data),
  
  // Login/Logout
  login: (data) => api.post('/accounts/login/', data),
  logout: () => api.post('/accounts/logout/'),
  getCurrentUser: () => api.get('/accounts/current-user/'),
};

// Transport endpoints
export const transport = {
  // Admin
  getAdminDashboard: () => api.get('/transport/dashboard/admin/'),
  getEmployees: (params) => api.get('/transport/employees/', { params }),
  getVehicles: (params) => api.get('/transport/vehicles/', { params }),
  getRoutes: (params) => api.get('/transport/routes/', { params }),
  
  // Schedules
  getSchedules: (params) => api.get('/transport/schedules/', { params }),
  updateScheduleStatus: (scheduleId, data) => 
    api.put(`/transport/schedules/${scheduleId}/update-status/`, data),
  
  // Leave requests
  getLeaveRequests: (params) => api.get('/transport/leave-requests/', { params }),
  createLeaveRequest: (data) => api.post('/transport/leave-requests/', data),
  approveLeave: (id, data) => api.put(`/transport/leave-requests/${id}/approve/`, data),
  
  // Complaints
   getComplaints: (params) => api.get('/transport/complaints/', { params }),
  // New method for staff phone verification
  verifyStaffPhone: (data) => {
      return api.post('/transport/verify-staff-phone/', data);
  },
  createComplaint: (data) => {
        // If data is FormData (for file uploads), send with multipart/form-data
        if (data instanceof FormData) {
            return api.post('/transport/complaints/', data, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
        }
        // Otherwise send as JSON
        return api.post('/transport/complaints/', data);
    },
  
  resolveComplaint: (id, data) => api.put(`/transport/complaints/${id}/resolve/`, data),
  
  // 🆕 NEW: Verify passenger phone number
  verifyPassengerPhone: (data) => api.post('/transport/verify-passenger-phone/', data),
  
  
  // Bookings
  getBookings: (params) => api.get('/transport/bookings/', { params }),
  createBooking: (data) => api.post('/transport/bookings/', data),
  cancelBooking: (id, data) => api.put(`/transport/bookings/${id}/cancel/`, data),
  
  // Payroll
  getPayrolls: (params) => api.get('/transport/payrolls/', { params }),
  
  // Districts
  getDistricts: () => api.get('/transport/districts/'),

  // Emergency Notification APIs
  getEmergencyNotifications: () => api.get('/transport/emergency-notifications/'),
  sendEmergencyNotification: (data) => api.post('/transport/emergency-notifications/send/', data),
  getNotificationDetails: (notificationId) => api.get(`/transport/emergency-notifications/${notificationId}/`),

  // NEW: Flag-based seat booking
  getSeatMatrixWithFlags: (scheduleId) => 
    api.get(`/transport/seat-matrix/${scheduleId}/`),
    
  checkSeatAvailabilityWithFlags: (data) => 
    api.post('/transport/check-seat-availability/', data),
    
  createBookingWithFlags: (data) => 
    api.post('/transport/bookings/create-with-flags/', data),
    
  cancelBookingWithFlags: (bookingId) => 
    api.put(`/transport/bookings/${bookingId}/cancel-with-flags/`),

  // GPS TRACKING METHODS - ADD THESE
  updateBusLocation: (locationData) => 
    api.post('/transport/gps/update/', locationData),
  
  getBusLocation: (scheduleId) => 
    api.get(`/transport/gps/location/${scheduleId}/`),
  
  getAllBusLocations: (params = {}) => 
    api.get('/transport/gps/locations/', { params }),
  
  getBusLocationHistory: (scheduleId, params = {}) => 
    api.get(`/transport/gps/history/${scheduleId}/`, { params }),
  
  deleteBusLocation: (scheduleId) => 
    api.delete(`/transport/gps/delete/${scheduleId}/`),

  // Mock Payment APIs
  createMockPaymentOrder: (data) => 
    api.post('/transport/mock-payment/create-order/', data),
  
  processMockPayment: (data) => 
    api.post('/transport/mock-payment/process/', data),
  
  verifyMockPayment: (data) => 
    api.post('/transport/mock-payment/verify/', data),
  
  confirmMockBooking: (data) => 
    api.post('/transport/mock-payment/confirm-booking/', data),
  
  getUserMockPayments: () => 
    api.get('/transport/mock-payment/my-payments/'),
  
  cancelBookingWithMockRefund: (bookingId, data) => 
    api.post(`/transport/booking/${bookingId}/cancel-mock-refund/`, data),

  getDrowsinessStats: (driverId, days) => 
  api.get('/drowsiness/stats/', { 
    params: { driver_id: driverId, days: days } 
  }),
};
export const drowsinessAPI = {
  // Alerts
  createAlert: (data) => api.post('/drowsiness/alerts/create/', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getAlerts: (params) => api.get('/drowsiness/alerts/', { params }),
  getAlertDetail: (alertId) => api.get(`/drowsiness/alerts/${alertId}/`),
  updateAlertStatus: (alertId, data) => api.patch(`/drowsiness/alerts/${alertId}/update/`, data),
  deleteAlert: (alertId) => api.delete(`/drowsiness/alerts/${alertId}/delete/`),
  
  // Sessions
  startSession: (data) => api.post('/drowsiness/sessions/start/', data),
  endSession: (sessionId) => api.post(`/drowsiness/sessions/${sessionId}/end/`),
  updateSessionStats: (sessionId, data) => api.patch(`/drowsiness/sessions/${sessionId}/update-stats/`, data),
  getSessions: (params) => api.get('/drowsiness/sessions/', { params }),
  getSessionSummary: (params) => api.get('/drowsiness/sessions/summary/', { params }),
  
  // Statistics & Dashboard
  getDriverStats: (driverId, params) => api.get('/drowsiness/stats/', { 
    params: { driver_id: driverId, ...params } 
  }),
  getDashboardSummary: () => api.get('/drowsiness/dashboard/'),
};
// Heart Rate Monitor API
export const heartRateAPI = {
  // List all alerts (supports ?status=NEW &alert_type=HIGH &driver_id=3)
  getAlerts: (params) => api.get('/heart-monitor/alerts/', { params }),

  // Single alert detail
  getAlertDetail: (alertId) => api.get(`/heart-monitor/alerts/${alertId}/`),

  // Update status: { status: 'ACKNOWLEDGED' | 'RESOLVED', notes: '...' }
  updateAlertStatus: (alertId, data) =>
    api.patch(`/heart-monitor/alerts/${alertId}/status/`, data),

  // Dashboard summary (counts + recent 5 new alerts)
  getSummary: () => api.get('/heart-monitor/summary/'),
  getMyAlerts: () => api.get('/heart-monitor/alerts/my/'),
};
export const alcoholAPI = {
  getAlerts:         (params)        => api.get('/alcohol/alerts/', { params }),
  getAlertDetail:    (alertId)       => api.get(`/alcohol/alerts/${alertId}/`),
  updateAlertStatus: (alertId, data) => api.patch(`/alcohol/alerts/${alertId}/status/`, data),
  getSummary:        ()              => api.get('/alcohol/summary/'),
  getMyAlerts:       ()              => api.get('/alcohol/my-alerts/'),
};
export default api;