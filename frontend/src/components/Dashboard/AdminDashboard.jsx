import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Bus, Route as RouteIcon, AlertCircle, Calendar,
  DollarSign, Search, LogOut, Menu, X, Bell, Check, XCircle, Ticket,
   User,  Phone,  Clock, FileText, Trash2,MapPin,
  Image, Video, CheckCircle, AlertTriangle, Send,Info, CreditCard,Activity,Heart,EyeOff
} from 'lucide-react';
import GPSTracking from './GPSTracking';
import { transport, auth } from '../../services/api';
import { getUser, removeUser } from '../../utils/auth';
import './Dashboard.css';
import DrowsinessAlerts from './DrowsinessAlerts';
import DrowsinessStats from './DrowsinessStats';
import { drowsinessAPI,heartRateAPI } from '../../services/api';
import AlcoholAlerts from './AlcoholAlerts';
import { alcoholAPI } from '../../services/api';
import HeartRateAlerts from './HeartRateAlerts';
const spinKeyframes = `
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;


// Inject the animation into the page
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = spinKeyframes;
  document.head.appendChild(styleSheet);
}
const AdminDashboard = () => {
  const navigate = useNavigate();
  const user = getUser();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [localSearch, setLocalSearch] = useState('');
  // State for complaint details view
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showComplaintDetails, setShowComplaintDetails] = useState(false);
  const [complaintSubTab, setComplaintSubTab] = useState('passenger'); // 'passenger' or 'staff'
  // Data states
  const [dashboardData, setDashboardData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [emergencyNotifications, setEmergencyNotifications] = useState([]);
  const [selectedScheduleForAlert, setSelectedScheduleForAlert] = useState(null);
  const [emergencyMessage, setEmergencyMessage] = useState('');
  const [hospitalInfo, setHospitalInfo] = useState('');
  const [showEmergencyForm, setShowEmergencyForm] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [notificationDetails, setNotificationDetails] = useState(null);
  const [emergencySearchTerm, setEmergencySearchTerm] = useState('');
  const [payments, setPayments] = useState([]);
  const [selectedHeartRateAlertId, setSelectedHeartRateAlertId] = useState(null);
  const [selectedAlcoholAlertId, setSelectedAlcoholAlertId] = useState(null);
  const loadPayments = async () => {
    try {
      const response = await transport.getAllMockPayments();
      setPayments(response.data);
    } catch (error) {
      console.error('Error loading payments:', error);
    }
  };

 


  const loadDashboardData = async () => {
    try {
      // Load transport dashboard data
      const transportResponse = await transport.getAdminDashboard();
      
      // Load drowsiness dashboard data
      const drowsinessResponse = await drowsinessAPI.getDashboardSummary();
      //fetch heart rate dashboard data
      let hrSummary = {};
      try {
        const hrResponse = await heartRateAPI.getSummary();
        hrSummary = hrResponse.data;
      } catch (e) { /* ignore if not yet set up */ }
      let alcoholSummary = {};
      try {
        const alcoholRes = await alcoholAPI.getSummary();
        alcoholSummary = alcoholRes.data;
      } catch (e) {}
      // Merge both datasets
      const mergedData = {
        ...transportResponse.data,
        // Add drowsiness-specific fields
        high_priority_drowsiness_alerts: drowsinessResponse.data.high_priority_drowsiness_alerts || [],
        high_priority_drowsiness_count: drowsinessResponse.data.high_priority_drowsiness_count || 0,
        // You can also add other drowsiness stats if needed
        drowsiness_active_alerts: drowsinessResponse.data.active_alerts || 0,
        drowsiness_today_alerts: drowsinessResponse.data.today_alerts || 0,
        hr_new_alerts:   hrSummary.new_alerts   || 0,
        hr_today_alerts: hrSummary.today_alerts || 0,
        hr_recent_alerts: hrSummary.recent_alerts || [],
        alcohol_new_alerts:    alcoholSummary.new_alerts   || 0,
        alcohol_today_alerts:  alcoholSummary.today_alerts || 0, 
        alcohol_recent_alerts: alcoholSummary.recent_alerts || [], 
      };
      
      setDashboardData(mergedData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };


  const loadDistricts = async () => {
    try {
      const response = await transport.getDistricts();
      setDistricts(response.data);
    } catch (error) {
      console.error('Error loading districts:', error);
    }
  };

  const getDistrictName = (districtInput) => {
    if (!districtInput) return 'N/A';
    if (typeof districtInput === 'string' && !districtInput.includes('_') && districtInput.length > 3) {
      return districtInput;
    }
    const district = districts.find(d =>
      d.district_code === districtInput ||
      d.id === districtInput ||
      d.name === districtInput
    );
    return district ? district.name : districtInput;
  };

  const loadTabData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedDistrict) params.district = selectedDistrict;
      if (searchTerm) params.search = searchTerm;

      switch (activeTab) {
        case 'employees':
          const empRes = await transport.getEmployees(params);
          setEmployees(empRes.data);
          break;
        case 'vehicles':
          const vehRes = await transport.getVehicles(params);
          setVehicles(vehRes.data);
          break;
        case 'routes':
          const routeRes = await transport.getRoutes(params);
          setRoutes(routeRes.data);
          break;
        case 'schedules':
          const schedRes = await transport.getSchedules(params);
          setSchedules(schedRes.data);
          break;
        case 'leaves':
          const leaveRes = await transport.getLeaveRequests(params);
          setLeaveRequests(leaveRes.data);
          break;
        case 'complaints':
          const compRes = await transport.getComplaints(params);
          setComplaints(compRes.data);
          break;
        case 'bookings':
          const bookRes = await transport.getBookings(params);
          setBookings(bookRes.data);
          break;
        case 'payroll':
          const payRes = await transport.getPayrolls(params);
          setPayrolls(payRes.data);
          break;
        case 'payments':  // ← ADD THIS
          await loadPayments();
          break;

        case 'emergency':
          // ✅ FIX: Load both emergency notifications AND schedules
          const emergencyRes = await transport.getEmergencyNotifications();
          setEmergencyNotifications(emergencyRes.data);
          
          // Load schedules for the dropdown
          const schedulesRes = await transport.getSchedules({});
          setSchedules(schedulesRes.data);
          break;
        case 'heart-rate':          // ← ADD THESE 2 LINES
          break;
        case 'drowsiness':
          const drowsRes = await drowsinessAPI.getAlerts();
          // pass to DrowsinessAlerts via state/prop if needed
          break;
        case 'drowsiness-stats':
          // DrowsinessStats fetches internally, just trigger a re-mount signal or use a key prop
          break;
        case 'alcohol':
          // AlcoholAlerts self-fetches; you can trigger via a refresh key prop
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedDistrict, searchTerm]);


  useEffect(() => {
    loadDashboardData();
    loadDistricts();
  }, []);
  // Refresh dashboard data when returning to overview tab
  useEffect(() => {
    if (activeTab === 'overview') {
      loadDashboardData();
    }
  }, [activeTab]);
  useEffect(() => {
    let refreshInterval;
    
    if (activeTab === 'overview') {
      refreshInterval = setInterval(() => {
        console.log('🔄 Auto-refreshing overview dashboard for new alerts...');
        loadDashboardData();
      }, 10000);
    } else if (activeTab === 'emergency') {
      refreshInterval = setInterval(() => {
        console.log('🔄 Auto-refreshing emergency notifications...');
        loadTabData();
      }, 15000);
    } else if (activeTab === 'drowsiness') {
      // Drowsiness alerts - safety critical (20 seconds)
      refreshInterval = setInterval(() => {
        console.log('🔄 Auto-refreshing drowsiness alerts...');
        loadDashboardData(); // refreshes the badge count on overview too
      }, 20000);
    } else if (activeTab === 'drowsiness-stats') {
      refreshInterval = setInterval(() => {
        console.log('🔄 Auto-refreshing drowsiness stats...');
      }, 60000);
    } else if (activeTab === 'heart-rate') {
      // HeartRateAlerts component handles its own refresh
    } else if (activeTab === 'alcohol') {
      // AlcoholAlerts component handles its own refresh (30s internally)
    } else if (activeTab === 'complaints' || activeTab === 'bookings') {
      refreshInterval = setInterval(() => {
        console.log(`🔄 Auto-refreshing ${activeTab}...`);
        loadTabData();
      }, 30000);
    } else if (activeTab === 'leaves') {
      refreshInterval = setInterval(() => {
        console.log('🔄 Auto-refreshing leave requests...');
        loadTabData();
      }, 45000);
    } else if (
      activeTab === 'employees' || activeTab === 'vehicles' ||
      activeTab === 'routes' || activeTab === 'schedules' ||
      activeTab === 'payroll' || activeTab === 'payments'
    ) {
      refreshInterval = setInterval(() => {
        console.log(`🔄 Auto-refreshing ${activeTab}...`);
        loadTabData();
      }, 60000);
    }

    // Cleanup when tab changes or component unmounts
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [activeTab, loadTabData]);
  useEffect(() => {
    if (activeTab !== 'overview') {
      loadTabData();
    }
  }, [activeTab, selectedDistrict, searchTerm,loadTabData]);

  useEffect(() => {
  const timer = setTimeout(() => {
    setSearchTerm(localSearch);
  }, 800); // Wait 0.8 seconds after you stop typing

  return () => clearTimeout(timer);
  }, [localSearch]);

  const handleLogout = async () => {
    try {
      await auth.logout();
      removeUser();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleLeaveAction = async (leaveId, action) => {
    try {
      await transport.approveLeave(leaveId, {
        action,
        admin_remarks: action === 'approve' ? 'Approved' : 'Rejected'
      });
      loadTabData();
      loadDashboardData();
    } catch (error) {
      console.error('Error processing leave:', error);
    }
  };

  const handleResolveComplaint = async (complaintId, status) => {
    try {
      // Different admin responses for different statuses
      let admin_response = '';
      let successMessage = '';
      
      switch(status) {
        case 'IN_PROGRESS':
          admin_response = 'Complaint is under investigation. We are working on resolving this issue.';
          successMessage = 'Complaint Status Updated!\n\nThe complaint has been marked as IN PROGRESS.\nOur team is now investigating this issue.';
          break;
        case 'RESOLVED':
          admin_response = 'Issue has been successfully addressed and resolved.';
          successMessage = 'Complaint Successfully Resolved!\n\nThe issue has been addressed and the complaint is now closed.\nThank you for your prompt action.';
          break;
        case 'CLOSED':
          admin_response = 'Complaint rejected as invalid/fake after verification.';
          successMessage = ' Complaint Rejected!\n\nThis complaint has been marked as FAKE/INVALID after verification.\nThe case has been closed.';
          break;
        default:
          admin_response = 'Status updated';
          successMessage = ' Complaint status updated successfully!';
      }
      
      await transport.resolveComplaint(complaintId, {
        status,
        admin_response
      });
      loadTabData();
      loadDashboardData();
      setShowComplaintDetails(false);
      setSelectedComplaint(null);
      alert(successMessage);
    } catch (error) {
      console.error('Error processing complaint:', error);
      alert(' Error: Failed to process complaint.\n\nPlease check your connection and try again.');
    }
  };

  const handleViewComplaint = (complaint) => {
    setSelectedComplaint(complaint);
    setShowComplaintDetails(true);
  };

  const handleCloseComplaintDetails = () => {
    setShowComplaintDetails(false);
    setSelectedComplaint(null);
  };

  const handleSendEmergencyAlert = async () => {
    if (!selectedScheduleForAlert) {
      alert('⚠️ Please select a schedule first');
      return;
    }

    if (!emergencyMessage.trim()) {
      alert('⚠️ Please enter an emergency message');
      return;
    }

    if (!window.confirm(
      `⚠️ WARNING: This will send emergency notifications to ALL passengers with active bookings.\n\n` +
      `Schedule: ${selectedScheduleForAlert.route_details?.route_name}\n` +
      `Date: ${selectedScheduleForAlert.schedule_date}\n\n` +
      `Are you sure you want to proceed?`
    )) {
      return;
    }

    setSendingAlert(true);
    try {
      const response = await transport.sendEmergencyNotification({
        schedule_id: selectedScheduleForAlert.id,
        message: emergencyMessage,
        hospital_info: hospitalInfo
      });

      alert(
        `✅ Emergency Alert Sent Successfully!\n\n` +
        `Total Recipients: ${response.data.total_recipients}\n` +
        `Successful: ${response.data.successful_sends}\n` +
        `Failed: ${response.data.failed_sends}\n\n` +
        `Recipients have been notified on their alternate contact numbers.`
      );

      // Reset form
      setEmergencyMessage('');
      setHospitalInfo('');
      setSelectedScheduleForAlert(null);
      setShowEmergencyForm(false);

      // Reload notifications
      loadTabData();
    } catch (error) {
      console.error('Error sending emergency alert:', error);
      alert('❌ Failed to send emergency alert. Please try again.');
    } finally {
      setSendingAlert(false);
    }
  };

  const handleViewNotificationDetails = async (notification) => {
    try {
      const response = await transport.getNotificationDetails(notification.id);
      setNotificationDetails(response.data);
    } catch (error) {
      console.error('Error loading notification details:', error);
      alert('Failed to load notification details');
    }
  };

  const toggleEmergencyForm = async () => {
    const newShowFormState = !showEmergencyForm;
    setShowEmergencyForm(newShowFormState);
    
    // If opening the form, load schedules
    if (newShowFormState) {
      console.log('Loading schedules for emergency form...');
      try {
        const schedulesRes = await transport.getSchedules({});
        console.log('Loaded schedules:', schedulesRes.data);
        setSchedules(schedulesRes.data);
      } catch (error) {
        console.error('Error loading schedules:', error);
        alert('Failed to load schedules. Please try again.');
      }
    } else {
      // Reset form when closing
      setEmergencyMessage('');
      setHospitalInfo('');
      setSelectedScheduleForAlert(null);
    }
  };
  
  const getPriorityColor = (priority) => {
    const colors = {
      'EMERGENCY': 'red',
      'HIGH': 'orange',
      'MEDIUM': 'yellow',
      'LOW': 'green'
    };
    return colors[priority] || 'gray';
  };

  const getStatusColor = (status) => {
    const colors = {
      'PENDING': 'yellow',
      'APPROVED': 'green',
      'REJECTED': 'red',
      'CONFIRMED': 'green',
      'CANCELLED': 'red',
      'COMPLETED': 'blue',
      'RESOLVED': 'green',
      'IN_PROGRESS': 'blue',
      'CLOSED': 'gray'
    };
    return colors[status] || 'gray';
  };

  // Payment helper functions
  const getPaymentStatusColor = (status) => {
    const colors = {
      'SUCCESS': '#10b981',
      'COMPLETED': '#10b981',
      'PENDING': '#f59e0b',
      'FAILED': '#ef4444',
      'REFUNDED': '#8b5cf6'
    };
    return colors[status?.toUpperCase()] || '#6b7280';
  };

  const getPaymentMethodIcon = (method) => {
    if (!method) return '💳';
    const methodLower = method.toLowerCase();
    if (methodLower.includes('card') || methodLower.includes('credit') || methodLower.includes('debit')) {
      return '💳';
    } else if (methodLower.includes('upi')) {
      return '📱';
    } else if (methodLower.includes('wallet')) {
      return '👛';
    }
    return '💰';
  };

  const renderPaymentDetails = (paymentDetails) => {
    if (!paymentDetails) {
      return <span className="text-muted">No payment info</span>;
    }

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minWidth: '200px',
        fontSize: '12px'
      }}>
        {/* Payment Status */}
        {paymentDetails.payment_status && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            background: `${getPaymentStatusColor(paymentDetails.payment_status)}20`,
            border: `2px solid ${getPaymentStatusColor(paymentDetails.payment_status)}`,
            borderRadius: '6px',
            fontWeight: '600',
            color: getPaymentStatusColor(paymentDetails.payment_status),
            fontSize: '11px'
          }}>
            <CreditCard size={12} />
            <span>{paymentDetails.payment_status}</span>
          </div>
        )}

        {/* Payment ID */}
        {paymentDetails.payment_id && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '2px 0',
            color: '#374151',
            fontSize: '11px'
          }}>
            <strong style={{ minWidth: '50px', color: '#6b7280' }}>ID:</strong>
            <span style={{
              fontFamily: 'monospace',
              fontSize: '10px',
              background: '#f3f4f6',
              padding: '2px 4px',
              borderRadius: '3px',
              wordBreak: 'break-all'
            }}>
              {paymentDetails.payment_id}
            </span>
          </div>
        )}

        {/* Payment Method */}
        {paymentDetails.payment_method && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '2px 0',
            color: '#374151',
            fontSize: '11px'
          }}>
            <strong style={{ minWidth: '50px', color: '#6b7280' }}>Method:</strong>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}>
              {getPaymentMethodIcon(paymentDetails.payment_method)}
              {paymentDetails.payment_method}
            </span>
          </div>
        )}

        {/* Transaction Date */}
        {paymentDetails.transaction_date && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '2px 0',
            color: '#374151',
            fontSize: '11px'
          }}>
            <strong style={{ minWidth: '50px', color: '#6b7280' }}>Date:</strong>
            <span style={{ fontSize: '10px' }}>
              {new Date(paymentDetails.transaction_date).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        )}

        {/* Refund Info (if refunded) */}
        {paymentDetails.refund_id && (
          <div style={{
            marginTop: '6px',
            padding: '8px',
            background: '#f3e8ff',
            border: '2px solid #8b5cf6',
            borderRadius: '6px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              color: '#5b21b6',
              fontWeight: '600',
              marginBottom: '4px',
              fontSize: '11px'
            }}>
              <span>🔄</span>
              <span>REFUND DETAILS</span>
            </div>
            
            {/* Refund ID */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 0',
              color: '#374151',
              fontSize: '10px'
            }}>
              <strong style={{ minWidth: '50px', color: '#6b21a8' }}>Ref ID:</strong>
              <span style={{
                fontFamily: 'monospace',
                fontSize: '9px',
                background: '#ede9fe',
                padding: '2px 4px',
                borderRadius: '3px',
                wordBreak: 'break-all',
                color: '#5b21b6'
              }}>
                {paymentDetails.refund_id}
              </span>
            </div>
            
            {/* Refund Amount */}
            {paymentDetails.refund_amount && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '2px 0',
                color: '#374151',
                fontSize: '10px'
              }}>
                <strong style={{ minWidth: '50px', color: '#6b21a8' }}>Amount:</strong>
                <span style={{ color: '#5b21b6', fontWeight: '600' }}>
                  ₹{paymentDetails.refund_amount}
                </span>
              </div>
            )}
            
            {/* Refund Date */}
            {paymentDetails.refund_date && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '2px 0',
                color: '#374151',
                fontSize: '10px'
              }}>
                <strong style={{ minWidth: '50px', color: '#6b21a8' }}>Date:</strong>
                <span style={{ color: '#5b21b6', fontSize: '9px' }}>
                  {new Date(paymentDetails.refund_date).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            )}
            
            {/* Instant Refund Badge */}
            {paymentDetails.instant_refund && (
              <div style={{
                marginTop: '3px',
                padding: '3px 6px',
                background: '#10b981',
                color: 'white',
                borderRadius: '3px',
                fontSize: '9px',
                fontWeight: '600',
                textAlign: 'center'
              }}>
                ⚡ Instant Refund
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Schedule Status Helper Functions
  const getScheduleStatusColor = (status) => {
    const colors = {
      'SCHEDULED': 'blue',
      'IN_PROGRESS': 'orange',
      'COMPLETED': 'green',
      'CANCELLED': 'red'
    };
    return colors[status] || 'gray';
  };

  const handleScheduleStatusChange = async (scheduleId, newStatus) => {
    // Show confirmation dialog
    const statusLabels = {
      'SCHEDULED': 'Scheduled',
      'IN_PROGRESS': 'In Progress',
      'COMPLETED': 'Completed',
      'CANCELLED': 'Cancelled'
    };
    
    const confirmed = window.confirm(
      `Are you sure you want to change this schedule status to "${statusLabels[newStatus]}"?`
    );
    
    if (!confirmed) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Call API to update status
      const response = await transport.updateScheduleStatus(scheduleId, {
        status: newStatus
      });
      
      console.log('✅ Schedule status updated:', response.data);
      
      // Update local state
      setSchedules(prevSchedules => 
        prevSchedules.map(schedule => 
          schedule.id === scheduleId 
            ? { ...schedule, status: newStatus }
            : schedule
        )
      );
      
      // Show success message
      alert(`Schedule status updated to "${statusLabels[newStatus]}" successfully!`);
      
    } catch (error) {
      console.error('❌ Error updating schedule status:', error);
      alert(error.response?.data?.error || 'Failed to update schedule status. Please try again.');
      
      // Reload schedules to reset the dropdown
      try {
        const res = await transport.getSchedules({});
        setSchedules(res.data);
      } catch (reloadError) {
        console.error('Error reloading schedules:', reloadError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchTerm('');
    setLocalSearch('');
    setSelectedDistrict('');
    setShowComplaintDetails(false);
    setSelectedComplaint(null);
    if (tab === 'complaints') {
      setComplaintSubTab('passenger');
    }
    if (tab === 'emergency') {
      setShowEmergencyForm(false);
    }
  };

  // Filter complaints by type
  const getFilteredComplaintsByType = () => {
    if (complaintSubTab === 'passenger') {
      return complaints.filter(c => c.complainant_type === 'PASSENGER');
    } else {
      return complaints.filter(c => ['DRIVER', 'CONDUCTOR', 'SUPERVISOR'].includes(c.complainant_type));
    }
  };
  
const ComplaintDetailsModal = ({ selectedComplaint, onClose, onResolve, getPriorityColor, getStatusColor }) => {
  if (!selectedComplaint) return null;
  const isStaffComplaint = ['DRIVER', 'CONDUCTOR', 'SUPERVISOR'].includes(selectedComplaint.complainant_type);
  
  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div 
        className="modal-content complaint-details-modal" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '1200px', 
          maxHeight: '90vh', 
          overflowY: 'auto',
          position: 'relative',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          border: 'none'
        }}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '20px',
            fontWeight: 'bold',
            zIndex: 10001,
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#dc2626';
            e.target.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#ef4444';
            e.target.style.transform = 'scale(1)';
          }}
        >
          <X size={20} />
        </button>
        <div className="modal-header" 
          style={{ 
            paddingRight: '60px',
            background: 'white',
            borderBottom: '2px solid #e2e8f0',
            padding: '24px 30px',
            margin: '0',
            borderRadius: '16px 16px 0 0'
          }}>
          
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#1e293b' }}>
              🔍Complaint Verification & Details
            </h2>
        </div>

        <div className="complaint-details-content" 
          style={{ 
           padding: '30px',
            background: 'white',
            borderRadius: '12px'  
          }}>
          {/* Complaint ID and Status */}
          <div style={{ 
            background: 'transparent', 
            padding: '20px 0', 
            borderRadius: '0', 
            marginBottom: '20px',
            border: 'none',
            borderBottom: '2px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: '0 0 10px 0' }}>Complaint #{selectedComplaint.complaint_id || 'N/A'}</h3>
                <p style={{ margin: '5px 0', color: '#64748b', fontSize: '14px' }}>
                  <Clock size={16} style={{ display: 'inline', marginRight: '5px' }} />
                  Submitted on {new Date(selectedComplaint.created_date).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <span className={`priority-badge priority-${getPriorityColor(selectedComplaint.priority)}`}>
                  {selectedComplaint.priority}
                </span>
                <span className={`status-badge status-${getStatusColor(selectedComplaint.status)}`}>
                  {selectedComplaint.status}
                </span>
                {selectedComplaint.is_verified && (
                  <span style={{
                    background: '#d1fae5',
                    color: '#065f46',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    border: '2px solid #10b981',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <CheckCircle size={14} /> Verified {isStaffComplaint ? 'Staff' : 'Passenger'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* PASSENGER/STAFF VERIFICATION INFO */}
          <div style={{
            background: 'transparent',
            border: 'none',
            borderBottom: '2px solid #e2e8f0',
            borderRadius: '0',
            padding: '20px 0',
            marginBottom: '20px'
          }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={20} /> {isStaffComplaint ? 'Staff' : 'Passenger'} Verification Details
            </h4>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
              gap: '15px' 
            }}>
              <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                  {isStaffComplaint ? 'STAFF NAME' : 'PASSENGER NAME'}
                </p>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
                  {selectedComplaint.passenger_name || 'N/A'}
                </p>
              </div>
              
              <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                  {isStaffComplaint ? 'STAFF PHONE' : 'PASSENGER PHONE'}
                </p>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Phone size={16} />
                  {selectedComplaint.passenger_phone || 'N/A'}
                </p>
                {selectedComplaint.is_verified && (
                  <span style={{
                    marginTop: '5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    background: '#d1fae5',
                    color: '#065f46',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>
                    <CheckCircle size={12} /> Phone Verified
                  </span>
                )}
              </div>
              
              {!isStaffComplaint && selectedComplaint.seat_number && (
                <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                    SEAT NUMBER
                  </p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
                    🪑 {selectedComplaint.seat_number}
                  </p>
                </div>
              )}
              
              {selectedComplaint.booking_id && (
                <div style={{background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                    BOOKING ID
                  </p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#3b82f6' }}>
                    #{selectedComplaint.booking_id}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* TRAVEL INFORMATION */}
          {(selectedComplaint.route_name || selectedComplaint.vehicle_number || selectedComplaint.booking_date) && (
            <div style={{
              background: 'transparent',
              border: 'none',
              borderBottom: '2px solid #e2e8f0',
              borderRadius: '0',
              padding: '20px 0',
              marginBottom: '20px'
            }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#166534' }}>🚌 Travel Information</h4>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '12px' 
              }}>
                {selectedComplaint.route_name && (
                  <div>
                    <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#166534' }}>Route:</p>
                    <p style={{ margin: 0, fontWeight: '600', color: '#166534' }}>
                      {selectedComplaint.route_name}
                    </p>
                  </div>
                )}
                
                {selectedComplaint.vehicle_number && (
                  <div>
                    <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#166534' }}>Vehicle:</p>
                    <p style={{ margin: 0, fontWeight: '600', color: '#166534' }}>
                      {selectedComplaint.vehicle_number}
                    </p>
                  </div>
                )}
                
                {selectedComplaint.booking_date && (
                  <div>
                    <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#166534' }}>Travel Date:</p>
                    <p style={{ margin: 0, fontWeight: '600', color: '#166534' }}>
                      {selectedComplaint.booking_date}
                    </p>
                  </div>
                )}
                
                {selectedComplaint.departure_time && (
                  <div>
                    <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#166534' }}>Departure:</p>
                    <p style={{ margin: 0, fontWeight: '600', color: '#166534' }}>
                      {selectedComplaint.departure_time}
                    </p>
                  </div>
                )}
                
                {selectedComplaint.boarding_point && (
                  <div>
                    <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#166534' }}>From:</p>
                    <p style={{ margin: 0, fontWeight: '600', color: '#166534' }}>
                      {selectedComplaint.boarding_point}
                    </p>
                  </div>
                )}
                
                {selectedComplaint.destination_point && (
                  <div>
                    <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#166534' }}>To:</p>
                    <p style={{ margin: 0, fontWeight: '600', color: '#166534' }}>
                      {selectedComplaint.destination_point}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Complaint Details */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} /> Complaint Details
            </h4>
            
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                SUBJECT
              </p>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                {selectedComplaint.subject || 'No subject provided'}
              </p>
            </div>
            
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                DESCRIPTION
              </p>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                {selectedComplaint.description || 'No description provided'}
              </p>
            </div>
          </div>

          {/* EVIDENCE SECTION - PHOTOS & VIDEOS WITH INLINE PREVIEW */}
          <div style={{
            background: 'transparent',
            border: 'none',
            borderBottom: '2px solid #e2e8f0',
            borderRadius: '0',
            padding: '20px 0',
            marginBottom: '20px'
          }}>
            <h4 style={{ margin: '0 0 20px 0', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📸 Evidence / Attachments
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              {/* Seat Photo - IMPROVED: Now shows inline preview like other photos */}
              {!isStaffComplaint && selectedComplaint.seat_photo_url && (
                <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '2px solid #10b981' }}>
                  <p style={{ margin: '0 0 10px 0', fontWeight: '600', color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🪑 Seat Photo
                    <CheckCircle size={16} />
                  </p>
                  <img 
                    src={selectedComplaint.seat_photo_url} 
                    alt="Seat number verification" 
                    style={{ 
                      width: '100%', 
                      height: 'auto',
                      maxHeight: '300px',
                      objectFit: 'contain',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: '2px solid #e2e8f0'
                    }}
                    onClick={() => window.open(selectedComplaint.seat_photo_url, '_blank')}
                  />
                  <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                    Click to view full size
                  </p>
                </div>
              )}
              
              {/* Issue Photo */}
              {selectedComplaint.issue_photo_url && (
                <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '2px solid #3b82f6' }}>
                  <p style={{ margin: '0 0 10px 0', fontWeight: '600', color: '#1e40af' }}>
                    📷 Issue Photo
                  </p>
                  <img 
                    src={selectedComplaint.issue_photo_url} 
                    alt="Issue documentation" 
                    style={{ 
                      width: '100%', 
                      height: 'auto',
                      maxHeight: '300px',
                      objectFit: 'contain',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: '2px solid #e2e8f0'
                    }}
                    onClick={() => window.open(selectedComplaint.issue_photo_url, '_blank')}
                  />
                  <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                    Click to view full size
                  </p>
                </div>
              )}
              
              {/* Issue Video */}
              {selectedComplaint.issue_video_url && (
                <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '2px solid #8b5cf6' }}>
                  <p style={{ margin: '0 0 10px 0', fontWeight: '600', color: '#5b21b6' }}>
                    🎥 Issue Video
                  </p>
                  <video 
                    controls 
                    style={{ 
                      width: '100%', 
                      maxHeight: '300px',
                      borderRadius: '6px',
                      border: '2px solid #e2e8f0'
                    }}
                  >
                    <source src={selectedComplaint.issue_video_url} />
                    Your browser does not support video playback.
                  </video>
                  <a 
                    href={selectedComplaint.issue_video_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                      display: 'block',
                      marginTop: '10px',
                      fontSize: '12px',
                      color: '#3b82f6',
                      textAlign: 'center',
                      textDecoration: 'none'
                    }}
                  >
                    Open video in new tab →
                  </a>
                </div>
              )}
            </div>
            
            {!selectedComplaint.seat_photo_url && !selectedComplaint.issue_photo_url && !selectedComplaint.issue_video_url && (
              <p style={{ color: '#92400e', textAlign: 'center', margin: 0 }}>
                No attachments available
              </p>
            )}
          </div>

          {/* Verification Notes */}
          {selectedComplaint.verification_notes && (
            <div style={{
              background: 'transparent',
              border: 'none',
              borderBottom: '2px solid #e2e8f0',
              borderRadius: '0',
              padding: '15px 0',
              marginBottom: '20px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#166534' }}>System Verification Notes</h4>
              <pre style={{ 
                margin: 0, 
                fontSize: '13px', 
                color: '#166534',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                lineHeight: '1.5'
              }}>
                {selectedComplaint.verification_notes}
              </pre>
            </div>
          )}

          {/* Admin Response */}
          {selectedComplaint.admin_response && (
            <div style={{
                background: 'transparent',
                border: 'none',
                borderBottom: '2px solid #e2e8f0',
                borderRadius: '0',
                padding: '15px 0',
                marginBottom: '20px'

            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#3730a3' }}>Admin Response</h4>
              <p style={{ margin: 0, color: '#3730a3' }}>{selectedComplaint.admin_response}</p>
              {selectedComplaint.resolved_date && (
                <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: '#6366f1' }}>
                  Resolved on {new Date(selectedComplaint.resolved_date).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {(selectedComplaint.status === 'PENDING' || selectedComplaint.status === 'IN_PROGRESS') && (
            <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid #e5e7eb', paddingTop: '20px', flexWrap: 'wrap' }}>
              {selectedComplaint.status === 'PENDING' && (
                <button style={{
                  flex: 1,
                  minWidth: '150px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }} onClick={() => onResolve(selectedComplaint.id, 'IN_PROGRESS')}>
                  <Clock size={18} /> Mark In Progress
                </button>
              )}
              <button style={{
                flex: 1,
                minWidth: '150px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 24px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }} onClick={() => onResolve(selectedComplaint.id, 'RESOLVED')}>
                <Check size={18} /> Mark as Resolved
              </button>
              <button style={{
                flex: 1,
                minWidth: '150px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 24px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }} onClick={() => {
                if (window.confirm('⚠️ Are you sure you want to reject this complaint? This action marks it as invalid/fake.')) {
                  onResolve(selectedComplaint.id, 'CLOSED');
                }
              }}>
                <XCircle size={18} /> Reject as Fake
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


  return (
    <div className="dashboard">
      {/* Complaint Details Modal */}
      {showComplaintDetails && (
        <ComplaintDetailsModal 
          selectedComplaint={selectedComplaint}
          onClose={handleCloseComplaintDetails}
          onResolve={handleResolveComplaint}
          getPriorityColor={getPriorityColor}
          getStatusColor={getStatusColor}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <Bus size={32} />
          <h2>TMS Admin</h2>
        </div>

        <nav className="sidebar-nav">
          {[
            { key: 'overview', icon: <AlertCircle size={20} />, label: 'Overview' },
            { key: 'employees', icon: <Users size={20} />, label: 'Employees' },
            { key: 'vehicles', icon: <Bus size={20} />, label: 'Vehicles' },
            { key: 'routes', icon: <RouteIcon size={20} />, label: 'Routes' },
            { key: 'schedules', icon: <Calendar size={20} />, label: 'Schedules' },
            { key: 'gps', icon: <MapPin size={20} />, label: 'GPS Tracking' },
            { key: 'bookings', icon: <Ticket size={20} />, label: 'Bookings' },
            { key: 'leaves', icon: <Bell size={20} />, label: 'Leave Requests', badge: dashboardData?.pending_leaves },
            { key: 'complaints', icon: <AlertCircle size={20} />, label: 'Complaints', badge: dashboardData?.pending_complaints },
            { key: 'payroll', icon: <DollarSign size={20} />, label: 'Payroll' },
            { key: 'emergency', icon: <AlertTriangle size={20} />, label: 'Emergency Alerts' },
            { key: 'drowsiness', icon: <EyeOff size={20} />,label: 'Drowsiness Alerts', badge: dashboardData?.high_priority_drowsiness_count },
            { key: 'drowsiness-stats', icon: <Activity size={20} />, label: 'Drowsiness Stats' },
            { key: 'heart-rate', icon: <Heart size={20} />, label: 'Heart Rate Alerts',badge: dashboardData?.hr_new_alerts }, 
            { key: 'alcohol', icon: <span style={{fontSize: '20px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>🍺</span>,label: 'Alcohol Alerts', badge: dashboardData?.alcohol_new_alerts },
            
          ].map(tab => (
            <button
              key={tab.key}
              className={activeTab === tab.key ? 'active' : ''}
              onClick={() => handleTabChange(tab.key)}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge > 0 && <span className="badge">{tab.badge}</span>}
            </button>
          ))}
        </nav>
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="dashboard-header">
          <button
            className="menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>

          <div className="user-info">
            <div className="user-avatar">{user?.name?.charAt(0) || 'A'}</div>
            <div>
              <p className="user-name">{user?.name}</p>
              <p className="user-role">Administrator</p>
            </div>
          </div>
        </header>

        {/* Content based on active tab */}
        {activeTab === 'overview' && dashboardData && (
          <div className="overview-content">
            {/* Stats Grid */}
            <div className="stats-grid">
              <div className="stat-card" onClick={() => setActiveTab('employees')} style={{cursor: 'pointer'}}>
                <div className="stat-icon" style={{background: '#667eea'}}><Users size={28} /></div>
                <div>
                  <p className="stat-label">Total Staff</p>
                  <h3 className="stat-value">{dashboardData.total_staff || 0}</h3>
                </div>
              </div>
              
              <div className="stat-card" onClick={() => setActiveTab('vehicles')} style={{cursor: 'pointer'}}>
                <div className="stat-icon" style={{background: '#f59e0b'}}><Bus size={28} /></div>
                <div>
                  <p className="stat-label">Total Vehicles</p>
                  <h3 className="stat-value">{dashboardData.total_vehicles || 0}</h3>
                </div>
              </div>
              
              <div className="stat-card" onClick={() => setActiveTab('routes')} style={{cursor: 'pointer'}}>
                <div className="stat-icon" style={{background: '#10b981'}}><RouteIcon size={28} /></div>
                <div>
                  <p className="stat-label">Total Routes</p>
                  <h3 className="stat-value">{dashboardData.total_routes || 0}</h3>
                </div>
              </div>
              
              <div className="stat-card" onClick={() => setActiveTab('schedules')} style={{cursor: 'pointer'}}>
                <div className="stat-icon" style={{background: '#3b82f6'}}><Calendar size={28} /></div>
                <div>
                  <p className="stat-label">Total Schedules</p>
                  <h3 className="stat-value">{dashboardData.total_schedules || 0}</h3>
                </div>
              </div>
              <div className="stat-card" onClick={() => setActiveTab('payroll')} style={{cursor: 'pointer'}}>
                <div className="stat-icon" style={{background: '#10b981'}}>
                  <DollarSign size={28} />
                </div>
                <div>
                  <p className="stat-label"> Payroll</p>
                  
                </div>
              </div>
              {/* Drowsiness Alerts Stat Card */}
              <div className="stat-card" onClick={() => setActiveTab('drowsiness')} style={{cursor: 'pointer'}}>
                <div className="stat-icon" style={{background: '#7c3aed'}}>
                  <EyeOff size={28} />
                </div>
                <div>
                  <p className="stat-label">New Drowsiness Alerts</p>
                  <h3 className="stat-value">{dashboardData.high_priority_drowsiness_count || 0}</h3>
                </div>
              </div>

              {/* Heart Rate Alerts Stat Card */}
              <div className="stat-card" onClick={() => setActiveTab('heart-rate')} style={{cursor: 'pointer'}}>
                <div className="stat-icon" style={{background: '#dc2626'}}>
                  <Heart size={28} />
                </div>
                <div>
                  <p className="stat-label">New Heart Rate Alerts</p>
                  <h3 className="stat-value">{dashboardData.hr_new_alerts || 0}</h3>
                </div>
              </div>
              <div className="stat-card" onClick={() => setActiveTab('alcohol')} style={{cursor: 'pointer'}}>
                <div className="stat-icon" style={{background: '#f59e0b'}}>
                  <span style={{fontSize: '24px'}}>🍺</span>
                </div>
                <div>
                  <p className="stat-label">New Alcohol Alerts</p>
                  <h3 className="stat-value">{dashboardData.alcohol_new_alerts || 0}</h3>
                </div>
              </div>
            </div>

            {/* High Priority Notifications */}
            {(dashboardData.high_priority_leaves_count > 0 || dashboardData.high_priority_complaints_count > 0 || dashboardData.high_priority_drowsiness_count > 0 || dashboardData.hr_new_alerts > 0 ||
              dashboardData.alcohol_new_alerts > 0) && (
              <div className="notifications-container">
                <div className="notifications-section">
                  <h2><Bell size={24} /> High Priority Notifications</h2>

                  {/* High Priority Leaves */}
                  {dashboardData.high_priority_leaves_count > 0 && (
                    <div className="priority-section">
                      <h3 className="priority-title">🚨 High Priority Leave Requests ({dashboardData.high_priority_leaves_count})</h3>
                      <div className="data-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Staff</th>
                              <th>Type</th>
                              <th>Period</th>
                              <th>Reason</th>
                              <th>Applied</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dashboardData.high_priority_leaves?.map(leave => (
                              <tr key={leave.id}>
                                <td><strong>{leave.staff_name || 'N/A'}</strong></td>
                                <td><span className="badge badge-red">{leave.leave_type}</span></td>
                                <td>{leave.start_date} to {leave.end_date}</td>
                                <td>{leave.reason?.substring(0, 50)}...</td>
                                <td>{new Date(leave.applied_date).toLocaleDateString()}</td>
                                <td>
                                  <div className="action-buttons">
                                    <button className="btn-approve" onClick={() => handleLeaveAction(leave.id, 'approve')}>
                                      <Check size={16} /> Approve
                                    </button>
                                    <button className="btn-reject" onClick={() => handleLeaveAction(leave.id, 'reject')}>
                                      <XCircle size={16} /> Reject
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  

                {/* High Priority Complaints */}
                {dashboardData.high_priority_complaints_count > 0 && (
                  <div className="priority-section">
                    <h3 className="priority-title">
                      ⚠️ High Priority Complaints ({dashboardData.high_priority_complaints_count})
                    </h3>

                    {/* Complaint Type Filter Buttons */}
                    <div style={{ 
                      display: 'flex', 
                      gap: '12px', 
                      marginBottom: '20px',
                      flexWrap: 'wrap'
                    }}>
                      <button
                        onClick={() => setComplaintSubTab('passenger')}
                        style={{
                          padding: '10px 20px',
                          borderRadius: '8px',
                          border: 'none',
                          background: complaintSubTab === 'passenger' ? '#3b82f6' : '#f1f5f9',
                          color: complaintSubTab === 'passenger' ? 'white' : '#64748b',
                          fontWeight: '600',
                          fontSize: '16px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <User size={18} />
                        Passenger Complaints (
                          {dashboardData.high_priority_complaints?.filter(
                            c => c.complainant_type === 'PASSENGER'
                          ).length || 0}
                        )
                      </button>

                      <button
                        onClick={() => setComplaintSubTab('staff')}
                        style={{
                          padding: '10px 20px',
                          borderRadius: '8px',
                          border: 'none',
                          background: complaintSubTab === 'staff' ? '#3b82f6' : '#f1f5f9',
                          color: complaintSubTab === 'staff' ? 'white' : '#64748b',
                          fontWeight: '600',
                          fontSize: '16px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <Users size={18} />
                        Staff Complaints (
                          {dashboardData.high_priority_complaints?.filter(
                            c => ['DRIVER', 'CONDUCTOR', 'SUPERVISOR'].includes(c.complainant_type)
                          ).length || 0}
                        )
                      </button>
                    </div>

                    {/* Complaints Table with IMPROVED inline media preview */}
                    <div className="data-table" style={{ overflowX: 'auto' }}>
                      <div style={{ minWidth: '1400px' }}>
                        <table>
                          <thead>
                            <tr>
                              <th style={{ minWidth: '100px' }}>ID</th>
                              <th style={{ minWidth: '180px' }}>Date & Time</th>
                              <th style={{ minWidth: '200px' }}>{complaintSubTab === 'passenger' ? 'Passenger Details' : 'Staff Details'}</th>
                              <th style={{ minWidth: '120px' }}>Phone Verified</th>
                              <th style={{ minWidth: '150px' }}>Travel Info</th>
                              <th style={{ minWidth: '250px' }}>Subject & Description</th>
                              <th style={{ minWidth: '80px' }}>Priority</th>
                              <th style={{ minWidth: '100px' }}>Status</th>
                              <th style={{ minWidth: '300px' }}>Evidence</th>
                              <th style={{ minWidth: '250px' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dashboardData.high_priority_complaints
                              ?.filter(complaint => {
                                if (complaintSubTab === 'passenger') {
                                  return complaint.complainant_type === 'PASSENGER';
                                }
                                if (complaintSubTab === 'staff') {
                                  return ['DRIVER', 'CONDUCTOR', 'SUPERVISOR'].includes(
                                    complaint.complainant_type
                                );
                              }
                              return true;
                            })
                            .map(complaint => (

                              <tr key={complaint.id}>
                                {/* Complaint ID */}
                                <td>
                                  <strong style={{ color: '#3b82f6' }}>#{complaint.complaint_id || 'N/A'}</strong>
                                </td>
                                
                                {/* Date & Time */}
                                <td>
                                  <div style={{ fontSize: '13px' }}>
                                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                      📅 {new Date(complaint.created_date).toLocaleDateString('en-IN', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric'
                                      })}
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: '12px' }}>
                                      🕐 {new Date(complaint.created_date).toLocaleTimeString('en-IN', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </div>
                                  </div>
                                </td>
                                
                                {/* Passenger/Staff Details */}
                                <td>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>
                                      {complaint.passenger_name || 'N/A'}
                                    </div>
                                    {complaint.passenger_phone && (
                                      <div style={{ 
                                        fontSize: '12px', 
                                        color: '#64748b',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}>
                                        📱 {complaint.passenger_phone}
                                      </div>
                                    )}
                                    {complaint.seat_number && complaintSubTab === 'passenger' && (
                                      <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '4px 8px',
                                        background: '#f1f5f9',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        color: '#475569',
                                        width: 'fit-content'
                                      }}>
                                        🪑 Seat {complaint.seat_number}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                
                                {/* Phone Verified */}
                                <td>
                                  {complaint.is_verified ? (
                                    <div style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '4px'
                                    }}>
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '6px 10px',
                                        background: '#d1fae5',
                                        color: '#065f46',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        border: '2px solid #10b981'
                                      }}>
                                        <CheckCircle size={14} /> VERIFIED
                                      </span>
                                      {complaint.booking_id && (
                                        <span style={{
                                          fontSize: '11px',
                                          color: '#065f46',
                                          fontWeight: '600'
                                        }}>
                                          Booking: #{complaint.booking_id}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '6px 10px',
                                      background: '#fee2e2',
                                      color: '#991b1b',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      border: '2px solid #dc2626'
                                    }}>
                                      <XCircle size={14} /> NOT VERIFIED
                                    </span>
                                  )}
                                </td>
                                
                                {/* Travel Info */}
                                <td>
                                  <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {complaint.route_name ? (
                                      <div style={{ fontWeight: '600', color: '#1e293b' }}>
                                        🚌 {complaint.route_name}
                                      </div>
                                    ) : (
                                      <div style={{ color: '#64748b', fontStyle: 'italic' }}>N/A</div>
                                    )}
                                    {complaint.vehicle_number && (
                                      <div style={{ color: '#64748b' }}>🚐 {complaint.vehicle_number}</div>
                                    )}
                                    {complaint.booking_date && (
                                      <div style={{ color: '#64748b' }}>📅 {complaint.booking_date}</div>
                                    )}
                                  </div>
                                </td>
                                
                                {/* Subject & Description */}
                                <td>
                                  <div style={{ maxWidth: '250px' }}>
                                    <div style={{ 
                                      fontWeight: '700', 
                                      fontSize: '14px',
                                      marginBottom: '6px',
                                      color: '#1e293b'
                                    }}>
                                      {complaint.subject}
                                    </div>
                                    <div style={{ 
                                      fontSize: '12px', 
                                      color: '#64748b',
                                      lineHeight: '1.4',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical'
                                    }}>
                                      {complaint.description?.substring(0, 100)}
                                      {complaint.description?.length > 100 && '...'}
                                    </div>
                                  </div>
                                </td>
                                
                                {/* Priority */}
                                <td>
                                  <span className={`priority-badge priority-${getPriorityColor(complaint.priority)}`}>
                                    {complaint.priority}
                                  </span>
                                </td>
                                
                                {/* Status */}
                                <td>
                                  <span className={`status-badge status-${getStatusColor(complaint.status)}`}>
                                    {complaint.status}
                                  </span>
                                </td>
                                
                                {/* Evidence - IMPROVED: ALL media shows as inline previews */}
                                <td>
                                  <div style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '8px'
                                  }}>
                                    {/* Seat Photo - FIXED: Now shows thumbnail preview */}
                                    {complaintSubTab === 'passenger' && complaint.seat_photo_url && (
                                      <div style={{
                                        position: 'relative',
                                        border: '2px solid #10b981',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        background: '#f0fdf4'
                                      }}>
                                        <img 
                                          src={complaint.seat_photo_url}
                                          alt="Seat verification"
                                          style={{
                                            width: '100%',
                                            height: '120px',
                                            objectFit: 'cover',
                                            cursor: 'pointer'
                                          }}
                                          onClick={() => window.open(complaint.seat_photo_url, '_blank')}
                                        />
                                        <div style={{
                                          position: 'absolute',
                                          bottom: 0,
                                          left: 0,
                                          right: 0,
                                          background: 'rgba(16, 185, 129, 0.9)',
                                          color: 'white',
                                          padding: '4px 8px',
                                          fontSize: '11px',
                                          fontWeight: '600',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '4px'
                                        }}>
                                          <CheckCircle size={12} /> Seat Photo
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Issue Photo - Shows thumbnail preview */}
                                    {complaint.issue_photo_url && (
                                      <div style={{
                                        position: 'relative',
                                        border: '2px solid #3b82f6',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        background: '#eff6ff'
                                      }}>
                                        <img 
                                          src={complaint.issue_photo_url}
                                          alt="Issue documentation"
                                          style={{
                                            width: '100%',
                                            height: '120px',
                                            objectFit: 'cover',
                                            cursor: 'pointer'
                                          }}
                                          onClick={() => window.open(complaint.issue_photo_url, '_blank')}
                                        />
                                        <div style={{
                                          position: 'absolute',
                                          bottom: 0,
                                          left: 0,
                                          right: 0,
                                          background: 'rgba(59, 130, 246, 0.9)',
                                          color: 'white',
                                          padding: '4px 8px',
                                          fontSize: '11px',
                                          fontWeight: '600',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '4px'
                                        }}>
                                          <Image size={12} /> Issue Photo
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Issue Video - Shows video player with label */}
                                    {complaint.issue_video_url && (
                                      <div style={{
                                        position: 'relative',
                                        border: '2px solid #8b5cf6',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        background: '#f5f3ff'
                                      }}>
                                        <video 
                                          style={{
                                            width: '100%',
                                            height: '120px',
                                            objectFit: 'cover',
                                            cursor: 'pointer'
                                          }}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            window.open(complaint.issue_video_url, '_blank');
                                          }}
                                        >
                                          <source src={complaint.issue_video_url} />
                                        </video>
                                        <div style={{
                                          position: 'absolute',
                                          bottom: 0,
                                          left: 0,
                                          right: 0,
                                          background: 'rgba(139, 92, 246, 0.9)',
                                          color: 'white',
                                          padding: '4px 8px',
                                          fontSize: '11px',
                                          fontWeight: '600',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '4px'
                                        }}>
                                          <Video size={12} /> Issue Video (Click to play)
                                        </div>
                                      </div>
                                    )}

                                    {!complaint.seat_photo_url && !complaint.issue_photo_url && !complaint.issue_video_url && (
                                      <span style={{
                                        fontSize: '12px',
                                        color: '#64748b',
                                        fontStyle: 'italic'
                                      }}>
                                        No evidence
                                      </span>
                                    )}
                                  </div>
                                </td>
                                

                                {/* Actions Column */}
                                <td>
                                  <div style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '8px',
                                    minWidth: '200px'
                                  }}>
                                    {/* View Details Button */}
                                    <button 
                                      className="btn-view" 
                                      onClick={() => handleViewComplaint(complaint)}
                                      style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                      }}
                                    >
                                      <FileText size={14} /> View Full Details
                                    </button>
                                    
                                    {/* Action Buttons based on status */}
                                    {complaint.status === 'PENDING' && (
                                      <>
                                        <button 
                                          className="btn-resolve"
                                          onClick={() => handleResolveComplaint(complaint.id, 'IN_PROGRESS')}
                                          style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            background: '#f59e0b',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px'
                                          }}
                                        >
                                          <Clock size={14} /> In Progress
                                        </button>
                                        <button 
                                          className="btn-resolve"
                                          onClick={() => handleResolveComplaint(complaint.id, 'RESOLVED')}
                                          style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            background: '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px'
                                          }}
                                        >
                                          <Check size={14} /> Resolve
                                        </button>
                                        <button 
                                          onClick={() => {
                                            if (window.confirm('⚠️ Are you sure you want to reject this complaint as FAKE? This action will mark it as closed.')) {
                                              handleResolveComplaint(complaint.id, 'CLOSED');
                                            }
                                          }}
                                          style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            background: '#dc2626',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px'
                                          }}
                                        >
                                          <Trash2 size={14} /> Reject (Fake)
                                        </button>
                                      </>
                                    )}
                                    
                                    {complaint.status === 'IN_PROGRESS' && (
                                      <>
                                        <button 
                                          className="btn-resolve"
                                          onClick={() => handleResolveComplaint(complaint.id, 'RESOLVED')}
                                          style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            background: '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px'
                                          }}
                                        >
                                          <Check size={14} /> Mark Resolved
                                        </button>
                                        <button 
                                          onClick={() => {
                                            if (window.confirm('⚠️ Reject this complaint as FAKE?')) {
                                              handleResolveComplaint(complaint.id, 'CLOSED');
                                            }
                                          }}
                                          style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            background: '#dc2626',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px'
                                          }}
                                        >
                                          <Trash2 size={14} /> Reject (Fake)
                                        </button>
                                      </>
                                    )}
                                    
                                    {(complaint.status === 'RESOLVED' || complaint.status === 'CLOSED') && (
                                      <span style={{
                                        fontSize: '12px',
                                        color: '#64748b',
                                        textAlign: 'center',
                                        fontStyle: 'italic',
                                        padding: '8px'
                                      }}>
                                        {complaint.status === 'RESOLVED' ? '✅ Resolved' : '❌ Rejected'}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
                {/* High Priority Drowsiness Alerts */}
                {dashboardData.high_priority_drowsiness_count > 0 && (
                  <div className="priority-section">
                    <h3 className="priority-title">
                      🚨 New Drowsiness Alerts ({dashboardData.high_priority_drowsiness_count})
                    </h3>
                    <div className="data-table" style={{ overflowX: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Driver</th>
                            <th>Severity</th>
                            <th>Vehicle</th>
                            <th>Route</th>
                            <th>Time</th>
                            <th>EAR</th>
                            <th>Closure</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardData.high_priority_drowsiness_alerts?.map(alert => (
                            <tr key={alert.id}>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <strong>{alert.driver_name}</strong>
                                  {alert.driver_phone && (
                                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                                      📱 {alert.driver_phone}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span className={`badge badge-${
                                  alert.severity === 'CRITICAL' ? 'red' :
                                  alert.severity === 'HIGH' ? 'orange' :
                                  alert.severity === 'MEDIUM' ? 'purple' : 'blue'
                                }`}>
                                  {alert.severity}
                                </span>
                              </td>
                              <td>{alert.vehicle_number || 'N/A'}</td>
                              <td>{alert.route_name || 'N/A'}</td>
                              <td>
                                <div style={{ fontSize: '12px' }}>
                                  <div>{new Date(alert.detected_at).toLocaleDateString('en-IN')}</div>
                                  <div style={{ color: '#64748b' }}>
                                    {new Date(alert.detected_at).toLocaleTimeString('en-IN', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                  <div style={{ color: '#dc2626', fontWeight: '600' }}>
                                    {alert.time_since_detection}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Activity size={14} />
                                  <strong>{alert.ear_value?.toFixed(3)}</strong>
                                </div>
                              </td>
                              <td>
                                <strong>{alert.eye_closure_duration?.toFixed(1)}s</strong>
                              </td>
                              <td>
                                <div className="action-buttons">
                                  <button 
                                    className="btn-reject"
                                    onClick={async (e) => {
                                      if (window.confirm('Acknowledge this alert?')) {
                                        const button = e.target.closest('button');
                                        const originalText = button.innerHTML;
                                        
                                        try {
                                          // Show loading state
                                          button.disabled = true;
                                          button.innerHTML = '<span style="display: flex; align-items: center; gap: 6px;"><svg style="animation: spin 1s linear infinite;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/></svg> Processing...</span>';
                                          
                                          await drowsinessAPI.updateAlertStatus(alert.id, { status: 'ACKNOWLEDGED' });
                                          
                                          // Show success state
                                          button.style.background = '#10b981';
                                          button.innerHTML = '<span style="display: flex; align-items: center; gap: 6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Acknowledged!</span>';
                                          
                                          // Reload data after a brief delay
                                          setTimeout(() => {
                                            loadDashboardData();
                                          }, 800);
                                        } catch (error) {
                                          console.error('Failed to acknowledge alert:', error);
                                          // Show error state
                                          button.style.background = '#ef4444';
                                          button.innerHTML = '<span style="display: flex; align-items: center; gap: 6px;">❌ Failed</span>';
                                          setTimeout(() => {
                                            button.disabled = false;
                                            button.style.background = '';
                                            button.innerHTML = originalText;
                                          }, 2000);
                                        }
                                      }
                                    }}
                                  >
                                    <Check size={16} /> Acknowledge
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {/* Heart Rate Alerts Widget */}
                {dashboardData?.hr_new_alerts > 0 && (
                  <div className="priority-section">
                    <h3 className="priority-title">
                      ❤️ New Heart Rate Alerts ({dashboardData.hr_new_alerts})
                    </h3>
                    <div className="data-table" style={{ overflowX: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Driver</th>
                            <th>Type</th>
                            <th>BPM</th>
                            <th>Time</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardData.hr_recent_alerts?.map(alert => (
                            <tr key={alert.id}>
                              <td><strong>{alert.driver_name || 'N/A'}</strong></td>
                              <td>
                                <span style={{
                                  padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                                  background: alert.alert_type === 'HIGH' ? '#fee2e2' : '#dbeafe',
                                  color: alert.alert_type === 'HIGH' ? '#dc2626' : '#1d4ed8',
                                }}>
                                  {alert.alert_type === 'HIGH' ? '🔥 HIGH' : '❄️ LOW'}
                                </span>
                              </td>
                              <td><strong style={{ fontSize: 18, color: alert.alert_type === 'HIGH' ? '#dc2626' : '#1d4ed8' }}>
                                {Math.round(alert.heart_rate)} BPM
                              </strong></td>
                              <td>
                                <div style={{ fontSize: '12px' }}>
                                  <div>{new Date(alert.detected_at).toLocaleDateString('en-IN')}</div>
                                  <div style={{ color: '#64748b' }}>
                                    {new Date(alert.detected_at).toLocaleTimeString('en-IN', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                  <div style={{ color: '#dc2626', fontWeight: '600' }}>
                                    {alert.time_since_detection}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <button
                                  onClick={() => {
                                    setSelectedHeartRateAlertId(alert.id);
                                    setActiveTab('heart-rate');
                                  }}
                                  style={{
                                    padding: '6px 12px', borderRadius: 6, border: '1px solid #667eea',
                                    background: 'white', color: '#667eea', cursor: 'pointer', fontSize: 12,
                                  }}
                                >
                                  View →
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {/* Alcohol New Alerts */}
                {dashboardData.alcohol_new_alerts > 0 && (
                  <div style={{ marginTop: '30px' }}>
                    <h3 style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '15px',
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#1e293b'
                    }}>
                      <span>🍺</span> New Alcohol Alerts({dashboardData.alcohol_new_alerts})
                    </h3>
                    <div className="data-table" style={{ overflowX: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Driver</th>
                            <th>Sensor Value</th>
                            <th>Threshold</th>
                            <th>Time</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardData.alcohol_recent_alerts.map((alert) => (
                            <tr key={alert.id}>
                              <td>
                                <strong>{alert.driver_name || 'Unknown Driver'}</strong>
                                <br />
                                <span style={{ fontSize: '12px', color: '#64748b' }}>
                                  {alert.driver_phone || 'N/A'}
                                </span>
                              </td>
                              <td>
                                <span style={{
                                  fontSize: '20px',
                                  fontWeight: '800',
                                  color: '#f59e0b'
                                }}>
                                  {alert.sensor_value}
                                </span>
                              </td>
                              <td>
                                <span style={{ color: '#64748b', fontSize: '13px' }}>
                                  {alert.threshold}
                                </span>
                              </td>
                              <td>
                                <div style={{ fontSize: '12px' }}>
                                  <div>{new Date(alert.detected_at).toLocaleDateString('en-IN')}</div>
                                  <div style={{ color: '#64748b' }}>
                                    {new Date(alert.detected_at).toLocaleTimeString('en-IN', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                  <div style={{ color: '#dc2626', fontWeight: '600' }}>
                                    {alert.time_since_detection}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  background: alert.status === 'NEW' ? '#fef2f2' : 
                                              alert.status === 'ACKNOWLEDGED' ? '#fffbeb' : '#f0fdf4',
                                  color: alert.status === 'NEW' ? '#dc2626' : 
                                        alert.status === 'ACKNOWLEDGED' ? '#b45309' : '#16a34a',
                                }}>
                                  {alert.status}
                                </span>
                              </td>
                              <td>
                                <button
                                  onClick={() => {
                                    setSelectedAlcoholAlertId(alert.id);
                                    setActiveTab('alcohol');
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#fffbeb',
                                    border: '1px solid #fde68a',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    color: '#92400e',
                                    fontWeight: '600'
                                  }}
                                >
                                  View →
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Pending Items Summary */}
          <div className="pending-summary">
            <h2>Pending Items Summary</h2>
            <div className="summary-cards">
              <div className="summary-card" onClick={() => setActiveTab('leaves')}>
                <Bell size={24} />
                <div>
                  <h4>All Leave Requests</h4>
                  <p className="summary-count">{dashboardData.pending_leaves}</p>
                </div>
              </div>
              <div className="summary-card" onClick={() => setActiveTab('complaints')}>
                <AlertCircle size={24} />
                <div>
                  <h4>All Complaints</h4>
                  <p className="summary-count">{dashboardData.pending_complaints}</p>
                </div>
              </div>
              <div className="summary-card" onClick={() => setActiveTab('bookings')}>
                <Ticket size={24} />
                <div>
                  <h4>Total Bookings</h4>
                  <p className="summary-count">{dashboardData.total_bookings || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* District Overview */}
          <div className="district-overview">
            <h2>District-wise Overview</h2>
            <div className="district-grid">
              {dashboardData.district_data?.map((district, index) => (
                <div key={index} className="district-card">
                  <h3>{district.name}</h3>
                  <div className="district-stats">
                    <div><span>Staff:</span><strong>{district.staff || 0}</strong></div>
                    <div><span>Vehicles:</span><strong>{district.vehicles || 0}</strong></div>
                    <div><span>Routes:</span><strong>{district.routes || 0}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {activeTab === 'emergency' && (
        <div className="tab-content">
          <div className="content-header">
            <div>
              <h2>🚨 Emergency Notification System</h2>
              <p>Send emergency alerts to passengers in case of accidents or critical situations</p>
            </div>
            <button
              className="btn-primary btn-danger"
              onClick={toggleEmergencyForm}
              style={{
                background: showEmergencyForm 
                  ? 'linear-gradient(135deg, #6c757d 0%, #5a6268 100%)' 
                  : 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)'
              }}
            >
              <Send size={18} />
              {showEmergencyForm ? 'Cancel' : 'Send New Alert'}
            </button>
          </div>

          {/* Emergency Alert Form */}
          {showEmergencyForm && (
            <div className="card" style={{ 
              marginBottom: '30px', 
              border: '2px solid #dc3545',
              boxShadow: '0 4px 12px rgba(220, 53, 69, 0.15)'
            }}>
              <div style={{ 
                background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
                color: 'white',
                padding: '20px',
                borderRadius: '8px 8px 0 0',
                marginBottom: '25px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <AlertTriangle size={28} />
                <h3 style={{ margin: 0, fontSize: '20px' }}>Send Emergency Alert</h3>
              </div>

              <div style={{ padding: '0 25px 25px' }}>
                {/* Schedule Selection */}
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    color: '#2d3748',
                    fontSize: '15px'
                  }}>
                    Select Affected Schedule *
                  </label>
                  <select
                    className="input-field"
                    value={selectedScheduleForAlert?.id || ''}
                    onChange={(e) => {
                      const schedule = schedules.find(s => s.id === parseInt(e.target.value));
                      setSelectedScheduleForAlert(schedule);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '14px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      backgroundColor: 'white'
                    }}
                  >
                    <option value="">-- Select Schedule --</option>
                    {schedules.map(schedule => (
                      <option key={schedule.id} value={schedule.id}>
                        {schedule.route_details?.route_name} - 
                        {schedule.route_details?.route_number} - 
                        {schedule.schedule_date} - 
                        {schedule.departure_time} - 
                        Vehicle: {schedule.vehicle_details?.vehicle_number}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Emergency Message */}
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    color: '#2d3748',
                    fontSize: '15px'
                  }}>
                    Emergency Message *
                  </label>
                  <textarea
                    rows="5"
                    value={emergencyMessage}
                    onChange={(e) => setEmergencyMessage(e.target.value)}
                    placeholder="Example: There has been an accident involving this bus. All passengers are safe and receiving medical attention. Please contact the emergency number for more information."
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '14px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                {/* Hospital Information */}
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    color: '#2d3748',
                    fontSize: '15px'
                  }}>
                    Hospital & Medical Facility Information (Optional)
                  </label>
                  <textarea
                    rows="4"
                    value={hospitalInfo}
                    onChange={(e) => setHospitalInfo(e.target.value)}
                    placeholder={`Example:\nLocation: City General Hospital, Main Street, Chennai\nContact: +91-XXXXXXXXXX\nEmergency Ward: Available 24/7\nAmbulance Services: Available`}
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '14px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                {/* Info Box */}
                <div style={{
                  background: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '25px'
                }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'start' }}>
                    <Info size={20} style={{ color: '#856404', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ color: '#856404', fontSize: '14px' }}>
                      <strong>Important:</strong>
                      <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                        <li>Messages will be sent to <strong>alternate contact numbers</strong> of all passengers</li>
                        <li>Cancelled bookings will be automatically excluded</li>
                        <li>You will see a delivery report after sending</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={toggleEmergencyForm}
                    style={{
                      padding: '12px 24px',
                      border: '2px solid #6c757d',
                      borderRadius: '8px',
                      background: 'white',
                      color: '#6c757d',
                      fontSize: '15px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendEmergencyAlert}
                    disabled={sendingAlert || !selectedScheduleForAlert || !emergencyMessage.trim()}
                    style={{
                      padding: '12px 24px',
                      border: 'none',
                      borderRadius: '8px',
                      background: sendingAlert || !selectedScheduleForAlert || !emergencyMessage.trim()
                        ? '#ccc'
                        : 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
                      color: 'white',
                      fontSize: '15px',
                      fontWeight: '600',
                      cursor: sendingAlert || !selectedScheduleForAlert || !emergencyMessage.trim() ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {sendingAlert ? (
                      <>
                        <Clock size={18} style={{ animation: 'spin 1s linear infinite' }} />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        Send Emergency Alert
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notification History */}
          <div className="card">
            {/* Search Box for Emergency Alerts */}
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="search-box" style={{ flex: 1, maxWidth: '500px' }}>
                <Search size={20} />
                <input
                  type="text"
                  placeholder="Search by route, vehicle, or message..."
                  value={emergencySearchTerm}
                  onChange={(e) => setEmergencySearchTerm(e.target.value)}
                />
              </div>
            </div>

            <h3 style={{ marginBottom: '20px', fontSize: '20px', color: '#2d3748' }}>
              Emergency Alert History
            </h3>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                Loading notifications...
              </div>
            ) : emergencyNotifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                <AlertTriangle size={48} style={{ color: '#ccc', marginBottom: '15px' }} />
                <p style={{ fontSize: '16px' }}>No emergency alerts have been sent yet</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Date & Time</th>
                      <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Route</th>
                      <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Vehicle</th>
                      <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Message Preview</th>
                      <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Recipients</th>
                      <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Success Rate</th>
                      <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Sent By</th>
                      <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emergencyNotifications
                      .filter(notification => {
                        if (!emergencySearchTerm) return true;
                        const searchLower = emergencySearchTerm.toLowerCase();
                        return (
                          notification.schedule_details?.route_name?.toLowerCase().includes(searchLower) ||
                          notification.schedule_details?.route_number?.toLowerCase().includes(searchLower) ||
                          notification.schedule_details?.vehicle_number?.toLowerCase().includes(searchLower) ||
                          notification.message?.toLowerCase().includes(searchLower)
                        );
                      })
                      .map(notification => {
                      const successRate = notification.total_recipients > 0 
                        ? ((notification.successful_sends / notification.total_recipients) * 100).toFixed(1)
                        : 0;
                      
                      return (
                        <tr key={notification.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '15px' }}>
                            <div>
                              <strong>{new Date(notification.sent_at).toLocaleDateString()}</strong>
                              <br />
                              <small style={{ color: '#666' }}>
                                {new Date(notification.sent_at).toLocaleTimeString()}
                              </small>
                            </div>
                          </td>
                          <td style={{ padding: '15px' }}>
                            <div>
                              <strong>{notification.schedule_details?.route_name}</strong>
                              <br />
                              <small style={{ color: '#666' }}>
                                {notification.schedule_details?.route_number}
                              </small>
                            </div>
                          </td>
                          <td style={{ padding: '15px' }}>{notification.schedule_details?.vehicle_number}</td>
                          <td style={{ padding: '15px', maxWidth: '300px' }}>
                            <div style={{ 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {notification.message}
                            </div>
                          </td>
                          <td style={{ padding: '15px' }}>
                            <strong>{notification.total_recipients}</strong>
                          </td>
                          <td style={{ padding: '15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '100px',
                                height: '8px',
                                background: '#e0e0e0',
                                borderRadius: '4px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${successRate}%`,
                                  height: '100%',
                                  background: successRate >= 80 ? '#4caf50' : successRate >= 50 ? '#ff9800' : '#f44336',
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                              <span style={{ 
                                color: successRate >= 80 ? '#4caf50' : successRate >= 50 ? '#ff9800' : '#f44336',
                                fontWeight: 'bold',
                                fontSize: '14px'
                              }}>
                                {successRate}%
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                              <CheckCircle size={12} style={{ color: '#4caf50', marginRight: '4px' }} />
                              {notification.successful_sends} sent
                              {notification.failed_sends > 0 && (
                                <>
                                  {' | '}
                                  <XCircle size={12} style={{ color: '#f44336', marginRight: '4px' }} />
                                  {notification.failed_sends} failed
                                </>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '15px' }}>{notification.sent_by_name}</td>
                          <td style={{ padding: '15px' }}>
                            <button
                              onClick={() => handleViewNotificationDetails(notification)}
                              style={{
                                padding: '8px 16px',
                                border: '1px solid #667eea',
                                borderRadius: '6px',
                                background: 'white',
                                color: '#667eea',
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <Info size={16} />
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Notification Details Modal */}
          {notificationDetails && (
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
              }}
              onClick={() => setNotificationDetails(null)}
            >
              <div 
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  maxWidth: '900px',
                  width: '90%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{
                  padding: '20px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  position: 'sticky',
                  top: 0,
                  background: 'white',
                  zIndex: 1
                }}>
                  <h2 style={{ margin: 0 }}>🔍 Emergency Alert Details</h2>
                  <button
                    onClick={() => setNotificationDetails(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '24px',
                      cursor: 'pointer',
                      color: '#999',
                      padding: '0',
                      width: '30px',
                      height: '30px'
                    }}
                  >
                    <X size={24} />
                  </button>
                </div>

                <div style={{ padding: '20px' }}>
                  {/* Alert Summary */}
                  <div style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '20px',
                    marginBottom: '20px'
                  }}>
                    <h3 style={{ marginBottom: '15px' }}>Alert Summary</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                      <div>
                        <strong>Date & Time:</strong>
                        <p style={{ marginTop: '5px' }}>{new Date(notificationDetails.sent_at).toLocaleString()}</p>
                      </div>
                      <div>
                        <strong>Sent By:</strong>
                        <p style={{ marginTop: '5px' }}>{notificationDetails.sent_by_name}</p>
                      </div>
                      <div>
                        <strong>Route:</strong>
                        <p style={{ marginTop: '5px' }}>{notificationDetails.schedule_details?.route_name}</p>
                      </div>
                      <div>
                        <strong>Vehicle:</strong>
                        <p style={{ marginTop: '5px' }}>{notificationDetails.schedule_details?.vehicle_number}</p>
                      </div>
                    </div>
                  </div>

                  {/* Message Content */}
                  <div style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '20px',
                    marginBottom: '20px'
                  }}>
                    <h3>Message Content</h3>
                    <div style={{ 
                      background: '#f5f5f5', 
                      padding: '15px', 
                      borderRadius: '8px',
                      whiteSpace: 'pre-wrap',
                      marginTop: '10px'
                    }}>
                      {notificationDetails.message}
                    </div>
                    {notificationDetails.hospital_info && (
                      <>
                        <h4 style={{ marginTop: '15px' }}>Hospital Information</h4>
                        <div style={{ 
                          background: '#e8f5e9', 
                          padding: '15px', 
                          borderRadius: '8px',
                          whiteSpace: 'pre-wrap',
                          marginTop: '10px'
                        }}>
                          {notificationDetails.hospital_info}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Recipients List */}
                  <div style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '20px'
                  }}>
                    <h3>Recipients ({notificationDetails.recipients_list?.length || 0})</h3>
                    <div style={{ overflowX: 'auto', marginTop: '15px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f8f9fa' }}>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Passenger Name</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Alternate Number</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Status</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Sent At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {notificationDetails.recipients_list?.map((recipient, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '12px' }}>{recipient.passenger_name}</td>
                              <td style={{ padding: '12px' }}>
                                {recipient.is_alternate_number && recipient.contact_number !== 'N/A' ? (
                                  <span>
                                    {recipient.contact_number}
                                    <span style={{ 
                                      marginLeft: '8px', 
                                      padding: '2px 6px', 
                                      background: '#e3f2fd', 
                                      color: '#1976d2',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: '600'
                                    }}>
                                      Alt
                                    </span>
                                  </span>
                                ) : (
                                  <span style={{ color: '#dc2626', fontStyle: 'italic' }}>
                                    {recipient.contact_number}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '12px' }}>
                                <span style={{
                                  padding: '4px 12px',
                                  borderRadius: '20px',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  background: recipient.sent_status ? '#e8f5e9' : '#ffebee',
                                  color: recipient.sent_status ? '#2e7d32' : '#c62828',
                                  border: `1px solid ${recipient.sent_status ? '#4caf50' : '#f44336'}`,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}>
                                  {recipient.sent_status ? (
                                    <><CheckCircle size={14} /> Sent</>
                                  ) : (
                                    <><XCircle size={14} /> Failed</>
                                  )}
                                </span>
                              </td>
                              <td style={{ padding: '12px' }}>
                                {recipient.sent_at 
                                  ? new Date(recipient.sent_at).toLocaleTimeString()
                                  : '-'
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === 'gps' && (
        <div className="tab-content gps-tracking-container">
          <GPSTracking />
        </div>
      )}

      {activeTab !== 'overview' && (
        <div className="tab-content">
          {/* Filters */}
          <div className="filters">
            {activeTab !== 'complaints' && activeTab !== 'emergency' && activeTab !== 'gps' && activeTab !== 'drowsiness' && 
             activeTab !== 'drowsiness-stats' && activeTab !== 'heart-rate' && activeTab !== 'alcohol' && (
              <div className="search-box">
                <Search size={20} />
                <input
                  type="text"
                  placeholder={activeTab === 'schedules' ? 'Search by driver name...' : 'Search...'}
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                />
              </div>
            )}

            {['employees', 'vehicles', 'routes', 'schedules'].includes(activeTab) && (
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="district-filter"
              >
                <option value="">All Districts</option>
                {districts.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            )}
          </div>

          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <div className="data-table">
              {/* Employees Tab */}
              {activeTab === 'employees' && (
                <table>
                  <thead>
                    <tr>
                      <th>Employee ID</th>
                      <th>Name</th>
                      <th>Role</th>
                      <th>District</th>
                      <th>Phone</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.length === 0 ? (
                      <tr><td colSpan="6" style={{ textAlign: 'center' }}>No employees found</td></tr>
                    ) : (
                      employees.map(emp => (
                        <tr key={emp.id}>
                          <td>{emp.employee_id || 'N/A'}</td>
                          <td><strong>{emp.name || 'N/A'}</strong></td>
                          <td><span className="badge badge-blue">{emp.user_type || 'N/A'}</span></td>
                          <td>{emp.working_district || 'N/A'}</td>
                          <td>{emp.phone_number || 'N/A'}</td>
                          <td>
                            <span className={`status-badge ${emp.is_active ? 'active' : 'inactive'}`}>
                              {emp.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* Vehicles Tab */}
              {activeTab === 'vehicles' && (
                <table>
                  <thead>
                    <tr>
                      <th>Vehicle Number</th>
                      <th>Type</th>
                      <th>Capacity</th>
                      <th>District</th>
                      <th>Status</th>
                      <th>Last Maintenance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.length === 0 ? (
                      <tr><td colSpan="6" style={{ textAlign: 'center' }}>No vehicles found</td></tr>
                    ) : (
                      vehicles.map(v => (
                        <tr key={v.id}>
                          <td><strong>{v.vehicle_number || 'N/A'}</strong></td>
                          <td>{v.vehicle_type || 'N/A'}</td>
                          <td>{v.capacity || 'N/A'} seats</td>
                          <td>{v.district_name || getDistrictName(v.district)}</td>
                          <td>
                            <span className={`status-badge ${v.status === 'ACTIVE' ? 'active' : v.status === 'MAINTENANCE' ? 'status-yellow' : 'inactive'}`}>
                              {v.status}
                            </span>
                          </td>
                          <td>{v.last_maintenance || 'N/A'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* Routes Tab */}
              {activeTab === 'routes' && (
                <table>
                  <thead>
                    <tr>
                      <th>Route Number</th>
                      <th>Route Name</th>
                      <th>Start Point</th>
                      <th>End Point</th>
                      <th>Distance</th>
                      <th>District</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routes.length === 0 ? (
                      <tr><td colSpan="6" style={{ textAlign: 'center' }}>No routes found</td></tr>
                    ) : (
                      routes.map(r => (
                        <tr key={r.id}>
                          <td><strong>{r.route_number || 'N/A'}</strong></td>
                          <td>{r.route_name || 'N/A'}</td>
                          <td>{r.start_point || 'N/A'}</td>
                          <td>{r.end_point || 'N/A'}</td>
                          <td>{r.distance_km || 'N/A'} km</td>
                          <td>{r.district_name || getDistrictName(r.district)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
              

              {/* Schedules Tab */}
              {activeTab === 'schedules' && (
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Route</th>
                      <th>Vehicle</th>
                      <th>Driver</th>
                      <th>Conductor</th>
                      <th>Departure</th>
                      <th>Arrival</th>
                      <th>Available Seats</th>
                      <th>Fare</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.length === 0 ? (
                      <tr><td colSpan="10" style={{ textAlign: 'center' }}>No schedules found</td></tr>
                    ) : (
                      schedules.map(s => (
                        <tr key={s.id}>
                          <td>{s.schedule_date || 'N/A'}</td>
                          <td>{s.route_details?.route_name || s.route_details?.route_number || 'N/A'}</td>
                          <td>{s.vehicle_details?.vehicle_number || 'N/A'}</td>
                          <td>{s.driver_name || 'N/A'}</td>
                          <td>{s.conductor_name || 'N/A'}</td>
                          <td>{s.departure_time || 'N/A'}</td>
                          <td>{s.arrival_time || 'N/A'}</td>
                          <td><span className="badge badge-blue">{s.available_seats || 0}</span></td>
                          <td>₹{s.fare || 0}</td>
                          <td>
                            <select
                              className={`status-dropdown status-${getScheduleStatusColor(s.status || 'SCHEDULED')}`}
                              value={s.status || 'SCHEDULED'}
                              onChange={(e) => handleScheduleStatusChange(s.id, e.target.value)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '2px solid',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                minWidth: '140px'
                              }}
                            >
                              <option value="SCHEDULED">📅 Scheduled</option>
                              <option value="IN_PROGRESS">🚌 In Progress</option>
                              <option value="COMPLETED">✅ Completed</option>
                              <option value="CANCELLED">❌ Cancelled</option>
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* Bookings Tab */}
              {activeTab === 'bookings' && (
                <table>
                  <thead>
                    <tr>
                      <th>Booking ID</th>
                      <th>Passenger (Booker)</th>
                      <th>Route</th>
                      <th>Schedule</th>
                      <th>Boarding Point</th>
                      <th>Destination</th>
                      <th>All Passengers</th>
                      <th>Seat Numbers</th>
                      <th>Total Seats</th>
                      <th>Total Fare</th>
                      <th>Status</th>
                      <th>Payment Details</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.length === 0 ? (
                      <tr><td colSpan="13" style={{ textAlign: 'center' }}>No bookings found</td></tr>
                    ) : (
                      bookings.map(b => {
                        let seatNumbers = [];
                        if (b.seat_numbers_list && Array.isArray(b.seat_numbers_list)) {
                          seatNumbers = b.seat_numbers_list;
                        } else if (b.seat_numbers) {
                          try {
                            seatNumbers = typeof b.seat_numbers === 'string' 
                              ? JSON.parse(b.seat_numbers) 
                              : b.seat_numbers;
                          } catch (e) {
                            seatNumbers = [];
                          }
                        }

                        let passengerDetails = [];
                        if (b.passenger_details_list && Array.isArray(b.passenger_details_list)) {
                          passengerDetails = b.passenger_details_list;
                        } else if (b.passenger_details) {
                          try {
                            passengerDetails = typeof b.passenger_details === 'string'
                              ? JSON.parse(b.passenger_details)
                              : b.passenger_details;
                          } catch (e) {
                            passengerDetails = [];
                          }
                        }

                        return (
                          <tr key={b.id}>
                            <td><strong>#{b.booking_id || 'N/A'}</strong></td>
                            <td>
                              {b.passenger_name || 'N/A'}
                              {b.passenger_phone && (
                                <span className="table-subtext">{b.passenger_phone}</span>
                              )}
                            </td>
                            <td>{b.schedule_details?.route_details?.route_name || 'N/A'}</td>
                            <td>
                              {b.schedule_details?.schedule_date || 'N/A'}
                              <span className="table-subtext">
                                {b.schedule_details?.departure_time || 'N/A'}
                              </span>
                            </td>
                            <td>{b.boarding_point || 'N/A'}</td>
                            <td>{b.destination_point || 'N/A'}</td>
                            <td>
                              {passengerDetails.length > 0 ? (
                                <div style={{ 
                                  maxHeight: '150px', 
                                  overflowY: 'auto', 
                                  fontSize: '12px',
                                  padding: '4px'
                                }}>
                                  {passengerDetails.map((p, idx) => (
                                    <div key={idx} style={{ 
                                      marginBottom: '8px',
                                      padding: '6px',
                                      background: '#f8f9fa',
                                      borderRadius: '4px',
                                      borderLeft: '3px solid #667eea'
                                    }}>
                                      <div style={{ fontWeight: '600', color: '#333' }}>
                                        🪑 {p.seat_number}: {p.passenger_name || 'N/A'}
                                      </div>
                                      <div style={{ color: '#666', fontSize: '11px', marginTop: '2px' }}>
                                        {p.passenger_age || 'N/A'} yrs, {p.passenger_gender || 'N/A'}
                                      </div>
                                      <div style={{ color: '#666', fontSize: '11px' }}>
                                        📱 {p.passenger_phone || 'N/A'}
                                      </div>
                                      {p.passenger_alternate_phone && (
                                        <div style={{ color: '#666', fontSize: '11px' }}>
                                          📱 Alt: {p.passenger_alternate_phone}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted">N/A</span>
                              )}
                            </td>
                            <td>
                              <div className="seat-numbers-cell">
                                {seatNumbers.length > 0 ? (
                                  <div className="seat-badges">
                                    {seatNumbers.map((seat, idx) => (
                                      <span key={idx} className="seat-badge">
                                        {seat}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted">N/A</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-blue">{b.seats_booked || 1}</span>
                            </td>
                            <td>₹{b.total_fare || 0}</td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {/* Show booking status - if status is REFUNDED, show CANCELLED instead */}
                                <span className={`status-badge status-${getStatusColor(b.status === 'REFUNDED' ? 'CANCELLED' : b.status)}`}>
                                  {b.status === 'REFUNDED' ? 'CANCELLED' : b.status}
                                </span>
                                {/* Show REFUNDED badge if booking has refund (either status is REFUNDED or has refund_id) */}
                                {(b.status === 'REFUNDED' || (b.payment_details && b.payment_details.refund_id)) && (
                                  <span className="status-badge" style={{
                                    background: '#8b5cf620',
                                    border: '2px solid #8b5cf6',
                                    color: '#8b5cf6',
                                    fontWeight: '600'
                                  }}>
                                    REFUNDED
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              {renderPaymentDetails(b.payment_details)}
                            </td>
                            <td>{b.cancellation_reason || 'N/A'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}

              {/* Leave Requests Tab */}
              {activeTab === 'leaves' && (
                <table>
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Employee ID</th>
                      <th>Type</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveRequests.length === 0 ? (
                      <tr><td colSpan="8" style={{ textAlign: 'center' }}>No leave requests found</td></tr>
                    ) : (
                      leaveRequests.map(leave => (
                        <tr key={leave.id}>
                          <td><strong>{leave.staff_name || 'N/A'}</strong></td>
                          <td>{leave.staff_employee_id || 'N/A'}</td>
                          <td>
                            <span className={`badge ${leave.leave_type === 'HEALTH' ? 'badge-red' : 'badge-purple'}`}>
                              {leave.leave_type}
                            </span>
                          </td>
                          <td>{leave.start_date || 'N/A'}</td>
                          <td>{leave.end_date || 'N/A'}</td>
                          <td>{leave.reason || 'N/A'}</td>
                          <td>
                            <span className={`status-badge status-${getStatusColor(leave.status)}`}>
                              {leave.status}
                            </span>
                          </td>
                          <td>
                            {leave.status === 'PENDING' && (
                              <div className="action-buttons" style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                  className="btn-approve" 
                                  onClick={() => handleLeaveAction(leave.id, 'approve')}
                                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                                >
                                  <Check size={14} /> Approve
                                </button>
                                <button 
                                  className="btn-reject" 
                                  onClick={() => handleLeaveAction(leave.id, 'reject')}
                                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                                >
                                  <XCircle size={14} /> Reject
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
              

              {/* Complaints Tab - Complete Redesigned View */}
              {activeTab === 'complaints' && (
                <div>
                  {/* Passenger / Staff Sub Tabs */}
                  <div style={{
                    background: 'white',
                    padding: '16px 24px',
                    borderRadius: '12px',
                    marginBottom: '24px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    display: 'flex',
                    gap: '12px'
                  }}>
                    <button
                      onClick={() => setComplaintSubTab('passenger')}
                      style={{
                        padding: '12px 24px',
                        borderRadius: '8px',
                        border: 'none',
                        background: complaintSubTab === 'passenger' ? '#3b82f6' : '#f1f5f9',
                        color: complaintSubTab === 'passenger' ? 'white' : '#64748b',
                        fontWeight: '600',
                        fontSize: '15px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <User size={18} />
                      Passenger Complaints (
                        {complaints.filter(c => c.complainant_type === 'PASSENGER').length}
                      )
                    </button>

                    <button
                      onClick={() => setComplaintSubTab('staff')}
                      style={{
                        padding: '12px 24px',
                        borderRadius: '8px',
                        border: 'none',
                        background: complaintSubTab === 'staff' ? '#3b82f6' : '#f1f5f9',
                        color: complaintSubTab === 'staff' ? 'white' : '#64748b',
                        fontWeight: '600',
                        fontSize: '15px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Users size={18} />
                      Staff Complaints (
                        {complaints.filter(c =>
                          ['DRIVER', 'CONDUCTOR', 'SUPERVISOR'].includes(c.complainant_type)
                        ).length}
                      )
                    </button>
                  </div>

                  {/* Search and Filter Controls - Separate Section */}
                  <div style={{ 
                    background: 'white',
                    padding: '20px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    marginBottom: '24px'
                  }}>
                    <h3 style={{ 
                      margin: '0 0 16px 0', 
                      color: '#1e293b', 
                      fontSize: '16px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Search size={18} />
                      Search & Filter Complaints
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: '250px' }}>
                        <input
                          type="text"
                          placeholder="Search by ID, subject, description, passenger name/phone..."
                          value={localSearch}
                          onChange={(e) => setLocalSearch(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: '2px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '15px'
                          }}
                        />
                      </div>
                      <select
                        value={selectedDistrict}
                        onChange={(e) => setSelectedDistrict(e.target.value)}
                        style={{
                          padding: '12px 16px',
                          border: '2px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '15px',
                          minWidth: '180px'
                        }}
                      >
                        <option value="">All Priorities</option>
                        <option value="EMERGENCY">Emergency</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                      </select>
                    </div>
                  </div>

                  {(() => {
                    // Filter complaints
                    const filteredComplaints = getFilteredComplaintsByType().filter(complaint => {

                      const searchLower = searchTerm.toLowerCase();
                      const matchesSearch = !searchTerm || (
                        complaint.complaint_id?.toLowerCase().includes(searchLower) ||
                        complaint.subject?.toLowerCase().includes(searchLower) ||
                        complaint.description?.toLowerCase().includes(searchLower) ||
                        complaint.passenger_name?.toLowerCase().includes(searchLower) ||
                        complaint.passenger_phone?.includes(searchTerm) ||
                        complaint.status?.toLowerCase().includes(searchLower) ||
                        complaint.priority?.toLowerCase().includes(searchLower)
                      );
                      
                      const matchesPriority = !selectedDistrict || complaint.priority === selectedDistrict;
                      
                      return matchesSearch && matchesPriority;
                    });

                    // Sort by status first, then priority, then date
                    const statusOrder = { 'PENDING': 1, 'IN_PROGRESS': 2, 'RESOLVED': 3, 'CLOSED': 4 };
                    const priorityOrder = { 'EMERGENCY': 1, 'HIGH': 2, 'MEDIUM': 3, 'LOW': 4 };
                    
                    const sortedComplaints = [...filteredComplaints].sort((a, b) => {
                      // First sort by status
                      const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
                      if (statusDiff !== 0) return statusDiff;
                      
                      // Then by priority within each status
                      const priorityDiff = (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
                      if (priorityDiff !== 0) return priorityDiff;
                      
                      // Finally by date (newest first)
                      return new Date(b.created_date) - new Date(a.created_date);
                    });

                    // Calculate status counts
                    const statusCounts = {
                      PENDING: filteredComplaints.filter(c => c.status === 'PENDING').length,
                      IN_PROGRESS: filteredComplaints.filter(c => c.status === 'IN_PROGRESS').length,
                      RESOLVED: filteredComplaints.filter(c => c.status === 'RESOLVED').length,
                      CLOSED: filteredComplaints.filter(c => c.status === 'CLOSED').length
                    };

                    return (
                      <>
                        {/* Summary Stats - Separate Section */}
                        <div style={{ 
                          background: 'white',
                          padding: '24px',
                          borderRadius: '12px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                          marginBottom: '24px'
                        }}>
                          <h3 style={{ 
                            margin: '0 0 20px 0', 
                            color: '#1e293b', 
                            fontSize: '18px',
                            fontWeight: '600'
                          }}>
                            Complaint Status Overview
                          </h3>
                          <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                            gap: '16px'
                          }}>
                            <div style={{
                              background: '#fef3c7',
                              border: '2px solid #fbbf24',
                              borderRadius: '12px',
                              padding: '16px',
                              textAlign: 'center'
                            }}>
                              <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
                              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b', marginBottom: '4px' }}>
                                {statusCounts.PENDING}
                              </div>
                              <div style={{ fontSize: '14px', color: '#f59e0b', fontWeight: '600' }}>
                                Pending
                              </div>
                            </div>
                            <div style={{
                              background: '#dbeafe',
                              border: '2px solid #60a5fa',
                              borderRadius: '12px',
                              padding: '16px',
                              textAlign: 'center'
                            }}>
                              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔄</div>
                              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6', marginBottom: '4px' }}>
                                {statusCounts.IN_PROGRESS}
                              </div>
                              <div style={{ fontSize: '14px', color: '#3b82f6', fontWeight: '600' }}>
                                In Progress
                              </div>
                            </div>
                            <div style={{
                              background: '#d1fae5',
                              border: '2px solid #34d399',
                              borderRadius: '12px',
                              padding: '16px',
                              textAlign: 'center'
                            }}>
                              <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
                              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', marginBottom: '4px' }}>
                                {statusCounts.RESOLVED}
                              </div>
                              <div style={{ fontSize: '14px', color: '#10b981', fontWeight: '600' }}>
                                Resolved
                              </div>
                            </div>
                            <div style={{
                              background: '#f3f4f6',
                              border: '2px solid #9ca3af',
                              borderRadius: '12px',
                              padding: '16px',
                              textAlign: 'center'
                            }}>
                              <div style={{ fontSize: '32px', marginBottom: '8px' }}>❌</div>
                              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6b7280', marginBottom: '4px' }}>
                                {statusCounts.CLOSED}
                              </div>
                              <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '600' }}>
                                Closed/Rejected
                              </div>
                            </div>
                          </div>
                        </div>
                        

                        {/* Single Table with All Complaints - Separate Section */}
                        <div style={{ 
                          background: 'white',
                          padding: '24px',
                          borderRadius: '12px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                        }}>
                          <h3 style={{ 
                            margin: '0 0 20px 0', 
                            color: '#1e293b', 
                            fontSize: '18px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <FileText size={20} />
                            {complaintSubTab === 'passenger' ? 'Passenger' : 'Staff'} Complaints 
                          </h3>
                          
                          {sortedComplaints.length === 0 ? (
                            <div style={{
                              background: '#f8f9fa',
                              padding: '60px 20px',
                              borderRadius: '12px',
                              textAlign: 'center'
                            }}>
                              <AlertCircle size={48} style={{ color: '#cbd5e0', marginBottom: '16px' }} />
                              <h3 style={{ color: '#2d3748', marginBottom: '8px' }}>No complaints found</h3>
                              <p style={{ color: '#718096' }}>
                                {searchTerm ? 'Try adjusting your search criteria' : 'No complaints have been filed yet'}
                              </p>
                            </div>
                          ) : (
                            <div className="data-table">
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ minWidth: '1500px' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ minWidth: '100px' }}>ID</th>
                                      <th style={{ minWidth: '180px' }}>Date & Time</th>
                                      <th style={{ minWidth: '200px' }}>{complaintSubTab === 'passenger' ? 'Passenger Details' : 'Staff Details'}</th>
                                      <th style={{ minWidth: '120px' }}>Phone Verified</th>
                                      <th style={{ minWidth: '150px' }}>Travel Info</th>
                                      <th style={{ minWidth: '250px' }}>Subject & Description</th>
                                      <th style={{ minWidth: '80px' }}>Priority</th>
                                      <th style={{ minWidth: '100px' }}>Status</th>
                                      <th style={{ minWidth: '300px' }}>Evidence</th>
                                      <th style={{ minWidth: '250px' }}>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sortedComplaints.map(complaint => (
                                      <tr key={complaint.id}>
                                        {/* ID */}
                                        <td>
                                          <strong style={{ color: '#3b82f6' }}>#{complaint.complaint_id || 'N/A'}</strong>
                                        </td>
                                        
                                        {/* Date & Time */}
                                        <td>
                                          <div style={{ fontSize: '13px' }}>
                                            <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                              📅 {new Date(complaint.created_date).toLocaleDateString('en-IN', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric'
                                              })}
                                            </div>
                                            <div style={{ color: '#64748b', fontSize: '12px' }}>
                                              🕐 {new Date(complaint.created_date).toLocaleTimeString('en-IN', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })}
                                            </div>
                                          </div>
                                        </td>
                                        
                                        {/* Passenger/Staff Details */}
                                        <td>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>
                                              {complaint.passenger_name || 'N/A'}
                                            </div>
                                            {complaint.passenger_phone && (
                                              <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                📱 {complaint.passenger_phone}
                                              </div>
                                            )}
                                            {complaint.seat_number && complaintSubTab === 'passenger' && (
                                              <div style={{
                                                display: 'inline-flex',
                                                padding: '4px 8px',
                                                background: '#f1f5f9',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                color: '#475569',
                                                width: 'fit-content'
                                              }}>
                                                🪑 Seat {complaint.seat_number}
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                        
                                        {/* Phone Verified */}
                                        <td>
                                          {complaint.is_verified ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                              <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '6px 10px',
                                                background: '#d1fae5',
                                                color: '#065f46',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                fontWeight: '700',
                                                border: '2px solid #10b981'
                                              }}>
                                                <CheckCircle size={14} /> VERIFIED
                                              </span>
                                              {complaint.booking_id && (
                                                <span style={{ fontSize: '11px', color: '#065f46', fontWeight: '600' }}>
                                                  Booking: #{complaint.booking_id}
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            <span style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              padding: '6px 10px',
                                              background: '#fee2e2',
                                              color: '#991b1b',
                                              borderRadius: '6px',
                                              fontSize: '12px',
                                              fontWeight: '700',
                                              border: '2px solid #dc2626'
                                            }}>
                                              <XCircle size={14} /> NOT VERIFIED
                                            </span>
                                          )}
                                        </td>
                                        
                                        {/* Travel Info */}
                                        <td>
                                          <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {complaint.route_name ? (
                                              <div style={{ fontWeight: '600', color: '#1e293b' }}>
                                                🚌 {complaint.route_name}
                                              </div>
                                            ) : (
                                              <div style={{ color: '#64748b', fontStyle: 'italic' }}>N/A</div>
                                            )}
                                            {complaint.vehicle_number && (
                                              <div style={{ color: '#64748b' }}>🚐 {complaint.vehicle_number}</div>
                                            )}
                                            {complaint.booking_date && (
                                              <div style={{ color: '#64748b' }}>📅 {complaint.booking_date}</div>
                                            )}
                                          </div>
                                        </td>
                                        
                                        {/* Subject & Description */}
                                        <td>
                                          <div style={{ maxWidth: '250px' }}>
                                            <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '6px', color: '#1e293b' }}>
                                              {complaint.subject}
                                            </div>
                                            <div style={{ 
                                              fontSize: '12px', 
                                              color: '#64748b',
                                              lineHeight: '1.4',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              display: '-webkit-box',
                                              WebkitLineClamp: 2,
                                              WebkitBoxOrient: 'vertical'
                                            }}>
                                              {complaint.description?.substring(0, 100)}
                                              {complaint.description?.length > 100 && '...'}
                                            </div>
                                          </div>
                                        </td>
                                        
                                        {/* Priority */}
                                        <td>
                                          <span className={`priority-badge priority-${getPriorityColor(complaint.priority)}`}>
                                            {complaint.priority}
                                          </span>
                                        </td>
                                        
                                        {/* Status */}
                                        <td>
                                          <span className={`status-badge status-${getStatusColor(complaint.status)}`}>
                                            {complaint.status}
                                          </span>
                                        </td>
                                        
                                        {/* Evidence - IMPROVED: ALL media shows as inline thumbnails */}
                                        <td>
                                          <div style={{ 
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            gap: '8px'
                                          }}>
                                            {/* Seat Photo - FIXED: Now shows thumbnail preview like other media */}
                                            {complaintSubTab === 'passenger' && complaint.seat_photo_url && (
                                              <div style={{
                                                position: 'relative',
                                                border: '2px solid #10b981',
                                                borderRadius: '8px',
                                                overflow: 'hidden',
                                                background: '#f0fdf4'
                                              }}>
                                                <img 
                                                  src={complaint.seat_photo_url}
                                                  alt="Seat verification"
                                                  style={{
                                                    width: '100%',
                                                    height: '120px',
                                                    objectFit: 'cover',
                                                    cursor: 'pointer'
                                                  }}
                                                  onClick={() => window.open(complaint.seat_photo_url, '_blank')}
                                                />
                                                <div style={{
                                                  position: 'absolute',
                                                  bottom: 0,
                                                  left: 0,
                                                  right: 0,
                                                  background: 'rgba(16, 185, 129, 0.9)',
                                                  color: 'white',
                                                  padding: '4px 8px',
                                                  fontSize: '11px',
                                                  fontWeight: '600',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  gap: '4px'
                                                }}>
                                                  <CheckCircle size={12} /> Seat Photo
                                                </div>
                                              </div>
                                            )}
                                            
                                            {/* Issue Photo - Shows thumbnail preview */}
                                            {complaint.issue_photo_url && (
                                              <div style={{
                                                position: 'relative',
                                                border: '2px solid #3b82f6',
                                                borderRadius: '8px',
                                                overflow: 'hidden',
                                                background: '#eff6ff'
                                              }}>
                                                <img 
                                                  src={complaint.issue_photo_url}
                                                  alt="Issue documentation"
                                                  style={{
                                                    width: '100%',
                                                    height: '120px',
                                                    objectFit: 'cover',
                                                    cursor: 'pointer'
                                                  }}
                                                  onClick={() => window.open(complaint.issue_photo_url, '_blank')}
                                                />
                                                <div style={{
                                                  position: 'absolute',
                                                  bottom: 0,
                                                  left: 0,
                                                  right: 0,
                                                  background: 'rgba(59, 130, 246, 0.9)',
                                                  color: 'white',
                                                  padding: '4px 8px',
                                                  fontSize: '11px',
                                                  fontWeight: '600',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  gap: '4px'
                                                }}>
                                                  <Image size={12} /> Issue Photo
                                                </div>
                                              </div>
                                            )}
                                            
                                            {/* Issue Video - Shows video player with label */}
                                            {complaint.issue_video_url && (
                                              <div style={{
                                                position: 'relative',
                                                border: '2px solid #8b5cf6',
                                                borderRadius: '8px',
                                                overflow: 'hidden',
                                                background: '#f5f3ff'
                                              }}>
                                                <video 
                                                  style={{
                                                    width: '100%',
                                                    height: '120px',
                                                    objectFit: 'cover',
                                                    cursor: 'pointer'
                                                  }}
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    window.open(complaint.issue_video_url, '_blank');
                                                  }}
                                                >
                                                  <source src={complaint.issue_video_url} />
                                                </video>
                                                <div style={{
                                                  position: 'absolute',
                                                  bottom: 0,
                                                  left: 0,
                                                  right: 0,
                                                  background: 'rgba(139, 92, 246, 0.9)',
                                                  color: 'white',
                                                  padding: '4px 8px',
                                                  fontSize: '11px',
                                                  fontWeight: '600',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  gap: '4px'
                                                }}>
                                                  <Video size={12} /> Issue Video (Click to play)
                                                </div>
                                              </div>
                                            )}

                                            {!complaint.seat_photo_url && !complaint.issue_photo_url && !complaint.issue_video_url && (
                                              <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                                                No evidence
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        

                                        {/* Actions */}
                                        <td>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <button 
                                              className="btn-view" 
                                              onClick={() => handleViewComplaint(complaint)}
                                              style={{
                                                width: '100%',
                                                padding: '8px 12px',
                                                background: '#3b82f6',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px'
                                              }}
                                            >
                                              <FileText size={14} /> View Details
                                            </button>
                                            
                                            {complaint.status === 'PENDING' && (
                                              <>
                                                <button 
                                                  onClick={() => handleResolveComplaint(complaint.id, 'IN_PROGRESS')}
                                                  style={{
                                                    width: '100%',
                                                    padding: '8px 12px',
                                                    background: '#f59e0b',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '13px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px'
                                                  }}
                                                >
                                                  <Clock size={14} /> In Progress
                                                </button>
                                                <button 
                                                  onClick={() => handleResolveComplaint(complaint.id, 'RESOLVED')}
                                                  style={{
                                                    width: '100%',
                                                    padding: '8px 12px',
                                                    background: '#10b981',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '13px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px'
                                                  }}
                                                >
                                                  <Check size={14} /> Resolve
                                                </button>
                                                <button 
                                                  onClick={() => {
                                                    if (window.confirm('⚠️ Reject as FAKE?')) {
                                                      handleResolveComplaint(complaint.id, 'CLOSED');
                                                    }
                                                  }}
                                                  style={{
                                                    width: '100%',
                                                    padding: '8px 12px',
                                                    background: '#dc2626',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '13px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px'
                                                  }}
                                                >
                                                  <Trash2 size={14} /> Reject
                                                </button>
                                              </>
                                            )}
                                            
                                            {complaint.status === 'IN_PROGRESS' && (
                                              <>
                                                <button 
                                                  onClick={() => handleResolveComplaint(complaint.id, 'RESOLVED')}
                                                  style={{
                                                    width: '100%',
                                                    padding: '8px 12px',
                                                    background: '#10b981',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '13px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px'
                                                  }}
                                                >
                                                  <Check size={14} /> Mark Resolved
                                                </button>
                                                <button 
                                                  onClick={() => {
                                                    if (window.confirm('⚠️ Reject as FAKE?')) {
                                                      handleResolveComplaint(complaint.id, 'CLOSED');
                                                    }
                                                  }}
                                                  style={{
                                                    width: '100%',
                                                    padding: '8px 12px',
                                                    background: '#dc2626',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '13px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px'
                                                  }}
                                                >
                                                  <Trash2 size={14} /> Reject
                                                </button>
                                              </>
                                            )}
                                            
                                            {(complaint.status === 'RESOLVED' || complaint.status === 'CLOSED') && (
                                              <span style={{
                                                fontSize: '12px',
                                                color: '#64748b',
                                                textAlign: 'center',
                                                fontStyle: 'italic',
                                                padding: '8px'
                                              }}>
                                                {complaint.status === 'RESOLVED' ? '✅ Resolved' : '❌ Rejected'}
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
              

              {/* Payroll Tab */}
              {activeTab === 'payroll' && (
                <table>
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Month</th>
                      <th>Basic Salary</th>
                      <th>Net Salary</th>
                      <th>Payment Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrolls.length === 0 ? (
                      <tr><td colSpan="5" style={{ textAlign: 'center' }}>No payroll records found</td></tr>
                    ) : (
                      payrolls.map(p => (
                        <tr key={p.id}>
                          <td><strong>{p.staff_name || 'N/A'}</strong></td>
                          <td>{p.month || 'N/A'}</td>
                          <td>₹{p.basic_salary || 0}</td>
                          <td><strong>₹{p.net_salary || 0}</strong></td>
                          <td>
                            <span className={`status-badge ${p.payment_status ? 'active' : 'inactive'}`}>
                              {p.payment_status ? 'Paid' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
              {activeTab === 'drowsiness' && (
                <DrowsinessAlerts />
              )}

              {activeTab === 'drowsiness-stats' && (
                <DrowsinessStats />
              )}
              {activeTab === 'heart-rate' && (    // ← ADD THIS BLOCK
                <div className="tab-content">
                  
                  <HeartRateAlerts
                    initialAlertId={selectedHeartRateAlertId}
                    onAlertOpened={() => setSelectedHeartRateAlertId(null)} 
                  />
                </div>
              )}
              {activeTab === 'alcohol' && (
                <div className="tab-content">
                  
                  <AlcoholAlerts
                    initialAlertId={selectedAlcoholAlertId}
                    onAlertOpened={() => setSelectedAlcoholAlertId(null)}
                  />
                </div>
              )}

              {activeTab === 'gps-tracking' && (
                <GPSTracking />
              )}
            </div>
          )}
        </div>
      )}
    </main>
  </div>
);
};

export default AdminDashboard;