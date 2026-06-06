import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Calendar, DollarSign, AlertCircle, LogOut, Menu, X,
    Clock, Plus, Search, Home, ChevronRight, User, Truck, ClipboardList, TrendingUp, Trash2,Eye, Activity, Gauge, AlertTriangle, Shield
} from 'lucide-react';
import { transport, auth } from '../../services/api';
import { getUser, removeUser } from '../../utils/auth';
import './Dashboard.css';
import GPSUpdater from './GPSUpdater';
import { alcoholAPI, heartRateAPI } from '../../services/api';

const StaffDashboard = () => {
    const navigate = useNavigate();
    const user = getUser();
    const staffId = user?.id || user?.employee_id || user?.pk || null;

    const [activeTab, setActiveTab] = useState('overview'); 
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [leaveError, setLeaveError] = useState('');
    const [complaintError, setComplaintError] = useState('');
    // Add these new states at the top of StaffDashboard component
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [staffInfo, setStaffInfo] = useState(null);
    const [verifyingPhone, setVerifyingPhone] = useState(false);
    // Add file preview states
    const [photoPreview, setPhotoPreview] = useState(null);
    const [videoPreview, setVideoPreview] = useState(null);
    const [allSchedules, setAllSchedules] = useState([]);
    const [schedules, setSchedules] = useState([]);
    // GPS tracking state
    const [activeGPSSchedule, setActiveGPSSchedule] = useState(null);

    const [allLeaveRequests, setAllLeaveRequests] = useState([]);
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [allComplaints, setAllComplaints] = useState([]);
    const [complaints, setComplaints] = useState([]);
    const [allPayrolls, setAllPayrolls] = useState([]);
    const [payrolls, setPayrolls] = useState([]);
    const [drowsinessStats, setDrowsinessStats] = useState(null);
    const [drowsinessLoading, setDrowsinessLoading] = useState(false);
    const [drowsinessTimeRange, setDrowsinessTimeRange] = useState('7');
    const [showLeaveForm, setShowLeaveForm] = useState(false);
    const [leaveForm, setLeaveForm] = useState({
        leave_type: '',
        start_date: '',
        end_date: '',
        reason: ''
    });

    const [showComplaintForm, setShowComplaintForm] = useState(false);
    const [complaintForm, setComplaintForm] = useState({
        subject: '',
        description: '',
        priority: 'MEDIUM',
        staff_phone: '',
        related_schedule: '',
        issue_photo: null,
        issue_video: null
    });
    
    // ✅ Alcohol alerts state
    const [alcoholAlerts, setAlcoholAlerts]       = useState([]);
    const [alcoholLoading, setAlcoholLoading]     = useState(false);
    const [alcoholTimeRange, setAlcoholTimeRange] = useState('7'); // days

    const [heartAlerts, setHeartAlerts]       = useState([]);
    const [heartLoading, setHeartLoading]     = useState(false);
    const [heartTimeRange, setHeartTimeRange] = useState('7');
    const getStatusColor = (status) => {
        const statusKey = status?.toUpperCase();
        const colors = {
            PENDING: 'yellow',
            APPROVED: 'green',
            REJECTED: 'red',
            RESOLVED: 'green',
            IN_PROGRESS: 'blue',
            PAID: 'green', 
            PENDING_PAYMENT: 'yellow',
            LOW: 'green', 
            MEDIUM: 'yellow', 
            HIGH: 'orange', 
            EMERGENCY: 'red', 
            'N/A':'gray',
        };
        return colors[statusKey] || 'gray';
    };

    const filterData = useCallback((data, tab, term) => {
        if (!term) return data;
        const lowerTerm = term.toLowerCase();

        switch (tab) {
            case 'schedules':
                return data.filter(schedule => 
                    (schedule.route_details?.route_name?.toLowerCase().includes(lowerTerm) ||
                    schedule.route_name?.toLowerCase().includes(lowerTerm) ||
                    schedule.vehicle_details?.vehicle_number?.toLowerCase().includes(lowerTerm) ||
                    schedule.vehicle_number?.toLowerCase().includes(lowerTerm) ||
                    schedule.status?.toLowerCase().includes(lowerTerm))
                );
            case 'leaves':
                return data.filter(leave => 
                    leave.reason?.toLowerCase().includes(lowerTerm) ||
                    leave.leave_type?.toLowerCase().includes(lowerTerm) ||
                    leave.status?.toLowerCase().includes(lowerTerm)
                );
            case 'complaints':
    return data.filter(complaint => {
        // Convert complaint ID to string and lowercase for search
        const complaintIdStr = String(complaint.complaint_id || complaint.id || '').toLowerCase();
        const searchWithoutHash = lowerTerm.replace('#', ''); // Remove # if user types it
        
        return (
            complaintIdStr.includes(searchWithoutHash) ||
            complaintIdStr.includes(lowerTerm) ||
            complaint.priority?.toLowerCase().includes(lowerTerm) ||
            complaint.subject?.toLowerCase().includes(lowerTerm) ||
            complaint.description?.toLowerCase().includes(lowerTerm) ||
            complaint.status?.toLowerCase().includes(lowerTerm)
        );
    });
            case 'payroll':
                return data.filter(payroll => 
                    (payroll.month ? new Date(payroll.month).toLocaleString('default', { month: 'long', year: 'numeric' }).toLowerCase().includes(lowerTerm) : false) ||
                    (payroll.payment_status === true ? 'paid' : 'pending_payment').includes(lowerTerm)
                );
            default:
                return data;
        }
    }, []);

    const fetchDataForTab = useCallback(async (tabName, setter, allSetter) => {
        const params = { staff_id: staffId };
        let fetchedData = [];

        try {
            switch (tabName) {
                case 'schedules':
                    fetchedData = (await transport.getSchedules(params))?.data || [];
                    break;
                case 'leaves':
                    fetchedData = (await transport.getLeaveRequests(params))?.data || [];
                    break;
                case 'complaints':
                    fetchedData = (await transport.getComplaints({ complainant: staffId }))?.data || [];
                    break;
                case 'payroll':
                    fetchedData = (await transport.getPayrolls(params))?.data || [];
                    break;
                default:
                    return;
            }
        } catch (error) {
            console.error(`Error loading ${tabName} data:`, error);
        }
        
        const finalData = Array.isArray(fetchedData) ? fetchedData : [];
        
        if (allSetter) allSetter(finalData);
        if (setter) setter(finalData);
    }, [staffId]);

    const loadTabData = useCallback(async () => {
        setLoading(true);

        switch (activeTab) {
            case 'schedules':
                await fetchDataForTab('schedules', setSchedules, setAllSchedules);
                break;
            case 'leaves':
                await fetchDataForTab('leaves', setLeaveRequests, setAllLeaveRequests);
                break;
            case 'complaints':
                await fetchDataForTab('complaints', setComplaints, setAllComplaints);
                break;
            case 'payroll':
                await fetchDataForTab('payroll', setPayrolls, setAllPayrolls);
                break;
            default:
                break;
        }
        setLoading(false);
    }, [activeTab, fetchDataForTab]);

    const initialLoadAllData = useCallback(async () => {
        if (!staffId) return;
        setLoading(true);

        await Promise.all([
            fetchDataForTab('schedules', setSchedules, setAllSchedules),
            fetchDataForTab('leaves', setLeaveRequests, setAllLeaveRequests),
            fetchDataForTab('complaints', setComplaints, setAllComplaints),
            fetchDataForTab('payroll', setPayrolls, setAllPayrolls),
        ]);
        
        setLoading(false);
    }, [staffId, fetchDataForTab]);

    useEffect(() => {
        initialLoadAllData();
    }, [initialLoadAllData]);

    // Drowsiness stats fetcher - must be defined before use in effects below
    const fetchDrowsinessStats = useCallback(async () => {
        if (user?.user_type !== 'DRIVER') return;
        
        if (!staffId) {
            console.error('Staff ID is null, cannot fetch drowsiness stats');
            setDrowsinessStats(null);
            return;
        }
        
        setDrowsinessLoading(true);
        try {
            const response = await transport.getDrowsinessStats(staffId, drowsinessTimeRange);
            console.log('🔍 Raw drowsiness response:', response.data);
            
            let statsData = response.data;
            
            // Handle nested response
            if (statsData.stats) {
                statsData = statsData.stats;
            }
            
            // Convert backend format to frontend format
            // Backend sends: critical_alerts, high_alerts, medium_alerts, low_alerts
            // Frontend needs: severity_breakdown: { Critical, High, Medium, Low }
            if (!statsData.severity_breakdown) {
                statsData.severity_breakdown = {
                    Critical: statsData.critical_alerts || 0,
                    High: statsData.high_alerts || 0,
                    Medium: statsData.medium_alerts || 0,
                    Low: statsData.low_alerts || 0
                };
            }
            
            // Map avg_closure to avg_closure_duration
            if (statsData.avg_closure && !statsData.avg_closure_duration) {
                statsData.avg_closure_duration = statsData.avg_closure;
            }
            
            console.log('📊 Normalized stats:', {
                total_alerts: statsData.total_alerts,
                avg_ear: statsData.avg_ear,
                avg_closure_duration: statsData.avg_closure_duration,
                severity_breakdown: statsData.severity_breakdown
            });
            
            setDrowsinessStats(statsData);
        } catch (error) {
            console.error('❌ Error fetching drowsiness stats:', error);
            console.error('Error details:', error.response?.data);
            setDrowsinessStats(null);
        } finally {
            setDrowsinessLoading(false);
        }
    }, [staffId, drowsinessTimeRange, user?.user_type]);

    const fetchHeartAlerts = useCallback(async () => {
        if (user?.user_type !== 'DRIVER') return;
        setHeartLoading(true);
        try {
            const response = await heartRateAPI.getMyAlerts();
            setHeartAlerts(response.data || []);
        } catch (error) {
            console.error('❌ Error fetching heart alerts:', error);
            setHeartAlerts([]);
        } finally {
            setHeartLoading(false);
        }
    }, [user?.user_type]);
    
    // ✅ Fetch this driver's own alcohol alerts
    const fetchAlcoholAlerts = useCallback(async () => {
        if (user?.user_type !== 'DRIVER') return;
        setAlcoholLoading(true);
        try {
            const response = await alcoholAPI.getMyAlerts();
            setAlcoholAlerts(response.data || []);
        } catch (error) {
            console.error('❌ Error fetching alcohol alerts:', error);
            setAlcoholAlerts([]);
        } finally {
            setAlcoholLoading(false);
        }
    }, [user?.user_type]);

    // Fetch drowsiness stats when on overview tab
    useEffect(() => {
        if (activeTab === 'overview' && user?.user_type === 'DRIVER') {
            fetchHeartAlerts();
            fetchDrowsinessStats();
            fetchAlcoholAlerts();
        }
    }, [activeTab, fetchDrowsinessStats, fetchAlcoholAlerts, fetchHeartAlerts, user?.user_type]);

    useEffect(() => {
        if (activeTab !== 'overview' && activeTab !== 'profile') {
            loadTabData();
            setSearchTerm('');
        }
    }, [activeTab, loadTabData]);
    
    useEffect(() => {
        if (activeTab === 'schedules') setSchedules(filterData(allSchedules, activeTab, searchTerm));
        if (activeTab === 'leaves') setLeaveRequests(filterData(allLeaveRequests, activeTab, searchTerm));
        if (activeTab === 'complaints') setComplaints(filterData(allComplaints, activeTab, searchTerm));
        if (activeTab === 'payroll') setPayrolls(filterData(allPayrolls, activeTab, searchTerm));
    }, [searchTerm, filterData, activeTab, allSchedules, allLeaveRequests, allComplaints, allPayrolls]);
    // Auto-refresh for all tabs
    useEffect(() => {
        let refreshInterval;
        
        if (activeTab === 'overview') {
            // Overview tab - refresh drowsiness stats and data (30 seconds)
            refreshInterval = setInterval(() => {
                console.log('🔄 Auto-refreshing overview...');
                initialLoadAllData();
                if (user?.user_type === 'DRIVER') {
                    fetchDrowsinessStats();
                }
            }, 30000);
        } else if (activeTab === 'schedules') {
            // Schedules - staff need to see schedule changes (45 seconds)
            refreshInterval = setInterval(() => {
                console.log('🔄 Auto-refreshing schedules...');
                loadTabData();
            }, 45000);
        } else if (activeTab === 'leaves') {
            // Leaves - check for approval status updates (60 seconds)
            refreshInterval = setInterval(() => {
                console.log('🔄 Auto-refreshing leaves...');
                loadTabData();
            }, 60000);
        } else if (activeTab === 'complaints') {
            // Complaints - check for resolution updates (60 seconds)
            refreshInterval = setInterval(() => {
                console.log('🔄 Auto-refreshing complaints...');
                loadTabData();
            }, 60000);
        } else if (activeTab === 'payroll') {
            // Payroll - monthly data, slower refresh (90 seconds)
            refreshInterval = setInterval(() => {
                console.log('🔄 Auto-refreshing payroll...');
                loadTabData();
            }, 90000);
        }
        // Note: 'profile' tab doesn't need auto-refresh (static personal data)
        
        // Cleanup interval when tab changes or component unmounts
        return () => {
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
        };
    }, [activeTab, loadTabData, initialLoadAllData, fetchDrowsinessStats, user]);
    const handleLogout = async () => {
        try {
            await auth.logout();
            removeUser();
            navigate('/login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const handleLeaveFormChange = (e) => {
        setLeaveForm({ ...leaveForm, [e.target.name]: e.target.value });
    };

    // Update handleComplaintFormChange to handle files
    const handleComplaintFormChange = (e) => {
        const { name, value, type, files } = e.target;
    
        if (type === 'file') {
            const file = files[0];
            if (file) {
                setComplaintForm({ ...complaintForm, [name]: file });
            
                // Create preview
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (name === 'issue_photo') {
                        setPhotoPreview(reader.result);
                    } else if (name === 'issue_video') {
                        setVideoPreview(URL.createObjectURL(file));
                    }
                };
                reader.readAsDataURL(file);
            }
        } else {
            setComplaintForm({ ...complaintForm, [name]: value });
        }
    };

    // Handle removing uploaded files
    const handleRemoveFile = (fileType) => {
        setComplaintForm(prev => ({
            ...prev,
            [fileType]: null
        }));
        
        if (fileType === 'issue_photo') {
            setPhotoPreview(null);
        } else if (fileType === 'issue_video') {
            setVideoPreview(null);
        }
        
        // Reset the file input
        const input = document.getElementById(fileType);
        if (input) input.value = '';
        
        setComplaintError('');
    };

    // New function to verify staff phone
    const handleVerifyPhone = async () => {
        if (!complaintForm.staff_phone || complaintForm.staff_phone.trim() === '') {
            setComplaintError('Please enter your phone number');
            return;
        }
    
        setVerifyingPhone(true);
        setComplaintError('');
    
        try {
            const response = await transport.verifyStaffPhone({
                staff_phone: complaintForm.staff_phone
            });
        
            if (response.data.verified) {
                setPhoneVerified(true);
                setStaffInfo(response.data.staff_info);
                setComplaintError('');
                alert('✅ Phone verified successfully! You can now proceed with your complaint.');
            } else {
                setPhoneVerified(false);
                setStaffInfo(null);
                setComplaintError(response.data.message || 'Phone verification failed');
            }
        } catch (error) {
            setPhoneVerified(false);
            setStaffInfo(null);
            setComplaintError(
                error.response?.data?.error || 
                error.response?.data?.message || 
                'Failed to verify phone number'
            );
        } finally {
            setVerifyingPhone(false);
        }
    };

    const handleLeaveSubmit = async (e) => {
        e.preventDefault();
        setLeaveError('');
        setLoading(true);

        try {
            if (!staffId) throw new Error('Staff ID not found in local user. Cannot submit leave.');

            const payload = {
                ...leaveForm,
                staff: staffId
            };

            await transport.createLeaveRequest(payload);
            
            setShowLeaveForm(false);
            setLeaveForm({ leave_type: '', start_date: '', end_date: '', reason: '' });

            await fetchDataForTab('leaves', setLeaveRequests, setAllLeaveRequests);
            
            alert('Leave request submitted successfully!');
        } catch (error) {
            setLeaveError(error.response?.data?.detail || error.response?.data?.message || 'Failed to submit leave request. Please check your data.');
        } finally {
            setLoading(false);
        }
    };
    // Updated complaint submit handler
    const handleComplaintSubmit = async (e) => {
        e.preventDefault();
        setComplaintError('');
    
        // Validate phone verification
        if (!phoneVerified) {
            setComplaintError('⚠️ Please verify your phone number first');
            return;
        }
    
        // Validate evidence
        if (!complaintForm.issue_photo && !complaintForm.issue_video) {
            setComplaintError('⚠️ Please upload either a photo OR video as evidence');
            return;
        }
    
        setLoading(true);

        try {
            // Create FormData for file upload
            const formData = new FormData();
            formData.append('subject', complaintForm.subject);
            formData.append('description', complaintForm.description);
            formData.append('priority', complaintForm.priority);
            formData.append('staff_phone', complaintForm.staff_phone);
        
            if (complaintForm.related_schedule) {
                formData.append('related_schedule', complaintForm.related_schedule);
            }
        
            if (complaintForm.issue_photo) {
                formData.append('issue_photo', complaintForm.issue_photo);
            }
        
            if (complaintForm.issue_video) {
                formData.append('issue_video', complaintForm.issue_video);
            }
            await transport.createComplaint(formData);

            // Reset form
            setShowComplaintForm(false);
            setComplaintForm({
                subject: '',
                description: '',
                priority: 'MEDIUM',
                staff_phone: '',
                related_schedule: '',
                issue_photo: null,
                issue_video: null
            });
            setPhoneVerified(false);
            setStaffInfo(null);
            setPhotoPreview(null);
            setVideoPreview(null);

            await fetchDataForTab('complaints', setComplaints, setAllComplaints);

            alert('✅ Complaint filed successfully!');
        } catch (error) {
            setComplaintError(
                error.response?.data?.error || 
                error.response?.data?.message || 
                'Failed to file complaint. Please check your data.'
            );
        } finally {
            setLoading(false);
        }
    };
    // Get all IN_PROGRESS schedules
    // ✅ FIXED: Get TODAY's IN_PROGRESS schedules where user is ASSIGNED
    const inProgressSchedules = schedules.filter(schedule => {
    // Check if IN_PROGRESS
    const isInProgress =
        schedule.status === 'IN_PROGRESS' ||
        schedule.status === 'in_progress';

    // Check if today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const scheduleDate = new Date(schedule.schedule_date);
    scheduleDate.setHours(0, 0, 0, 0);

    const isToday = scheduleDate.getTime() === today.getTime();

    // Check assignment
    const isDriver =
        schedule.driver === user.id ||
        schedule.driver_id === user.id ||
        schedule.driver_details?.id === user.id;

    const isConductor =
        schedule.conductor === user.id ||
        schedule.conductor_id === user.id ||
        schedule.conductor_details?.id === user.id;

    const isAssigned = isDriver || isConductor;

    return isInProgress && isToday && isAssigned;
    });

    // Auto select first active schedule
    useEffect(() => {
    if (inProgressSchedules.length > 0 && !activeGPSSchedule) {
        setActiveGPSSchedule(inProgressSchedules[0].id);
    }
    }, [inProgressSchedules, activeGPSSchedule]);

    const renderOverview = () => {
        const pendingLeaves = allLeaveRequests.filter(r => r.status?.toUpperCase() === 'PENDING').length;
        const openComplaints = allComplaints.filter(c => {
            const status = c.status?.toUpperCase();
            return status === 'PENDING' || status === 'IN_PROGRESS';
        }).length;
        const lastPaid = allPayrolls.find(p => p.payment_status === true || p.status?.toUpperCase() === 'PAID');
        
        const today = new Date().toISOString().split('T')[0];
        const schedulesToday = allSchedules.filter(s => s.schedule_date === today).length;

        const summaryCards = [
            { label: 'Schedules', value: schedulesToday, icon: Truck, color: 'blue', tab: 'schedules' },
            { label: 'Pending Leaves', value: pendingLeaves, icon: Clock, color: 'yellow', tab: 'leaves' },
            { label: 'Open Complaints', value: openComplaints, icon: AlertCircle, color: 'red', tab: 'complaints' },
            { label: 'Total Payroll Records', value: allPayrolls.length, icon: DollarSign, color: 'green', tab: 'payroll' },
        ];
        
        return (
            <div className="overview-content">
                <h2>Quick Summary</h2>
                <div className="stats-grid">
                    {summaryCards.map((card, index) => (
                        <div 
                            className={`stat-card stat-${card.color}`} 
                            key={index} 
                            onClick={() => setActiveTab(card.tab)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="stat-icon" style={{ backgroundColor: card.color === 'blue' ? '#667eea' : card.color === 'yellow' ? '#facc15' : card.color === 'red' ? '#ef4444' : '#10b981' }}>
                                <card.icon size={30} />
                            </div>
                            <div>
                                <p className="stat-label">{card.label}</p>
                                <h3 className="stat-value">{card.value}</h3>
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="pending-summary">
                    <h2>Pending Actions & Notifications</h2>
                    <div className="summary-cards">
                        <div className="summary-card" onClick={() => setActiveTab('leaves')}>
                            <ClipboardList size={40} color="#7c3aed" />
                            <div>
                                <h4>Leave Requests (Pending)</h4>
                                <p className="summary-count">{pendingLeaves}</p>
                            </div>
                            <ChevronRight size={20} color="#718096" style={{marginLeft: 'auto'}} />
                        </div>
                        <div className="summary-card" onClick={() => setActiveTab('complaints')}>
                            <AlertCircle size={40} color="#991b1b" />
                            <div>
                                <h4>Open Complaints (Unresolved)</h4>
                                <p className="summary-count">{openComplaints}</p>
                            </div>
                            <ChevronRight size={20} color="#718096" style={{marginLeft: 'auto'}} />
                        </div>
                    </div>
                </div>

                <div className="notifications-container">
                    <div 
                        className="notifications-section" 
                        onClick={() => setActiveTab('payroll')}
                        style={{ cursor: 'pointer' }}
                    >
                        <h2><TrendingUp size={24} /> Financial Activity</h2>
                        {lastPaid ? (
                            <p>Your last payroll ({new Date(lastPaid.month).toLocaleString('default', { month: 'long', year: 'numeric' })}) was successfully **{lastPaid.status || 'PAID'}**. Net Salary: **₹{lastPaid.net_salary?.toLocaleString() || 0}**.</p>
                        ) : (
                            <p>No recent payroll information available yet. Check the Payroll tab for details.</p>
                        )}
                        <p style={{marginTop: '10px', fontSize: '14px', color: '#4a5568'}}>Welcome back! Stay updated on your schedules and ensure all your documents are current.</p>
                    </div>
                </div>
                {/* 🚨 Driver Drowsiness Alerts */}
                {/* 🚨 Driver Drowsiness Alerts - IMPROVED UI */}
                {user?.user_type === 'DRIVER' && (
                <>
                {/* ❤️ Heart Rate Alerts — FIRST */}
                <div className="driver-drowsiness-section" style={{ marginTop: '30px' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <span style={{ fontSize: '28px' }}>❤️</span>
                        My Heart Rate Alerts
                    </h2>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <label style={{ fontSize: '15px', fontWeight: '600', color: '#2d3748' }}>
                            Time Period:
                        </label>
                        <select
                            value={heartTimeRange}
                            onChange={(e) => setHeartTimeRange(e.target.value)}
                            style={{
                                padding: '8px 16px', borderRadius: '8px',
                                border: '2px solid #e2e8f0', fontSize: '14px',
                                fontWeight: '500', cursor: 'pointer',
                                background: 'white', color: '#2d3748', outline: 'none'
                            }}
                        >
                            <option value="1">Last 24 Hours</option>
                            <option value="7">Last 7 Days</option>
                            <option value="30">Last 30 Days</option>
                            <option value="90">Last 90 Days</option>
                        </select>
                    </div>

                    {heartLoading ? (
                        <div style={{
                            padding: '40px', textAlign: 'center', color: '#718096',
                            background: 'white', borderRadius: '12px', border: '2px dashed #e2e8f0'
                        }}>
                            Loading heart rate alerts...
                        </div>
                    ) : (() => {
                        const cutoff = new Date();
                        cutoff.setDate(cutoff.getDate() - parseInt(heartTimeRange));
                        const filtered = heartAlerts.filter(a => new Date(a.detected_at) >= cutoff);
                        const totalAlerts   = filtered.length;
                        const newAlerts     = filtered.filter(a => a.status === 'NEW').length;
                        const resolvedCount = filtered.filter(a => a.status === 'RESOLVED').length;

                        return (
                            <>
                                {/* Stats Cards */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                    gap: '20px', marginBottom: '30px'
                                }}>
                                    <div className="stat-card" style={{
                                        background: 'white', padding: '24px', borderRadius: '12px',
                                        display: 'flex', alignItems: 'center', gap: '20px',
                                        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                                        borderLeft: '4px solid #ec4899'
                                    }}>
                                        <div style={{
                                            width: '56px', height: '56px', borderRadius: '14px',
                                            background: '#fdf2f8', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', fontSize: '28px'
                                        }}>❤️</div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '14px', color: '#718096', fontWeight: '500' }}>Total Alerts</p>
                                            <h3 style={{ margin: '4px 0 0', fontSize: '32px', fontWeight: '700', color: '#2d3748' }}>{totalAlerts}</h3>
                                        </div>
                                    </div>

                                    <div className="stat-card" style={{
                                        background: 'white', padding: '24px', borderRadius: '12px',
                                        display: 'flex', alignItems: 'center', gap: '20px',
                                        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                                        borderLeft: '4px solid #ef4444'
                                    }}>
                                        <div style={{
                                            width: '56px', height: '56px', borderRadius: '14px',
                                            background: '#fef2f2', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', fontSize: '28px'
                                        }}>🚨</div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '14px', color: '#718096', fontWeight: '500' }}>Unresolved</p>
                                            <h3 style={{ margin: '4px 0 0', fontSize: '32px', fontWeight: '700', color: '#dc2626' }}>{newAlerts}</h3>
                                        </div>
                                    </div>

                                    <div className="stat-card" style={{
                                        background: 'white', padding: '24px', borderRadius: '12px',
                                        display: 'flex', alignItems: 'center', gap: '20px',
                                        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                                        borderLeft: '4px solid #10b981'
                                    }}>
                                        <div style={{
                                            width: '56px', height: '56px', borderRadius: '14px',
                                            background: '#f0fdf4', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', fontSize: '28px'
                                        }}>✅</div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '14px', color: '#718096', fontWeight: '500' }}>Resolved</p>
                                            <h3 style={{ margin: '4px 0 0', fontSize: '32px', fontWeight: '700', color: '#10b981' }}>{resolvedCount}</h3>
                                        </div>
                                    </div>
                                </div>

                                {/* Recent Alerts List */}
                                {filtered.length > 0 && (
                                    <div style={{
                                        background: 'white', borderRadius: '12px',
                                        border: '1px solid #fbcfe8', overflow: 'hidden',
                                        marginBottom: '20px',
                                        boxShadow: '0 2px 8px rgba(236,72,153,0.08)'
                                    }}>
                                        <div style={{
                                            background: '#fdf2f8', padding: '14px 20px',
                                            borderBottom: '1px solid #fbcfe8',
                                            fontWeight: '700', fontSize: '14px', color: '#9d174d'
                                        }}>
                                            Recent Detections
                                        </div>
                                        {filtered.slice(0, 5).map((alert, i) => (
                                            <div key={alert.id} style={{
                                                display: 'flex', alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '14px 20px',
                                                borderBottom: i < Math.min(filtered.length, 5) - 1 ? '1px solid #fce7f3' : 'none',
                                                background: 'white'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ fontSize: '22px' }}>❤️</span>
                                                    <div>
                                                        <div style={{ fontWeight: '600', fontSize: '15px', color: '#ec4899' }}>
                                                            BPM: {alert.heart_rate} ({alert.alert_type})
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                                            Range: {alert.threshold_low}–{alert.threshold_high} BPM · {alert.time_since_detection || new Date(alert.detected_at).toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span style={{
                                                    padding: '4px 12px', borderRadius: '20px',
                                                    fontSize: '12px', fontWeight: '600',
                                                    background: alert.status === 'NEW' ? '#fef2f2' :
                                                                alert.status === 'ACKNOWLEDGED' ? '#fdf2f8' : '#f0fdf4',
                                                    color: alert.status === 'NEW' ? '#dc2626' :
                                                        alert.status === 'ACKNOWLEDGED' ? '#9d174d' : '#16a34a',
                                                    border: alert.status === 'NEW' ? '1px solid #fecaca' :
                                                            alert.status === 'ACKNOWLEDGED' ? '1px solid #fbcfe8' : '1px solid #bbf7d0'
                                                }}>
                                                    {alert.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Safety Panel */}
                                <div style={{
                                    background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                                    padding: '24px', borderRadius: '12px',
                                    color: 'white', boxShadow: '0 4px 15px rgba(236,72,153,0.3)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                        <span style={{ fontSize: '24px' }}>🛡️</span>
                                        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>
                                            Heart Rate Safety Status
                                        </h3>
                                    </div>
                                    <p style={{ margin: '0 0 12px 0', opacity: 0.95, lineHeight: '1.6', fontSize: '15px' }}>
                                        {totalAlerts === 0
                                            ? '🎉 No heart rate alerts in this period. Your cardiovascular health looks stable!'
                                            : newAlerts > 0
                                                ? `🚨 ${newAlerts} unresolved heart rate alert${newAlerts > 1 ? 's' : ''} detected. Please inform your supervisor and consult a doctor.`
                                                : `✅ ${totalAlerts} alert${totalAlerts > 1 ? 's' : ''} detected, all resolved. Stay hydrated and take rest breaks.`
                                        }
                                    </p>
                                    <div style={{
                                        background: 'rgba(255,255,255,0.15)', padding: '12px 16px',
                                        borderRadius: '8px', fontSize: '13px', lineHeight: '1.5'
                                    }}>
                                        💡 <strong>Reminder:</strong> These alerts are informational only, not a medical diagnosis. Consult a doctor if you experience repeated high heart rate readings.
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>
                <div className="driver-drowsiness-section" style={{ marginTop: '30px' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <Activity size={28} style={{ color: '#667eea' }} />
                        My Drowsiness Alerts
                    </h2>
                    
                    {/* Time Range Filter */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '20px',
                        flexWrap: 'wrap',
                        gap: '15px'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            <label style={{
                                fontSize: '15px',
                                fontWeight: '600',
                                color: '#2d3748'
                            }}>
                                Time Period:
                            </label>
                            <select 
                                value={drowsinessTimeRange}
                                onChange={(e) => setDrowsinessTimeRange(e.target.value)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: '2px solid #e2e8f0',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    background: 'white',
                                    color: '#2d3748',
                                    outline: 'none'
                                }}
                            >
                                <option value="1">Last 24 Hours</option>
                                <option value="7">Last 7 Days</option>
                                <option value="30">Last 30 Days</option>
                                <option value="90">Last 90 Days</option>
                            </select>
                        </div>
                    </div>

                    {drowsinessLoading ? (
                        <div style={{ 
                            padding: '40px', 
                            textAlign: 'center', 
                            color: '#718096',
                            background: 'white',
                            borderRadius: '12px',
                            border: '2px dashed #e2e8f0'
                        }}>
                            Loading drowsiness data...
                        </div>
                    ) : !drowsinessStats ? (
                        <div style={{ 
                            padding: '40px', 
                            textAlign: 'center', 
                            color: '#718096',
                            background: 'white',
                            borderRadius: '12px',
                            border: '2px dashed #e2e8f0'
                        }}>
                            No drowsiness data available
                        </div>
                    ) : (
                        <>
                            {/* Stats Cards Grid */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                                gap: '20px',
                                marginBottom: '30px'
                            }}>
                                {/* Total Alerts Card */}
                                <div className="stat-card" style={{
                                    background: 'white',
                                    padding: '24px',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '20px',
                                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
                                    borderLeft: '4px solid #8b5cf6',
                                    transition: 'transform 0.3s, box-shadow 0.3s',
                                    cursor: 'default'
                                }}>
                                    <div style={{
                                        width: '64px',
                                        height: '64px',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                                        flexShrink: 0
                                    }}>
                                        <AlertTriangle size={30} />
                                    </div>
                                    <div>
                                        <p style={{
                                            color: '#718096',
                                            fontSize: '14px',
                                            margin: '0 0 8px 0'
                                        }}>Total Alerts</p>
                                        <h3 style={{
                                            fontSize: '32px',
                                            fontWeight: 'bold',
                                            color: '#2d3748',
                                            margin: 0
                                        }}>{drowsinessStats.total_alerts || 0}</h3>
                                    </div>
                                </div>

                                {/* Avg EAR Card */}
                                <div className="stat-card" style={{
                                    background: 'white',
                                    padding: '24px',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '20px',
                                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
                                    borderLeft: '4px solid #3b82f6',
                                    transition: 'transform 0.3s, box-shadow 0.3s',
                                    cursor: 'default'
                                }}>
                                    <div style={{
                                        width: '64px',
                                        height: '64px',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                        flexShrink: 0
                                    }}>
                                        <Eye size={30} />
                                    </div>
                                    <div>
                                        <p style={{
                                            color: '#718096',
                                            fontSize: '14px',
                                            margin: '0 0 8px 0'
                                        }}>Avg EAR</p>
                                        <h3 style={{
                                            fontSize: '32px',
                                            fontWeight: 'bold',
                                            color: '#2d3748',
                                            margin: 0
                                        }}>{drowsinessStats.avg_ear ? parseFloat(drowsinessStats.avg_ear).toFixed(3) : '0.000'}</h3>
                                    </div>
                                </div>

                                {/* Avg Closure Duration Card */}
                                <div className="stat-card" style={{
                                    background: 'white',
                                    padding: '24px',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '20px',
                                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
                                    borderLeft: '4px solid #06b6d4',
                                    transition: 'transform 0.3s, box-shadow 0.3s',
                                    cursor: 'default'
                                }}>
                                    <div style={{
                                        width: '64px',
                                        height: '64px',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                                        flexShrink: 0
                                    }}>
                                        <Clock size={30} />
                                    </div>
                                    <div>
                                        <p style={{
                                            color: '#718096',
                                            fontSize: '14px',
                                            margin: '0 0 8px 0'
                                        }}>Avg Closure</p>
                                        <h3 style={{
                                            fontSize: '32px',
                                            fontWeight: 'bold',
                                            color: '#2d3748',
                                            margin: 0
                                        }}>{drowsinessStats.avg_closure_duration ? parseFloat(drowsinessStats.avg_closure_duration).toFixed(1) : '0.0'}s</h3>
                                    </div>
                                </div>

                                {/* Severity Breakdown Card */}
                                <div className="stat-card" style={{
                                    background: 'white',
                                    padding: '24px',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '20px',
                                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
                                    borderLeft: '4px solid #f59e0b',
                                    transition: 'transform 0.3s, box-shadow 0.3s',
                                    cursor: 'default'
                                }}>
                                    <div style={{
                                        width: '64px',
                                        height: '64px',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                        flexShrink: 0
                                    }}>
                                        <Gauge size={30} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{
                                            color: '#718096',
                                            fontSize: '14px',
                                            margin: '0 0 12px 0',
                                            fontWeight: '600'
                                        }}>Severity Breakdown</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ 
                                                    fontSize: '13px', 
                                                    color: '#dc2626',
                                                    fontWeight: '600',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}>
                                                    <span style={{
                                                        width: '8px',
                                                        height: '8px',
                                                        borderRadius: '50%',
                                                        background: '#dc2626'
                                                    }}></span>
                                                    Critical
                                                </span>
                                                <span style={{ 
                                                    fontSize: '18px', 
                                                    fontWeight: 'bold',
                                                    color: '#2d3748'
                                                }}>{drowsinessStats.severity_breakdown?.Critical || 0}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ 
                                                    fontSize: '13px', 
                                                    color: '#ea580c',
                                                    fontWeight: '600',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}>
                                                    <span style={{
                                                        width: '8px',
                                                        height: '8px',
                                                        borderRadius: '50%',
                                                        background: '#ea580c'
                                                    }}></span>
                                                    High
                                                </span>
                                                <span style={{ 
                                                    fontSize: '18px', 
                                                    fontWeight: 'bold',
                                                    color: '#2d3748'
                                                }}>{drowsinessStats.severity_breakdown?.High || 0}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ 
                                                    fontSize: '13px', 
                                                    color: '#f59e0b',
                                                    fontWeight: '600',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}>
                                                    <span style={{
                                                        width: '8px',
                                                        height: '8px',
                                                        borderRadius: '50%',
                                                        background: '#f59e0b'
                                                    }}></span>
                                                    Medium
                                                </span>
                                                <span style={{ 
                                                    fontSize: '18px', 
                                                    fontWeight: 'bold',
                                                    color: '#2d3748'
                                                }}>{drowsinessStats.severity_breakdown?.Medium || 0}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ 
                                                    fontSize: '13px', 
                                                    color: '#10b981',
                                                    fontWeight: '600',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}>
                                                    <span style={{
                                                        width: '8px',
                                                        height: '8px',
                                                        borderRadius: '50%',
                                                        background: '#10b981'
                                                    }}></span>
                                                    Low
                                                </span>
                                                <span style={{ 
                                                    fontSize: '18px', 
                                                    fontWeight: 'bold',
                                                    color: '#2d3748'
                                                }}>{drowsinessStats.severity_breakdown?.Low || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Safety Insights Panel */}
                            <div style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                padding: '24px',
                                borderRadius: '12px',
                                color: 'white',
                                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
                            }}>
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '12px',
                                    marginBottom: '16px'
                                }}>
                                    <Shield size={24} />
                                    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>
                                        Safety Performance
                                    </h3>
                                </div>
                                <p style={{ 
                                    margin: '0 0 12px 0', 
                                    opacity: 0.95,
                                    lineHeight: '1.6',
                                    fontSize: '15px'
                                }}>
                                    {drowsinessStats.total_alerts === 0 ? (
                                        "🎉 Excellent! No drowsiness alerts detected in this period. Keep up the great work!"
                                    ) : drowsinessStats.severity_breakdown?.Critical > 0 ? (
                                        `⚠️ ${drowsinessStats.severity_breakdown.Critical} critical alert${drowsinessStats.severity_breakdown.Critical > 1 ? 's' : ''} detected. Please prioritize rest and consider adjusting your schedule.`
                                    ) : drowsinessStats.severity_breakdown?.High > 0 ? (
                                        `⚡ ${drowsinessStats.severity_breakdown.High} high-severity alert${drowsinessStats.severity_breakdown.High > 1 ? 's' : ''} recorded. Monitor your alertness and take breaks when needed.`
                                    ) : (
                                        `✅ ${drowsinessStats.total_alerts} alert${drowsinessStats.total_alerts > 1 ? 's' : ''} detected, mostly low-to-medium severity. Continue practicing good sleep habits.`
                                    )}
                                </p>
                                <div style={{
                                    background: 'rgba(255, 255, 255, 0.15)',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    lineHeight: '1.5'
                                }}>
                                    💡 <strong>Tip:</strong> Maintain 7-8 hours of quality sleep, take regular breaks during long drives, and stay hydrated to maintain optimal alertness.
                                </div>
                            </div>
                        </>
                    )}
                </div>
                {/* 🍺 Driver Alcohol Alerts */}
                
                <div className="driver-drowsiness-section" style={{ marginTop: '30px' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <span style={{ fontSize: '28px' }}>🍺</span>
                        My Alcohol Alerts
                    </h2>

                    {/* Time Range Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <label style={{ fontSize: '15px', fontWeight: '600', color: '#2d3748' }}>
                            Time Period:
                        </label>
                        <select
                            value={alcoholTimeRange}
                            onChange={(e) => {
                                setAlcoholTimeRange(e.target.value);
                            }}
                            style={{
                                padding: '8px 16px', borderRadius: '8px',
                                border: '2px solid #e2e8f0', fontSize: '14px',
                                fontWeight: '500', cursor: 'pointer',
                                background: 'white', color: '#2d3748', outline: 'none'
                            }}
                        >
                            <option value="1">Last 24 Hours</option>
                            <option value="7">Last 7 Days</option>
                            <option value="30">Last 30 Days</option>
                            <option value="90">Last 90 Days</option>
                        </select>
                    </div>

                    {alcoholLoading ? (
                        <div style={{
                            padding: '40px', textAlign: 'center', color: '#718096',
                            background: 'white', borderRadius: '12px', border: '2px dashed #e2e8f0'
                        }}>
                            Loading alcohol alerts...
                        </div>
                    ) : (() => {
                        // Filter by selected time range on the frontend
                        const cutoff = new Date();
                        cutoff.setDate(cutoff.getDate() - parseInt(alcoholTimeRange));
                        const filtered = alcoholAlerts.filter(a => new Date(a.detected_at) >= cutoff);
                        const totalAlerts   = filtered.length;
                        const newAlerts     = filtered.filter(a => a.status === 'NEW').length;
                        const resolvedCount = filtered.filter(a => a.status === 'RESOLVED').length;

                        return (
                            <>
                                {/* Stats Cards - matching drowsiness style */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                    gap: '20px', marginBottom: '30px'
                                }}>
                                    {/* Total Alerts */}
                                    <div className="stat-card" style={{
                                        background: 'white', padding: '24px', borderRadius: '12px',
                                        display: 'flex', alignItems: 'center', gap: '20px',
                                        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                                        borderLeft: '4px solid #f59e0b'
                                    }}>
                                        <div style={{
                                            width: '56px', height: '56px', borderRadius: '14px',
                                            background: '#fef3c7', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', fontSize: '28px'
                                        }}>🍺</div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '14px', color: '#718096', fontWeight: '500' }}>
                                                Total Alerts
                                            </p>
                                            <h3 style={{ margin: '4px 0 0', fontSize: '32px', fontWeight: '700', color: '#2d3748' }}>
                                                {totalAlerts}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* Unresolved */}
                                    <div className="stat-card" style={{
                                        background: 'white', padding: '24px', borderRadius: '12px',
                                        display: 'flex', alignItems: 'center', gap: '20px',
                                        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                                        borderLeft: '4px solid #ef4444'
                                    }}>
                                        <div style={{
                                            width: '56px', height: '56px', borderRadius: '14px',
                                            background: '#fef2f2', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', fontSize: '28px'
                                        }}>🚨</div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '14px', color: '#718096', fontWeight: '500' }}>
                                                Unresolved
                                            </p>
                                            <h3 style={{ margin: '4px 0 0', fontSize: '32px', fontWeight: '700', color: '#dc2626' }}>
                                                {newAlerts}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* Resolved */}
                                    <div className="stat-card" style={{
                                        background: 'white', padding: '24px', borderRadius: '12px',
                                        display: 'flex', alignItems: 'center', gap: '20px',
                                        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                                        borderLeft: '4px solid #10b981'
                                    }}>
                                        <div style={{
                                            width: '56px', height: '56px', borderRadius: '14px',
                                            background: '#f0fdf4', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', fontSize: '28px'
                                        }}>✅</div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '14px', color: '#718096', fontWeight: '500' }}>
                                                Resolved
                                            </p>
                                            <h3 style={{ margin: '4px 0 0', fontSize: '32px', fontWeight: '700', color: '#10b981' }}>
                                                {resolvedCount}
                                            </h3>
                                        </div>
                                    </div>
                                </div>

                                {/* Recent Alerts List */}
                                {filtered.length > 0 && (
                                    <div style={{
                                        background: 'white', borderRadius: '12px',
                                        border: '1px solid #fde68a', overflow: 'hidden',
                                        marginBottom: '20px',
                                        boxShadow: '0 2px 8px rgba(245,158,11,0.08)'
                                    }}>
                                        <div style={{
                                            background: '#fffbeb', padding: '14px 20px',
                                            borderBottom: '1px solid #fde68a',
                                            fontWeight: '700', fontSize: '14px', color: '#92400e'
                                        }}>
                                            Recent Detections
                                        </div>
                                        {filtered.slice(0, 5).map((alert, i) => (
                                            <div key={alert.id} style={{
                                                display: 'flex', alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '14px 20px',
                                                borderBottom: i < Math.min(filtered.length, 5) - 1 ? '1px solid #fef9c3' : 'none',
                                                background: 'white'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ fontSize: '22px' }}>🍺</span>
                                                    <div>
                                                        <div style={{ fontWeight: '600', fontSize: '15px', color: '#f59e0b' }}>
                                                            Sensor: {alert.sensor_value}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                                            Threshold: {alert.threshold} · {alert.time_since_detection || new Date(alert.detected_at).toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span style={{
                                                    padding: '4px 12px', borderRadius: '20px',
                                                    fontSize: '12px', fontWeight: '600',
                                                    background: alert.status === 'NEW' ? '#fef2f2' :
                                                                alert.status === 'ACKNOWLEDGED' ? '#fffbeb' : '#f0fdf4',
                                                    color: alert.status === 'NEW' ? '#dc2626' :
                                                        alert.status === 'ACKNOWLEDGED' ? '#b45309' : '#16a34a',
                                                    border: alert.status === 'NEW' ? '1px solid #fecaca' :
                                                            alert.status === 'ACKNOWLEDGED' ? '1px solid #fde68a' : '1px solid #bbf7d0'
                                                }}>
                                                    {alert.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Safety Panel - matching drowsiness style */}
                                <div style={{
                                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                    padding: '24px', borderRadius: '12px',
                                    color: 'white', boxShadow: '0 4px 15px rgba(245,158,11,0.3)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                        <span style={{ fontSize: '24px' }}>🛡️</span>
                                        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>
                                            Alcohol Safety Status
                                        </h3>
                                    </div>
                                    <p style={{ margin: '0 0 12px 0', opacity: 0.95, lineHeight: '1.6', fontSize: '15px' }}>
                                        {totalAlerts === 0
                                            ? '🎉 No alcohol detections in this period. Excellent safety record!'
                                            : newAlerts > 0
                                                ? `🚨 ${newAlerts} unresolved alcohol alert${newAlerts > 1 ? 's' : ''} detected. Please contact your supervisor.`
                                                : `✅ ${totalAlerts} alert${totalAlerts > 1 ? 's' : ''} detected, all resolved. Keep up the safe driving!`
                                        }
                                    </p>
                                    <div style={{
                                        background: 'rgba(255,255,255,0.15)', padding: '12px 16px',
                                        borderRadius: '8px', fontSize: '13px', lineHeight: '1.5'
                                    }}>
                                        💡 <strong>Reminder:</strong> Never drive after consuming alcohol. If you believe this alert is a false positive, report it to your supervisor immediately.
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>
                </>
                )}
                
            </div>
        );
    };
    
    return (
        <div className="dashboard">
            <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
               <div className="sidebar-header staff-header">
    <label className="avatar-wrapper">
        <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                    const imageUrl = URL.createObjectURL(file);
                    localStorage.setItem("staffProfileImage", imageUrl);
                    window.location.reload();
                }
            }}
        />

        <div className="user-avatar-large">
            {localStorage.getItem("staffProfileImage") ? (
                <img
                    src={localStorage.getItem("staffProfileImage")}
                    alt="Staff"
                />
            ) : (
                user?.name?.charAt(0)?.toUpperCase() || "S"
            )}
        </div>
    </label>

    <h3 className="staff-name">
        {user?.name || "STAFF NAME"}
    </h3>

    <span className="staff-role-badge">
        {user?.user_type || "STAFF"}
    </span>
</div>

                <nav className="sidebar-nav">
                    <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
                        <Home size={20} /><span>Overview</span>
                    </button>
                    <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>
                        <User size={20} /><span>My Profile</span>
                    </button>
                    <button className={activeTab === 'schedules' ? 'active' : ''} onClick={() => setActiveTab('schedules')}>
                        <Calendar size={20} /><span>My Schedules</span>
                    </button>
                    <button className={activeTab === 'leaves' ? 'active' : ''} onClick={() => setActiveTab('leaves')}>
                        <ClipboardList size={20} /><span>Leave Requests</span>
                        {allLeaveRequests.filter(r => r.status?.toUpperCase() === 'PENDING').length > 0 && (
                            <span className="badge badge-red">{allLeaveRequests.filter(r => r.status?.toUpperCase() === 'PENDING').length}</span>
                        )}
                    </button>
                    <button className={activeTab === 'complaints' ? 'active' : ''} onClick={() => setActiveTab('complaints')}>
                        <AlertCircle size={20} /><span>Complaints</span>
                        {allComplaints.filter(c => {
                            const status = c.status?.toUpperCase();
                            return status === 'PENDING' || status === 'IN_PROGRESS';
                        }).length > 0 && (
                            <span className="badge badge-red">{allComplaints.filter(c => {
                                const status = c.status?.toUpperCase();
                                return status === 'PENDING' || status === 'IN_PROGRESS';
                            }).length}</span>
                        )}
                    </button>
                    <button className={activeTab === 'payroll' ? 'active' : ''} onClick={() => setActiveTab('payroll')}>
                        <DollarSign size={20} /><span>Payroll</span>
                    </button>
                </nav>

                <button className="logout-btn" onClick={handleLogout}>
                    <LogOut size={20} /><span>Logout</span>
                </button>
            </aside>

            <main className="main-content">
                <header className="dashboard-header">
                    <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                    <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace(/schedules|leaves|complaints|payroll|profile|overview/, m => ` ${m}`).trim()}</h1>
                    <div className="header-actions">
                        {activeTab === 'leaves' && (
                            <button className="btn btn-primary" onClick={() => { setLeaveError(''); setShowLeaveForm(true); }} disabled={loading}>
                                <Plus size={18} /> Request Leave
                            </button>
                        )}
                        {activeTab === 'complaints' && (
                            <button className="btn btn-primary" onClick={() => { setComplaintError(''); setShowComplaintForm(true); }} disabled={loading}>
                                <Plus size={18} /> File Complaint
                            </button>
                        )}
                    </div>
                </header>
                
                {activeTab === 'overview' && renderOverview()}

                {activeTab === 'profile' && (
                    <div className="profile-content">
                        <div className="profile-card">
                            <div className="profile-header">
                                <div className="profile-avatar">{user?.name?.charAt(0) || 'S'}</div>
                                <div>
                                    <h2>{user?.name}</h2>
                                    <p className="profile-role">{user?.user_type}</p>
                                </div>
                            </div>

                            <div className="profile-details">
                                <div className="detail-row"><span className="detail-label">Employee ID</span><span className="detail-value">{user?.employee_id || staffId}</span></div>
                                <div className="detail-row"><span className="detail-label">Phone Number</span><span className="detail-value">{user?.phone_number || 'N/A'}</span></div>
                                <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value">{user?.email || 'N/A'}</span></div>
                                <div className="detail-row"><span className="detail-label">Working District</span><span className="detail-value">{user?.working_district || 'N/A'}</span></div>
                                <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value"><span className="status-badge status-green">Active</span></span></div>
                                <div className="detail-row"><span className="detail-label">Joined Date</span><span className="detail-value">{user?.date_joined ? new Date(user.date_joined).toLocaleDateString() : 'N/A'}</span></div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab !== 'profile' && activeTab !== 'overview' && (
                    <div className="tab-content">
                        <div className="search-box">
                            <Search size={20} />
                            <input 
                                type="text" 
                                placeholder={
                                    activeTab === 'leaves' ? 'Search by Reason or Type...' : 
                                    activeTab === 'complaints' ? 'Search by Priority, Subject, or Description...' :
                                    activeTab === 'payroll' ? 'Search by Month/Year or Status...' :
                                    'Search by route, vehicle, or status...'
                                } 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                            />
                        </div>

                        {loading && (
                            <div className="loading">Loading {activeTab} data...</div>
                        )}
                        
                        {!loading && (
                            <div className="data-table">
                                {/* Schedules Table */}
                                {activeTab === 'schedules' && (
                                    <>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Route Name</th>
                                                    <th>Date & Time</th>
                                                    <th>Route ID</th>
                                                    <th>Vehicle</th>
                                                    <th>Seats</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {schedules.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="6" style={{textAlign: 'center'}}>
                                                            No schedules found
                                                        </td>
                                                    </tr>
                                                ) : schedules.map(schedule => (
                                                    <tr key={schedule.id}>
                                                        <td>
                                                            <strong>
                                                                {schedule.route_details?.route_name || 
                                                                schedule.route_name || 
                                                                schedule.route || 
                                                                'N/A'}
                                                            </strong>
                                                        </td>
                                                        <td>
                                                            {schedule.schedule_date || schedule.date || 'N/A'}
                                                            <span className="table-subtext">
                                                                {schedule.departure_time || schedule.start_time || 'N/A'}
                                                                {schedule.arrival_time ? ` - ${schedule.arrival_time}` : ''}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className="route-badge">
                                                                {schedule.route_details?.route_number || 
                                                                schedule.route_number || 
                                                                schedule.route_id || 
                                                                'N/A'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <Truck size={16} style={{marginRight: '5px', verticalAlign: 'middle'}} />
                                                            {schedule.vehicle_details?.vehicle_number || 
                                                            schedule.vehicle_number || 
                                                            schedule.vehicle || 
                                                            'N/A'}
                                                        </td>
                                                        <td>
                                                            {schedule.available_seats !== undefined ? 
                                                            schedule.available_seats : 
                                                            'N/A'}
                                                        </td>
                                                        <td>
                                                            <span className={`status-badge status-${getStatusColor(schedule.status)}`}>
                                                                {schedule.status || 'N/A'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {/* 🛰️ GPS Tracking Section */}
                                        {inProgressSchedules.length > 0 && (
                                        <div style={{ marginTop: '30px' }}>
                                            <div style={{
                                            padding: '15px',
                                            backgroundColor: '#eff6ff',
                                            borderRadius: '8px',
                                            border: '2px solid #3b82f6',
                                            marginBottom: '15px'
                                            }}>
                                            <h3 style={{ margin: 0, color: '#1e40af' }}>
                                                🚗 Active Trip GPS Tracking
                                            </h3>
                                            </div>

                                            {/* Tabs */}
                                            {inProgressSchedules.length > 1 && (
                                            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                                {inProgressSchedules.map(schedule => (
                                                <button
                                                    key={schedule.id}
                                                    onClick={() => setActiveGPSSchedule(schedule.id)}
                                                    style={{
                                                    padding: '10px',
                                                    borderRadius: '6px',
                                                    border: activeGPSSchedule === schedule.id
                                                        ? '2px solid #2563eb'
                                                        : '1px solid #cbd5f5',
                                                    backgroundColor:
                                                        activeGPSSchedule === schedule.id ? '#dbeafe' : '#fff',
                                                    cursor: 'pointer'
                                                    }}
                                                >
                                                    <strong>{schedule.route_details?.route_name || schedule.route_name}</strong>
                                                    <br />
                                                    <small>{schedule.vehicle_details?.vehicle_number || schedule.vehicle_number}</small>
                                                </button>
                                                ))}
                                            </div>
                                            )}

                                            {/* GPS */}
                                            {inProgressSchedules
                                            .filter(s => s.id === activeGPSSchedule)
                                            .map(schedule => (
                                                <GPSUpdater key={schedule.id} schedule={schedule} />
                                            ))}
                                        </div>
                                        )}

                                       
                                    </>
                                )}

                                {/* Leaves Table */}
                                {activeTab === 'leaves' && (
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Type</th><th>Duration</th><th>Reason</th><th>Status</th><th>Applied Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {leaveRequests.length === 0 ? (
                                                <tr><td colSpan="5" style={{textAlign: 'center'}}>No leave requests found</td></tr>
                                            ) : leaveRequests.map(leave => (
                                                <tr key={leave.id}>
                                                    <td><span className="badge badge-purple">{leave.leave_type || leave.type || 'N/A'}</span></td>
                                                    <td>
                                                        {leave.start_date || 'N/A'} to {leave.end_date || 'N/A'}
                                                        <span className="table-subtext">({(new Date(leave.end_date) - new Date(leave.start_date)) / (1000 * 60 * 60 * 24) + 1} days)</span>
                                                    </td>
                                                    <td>{leave.reason || 'N/A'}</td>
                                                    <td><span className={`status-badge status-${getStatusColor(leave.status)}`}>{leave.status || 'PENDING'}</span></td>
                                                    <td>{leave.applied_date ? new Date(leave.applied_date).toLocaleDateString() : (leave.created_at ? new Date(leave.created_at).toLocaleDateString() : 'N/A')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}

                                {/* Complaints Table */}
{activeTab === 'complaints' && (
    <table>
        <thead>
            <tr>
                <th>Complaint ID</th>
                <th>Date & Time</th>
                <th>Phone Verified</th>
                <th>Subject</th>
                <th>Description</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Evidence</th>
            </tr>
        </thead>
        <tbody>
            {complaints.length === 0 ? (
                <tr><td colSpan="8" style={{textAlign: 'center'}}>No complaints found</td></tr> 
            ) : complaints.map(complaint => (
                <tr key={complaint.id}>
                    {/* Complaint ID */}
                    <td>
                        <strong style={{color: '#667eea'}}>
                            #{complaint.complaint_id || complaint.id}
                        </strong>
                    </td>
                    
                    {/* Date & Time */}
                    <td>
                        <div style={{fontSize: '13px'}}>
                            <div style={{fontWeight: '600', marginBottom: '4px'}}>
                                {complaint.created_date ? new Date(complaint.created_date).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                }) : 'N/A'}
                            </div>
                            <div style={{color: '#64748b', fontSize: '12px'}}>
                                {complaint.created_date ? new Date(complaint.created_date).toLocaleTimeString('en-IN', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                }) : ''}
                            </div>
                        </div>
                    </td>
                    
                    {/* Phone Verified */}
                    <td>
                        {complaint.is_verified ? (
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                background: '#d1fae5',
                                color: '#065f46',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '600',
                                border: '1px solid #10b981'
                            }}>
                                ✅ Verified
                            </span>
                        ) : (
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                background: '#fee2e2',
                                color: '#991b1b',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '600',
                                border: '1px solid #dc2626'
                            }}>
                                 Not Verified
                            </span>
                        )}
                    </td>
                    
                    {/* Subject */}
                    <td><strong>{complaint.subject || complaint.title || 'No Subject'}</strong></td>
                    
                    {/* Description */}
                    <td style={{maxWidth: '300px', whiteSpace: 'normal', fontSize: '14px'}}>
                        {complaint.description || complaint.details || 'No description'}
                    </td>
                    
                    {/* Priority */}
                    <td>
                        <span className={`priority-badge priority-${getStatusColor(complaint.priority?.toUpperCase() || 'MEDIUM')}`}>
                            {complaint.priority || 'N/A'} 
                        </span>
                    </td>
                    
                    {/* Status */}
                    <td>
                        <span className={`status-badge status-${getStatusColor(complaint.status)}`}>
                            {complaint.status || 'PENDING'}
                        </span>
                    </td>
                    
                    {/* Evidence Media */}
                    <td>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px'}}>
                            {/* Issue Photo */}
                            {complaint.issue_photo_url ? (
                                <a 
                                    href={complaint.issue_photo_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 10px',
                                        background: '#dbeafe',
                                        color: '#1e40af',
                                        borderRadius: '6px',
                                        textDecoration: 'none',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        border: '1px solid #3b82f6',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.background = '#bfdbfe'}
                                    onMouseOut={(e) => e.currentTarget.style.background = '#dbeafe'}
                                >
                                    📷 Photo
                                </a>
                            ) : (
                                <span style={{
                                    fontSize: '11px',
                                    color: '#64748b',
                                    fontStyle: 'italic'
                                }}>
                                    No Photo
                                </span>
                            )}
                            
                            {/* Issue Video */}
                            {complaint.issue_video_url ? (
                                <a 
                                    href={complaint.issue_video_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 10px',
                                        background: '#f3e8ff',
                                        color: '#5b21b6',
                                        borderRadius: '6px',
                                        textDecoration: 'none',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        border: '1px solid #8b5cf6',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.background = '#e9d5ff'}
                                    onMouseOut={(e) => e.currentTarget.style.background = '#f3e8ff'}
                                >
                                     Video
                                </a>
                            ) : (
                                <span style={{
                                    fontSize: '11px',
                                    color: '#64748b',
                                    fontStyle: 'italic'
                                }}>
                                    No Video
                                </span>
                            )}
                        </div>
                    </td>
                </tr>
            ))}
        </tbody>
    </table>
    )}

                                {/* Payroll Table */}
                                {activeTab === 'payroll' && (
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Month</th><th>Basic (₹)</th><th>Allowances (₹)</th>
                                                <th>Deductions (₹)</th><th>Net Salary (₹)</th><th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {payrolls.length === 0 ? (
                                                <tr><td colSpan="6" style={{textAlign: 'center'}}>No payroll records found</td></tr>
                                            ) : payrolls.map(payroll => {
                                                const statusText = payroll.payment_status === true || payroll.status?.toUpperCase() === 'PAID' ? 'PAID' : 'PENDING_PAYMENT';
                                                return (
                                                    <tr key={payroll.id}>
                                                        <td><strong>{payroll.month ? new Date(payroll.month).toLocaleString('default', { month: 'long', year: 'numeric' }) : 'N/A'}</strong></td>
                                                        <td>{payroll.basic_salary?.toLocaleString() || 0}</td>
                                                        <td className="text-green">{payroll.allowances?.toLocaleString() || 0}</td>
                                                        <td className="text-red">{payroll.deductions?.toLocaleString() || 0}</td>
                                                        <td><strong>{payroll.net_salary?.toLocaleString() || 0}</strong></td>
                                                        <td><span className={`status-badge status-${getStatusColor(statusText)}`}>{statusText}</span></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Leave Request Modal - FIXED OPTIONS */}
            {showLeaveForm && (
                <div className="modal-overlay" onClick={() => setShowLeaveForm(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2>Request Leave</h2>
                        <button className="close-btn" onClick={() => setShowLeaveForm(false)} disabled={loading}><X size={20} /></button>
                        {leaveError && <p className="error-message" style={{color: 'red'}}>{leaveError}</p>}
                        <form onSubmit={handleLeaveSubmit}>
                            <div className="form-group">
                                <label htmlFor="leave_type">Leave Type</label>
                                <select id="leave_type" name="leave_type" value={leaveForm.leave_type} onChange={handleLeaveFormChange} required disabled={loading}>
                                    <option value="">Select Type</option>
                                    {/* These values now match the Django models.py LEAVE_TYPE choices */}
                                    <option value="HEALTH">Health</option>
                                    <option value="RELATIVE_DEAD">Relative Dead</option>
                                    <option value="FAMILY_FUNCTION">Family Function</option>
                                    <option value="PERSONAL">Personal</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="start_date">Start Date</label>
                                <input type="date" id="start_date" name="start_date" value={leaveForm.start_date} onChange={handleLeaveFormChange} required disabled={loading}/>
                            </div>
                            <div className="form-group">
                                <label htmlFor="end_date">End Date</label>
                                <input type="date" id="end_date" name="end_date" value={leaveForm.end_date} onChange={handleLeaveFormChange} required disabled={loading}/>
                            </div>
                            <div className="form-group">
                                <label htmlFor="reason">Reason</label>
                                <textarea id="reason" name="reason" rows="4" value={leaveForm.reason} onChange={handleLeaveFormChange} required disabled={loading}></textarea>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowLeaveForm(false)} disabled={loading}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={loading || !leaveForm.leave_type || !leaveForm.start_date || !leaveForm.end_date || !leaveForm.reason}>
                                    {loading ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Complaint Modal */}
                        {showComplaintForm && (
                <div className="modal-overlay" onClick={() => {
                    setShowComplaintForm(false);
                    setPhoneVerified(false);
                    setStaffInfo(null);
                    setPhotoPreview(null);
                    setVideoPreview(null);
                }}>
                    <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
                        <h2>🎫 File a New Complaint</h2>
                        <button 
                            className="close-btn" 
                            onClick={() => {
                                setShowComplaintForm(false);
                                setPhoneVerified(false);
                                setStaffInfo(null);
                                setPhotoPreview(null);
                                setVideoPreview(null);
                            }} 
                            disabled={loading}
                        >
                            <X size={20} />
                        </button>
                        
                        {complaintError && (
                            <div className="error-message" style={{
                                padding: '12px',
                                backgroundColor: '#fee',
                                border: '1px solid #fcc',
                                borderRadius: '8px',
                                color: '#c33',
                                marginBottom: '15px'
                            }}>
                                {complaintError}
                            </div>
                        )}
                        
                        <form onSubmit={handleComplaintSubmit}>
                            {/* STEP 1: Phone Verification */}
                            <div className="verification-section" style={{
                                padding: '20px',
                                backgroundColor: phoneVerified ? '#f0fdf4' : '#f8fafc',
                                borderRadius: '10px',
                                marginBottom: '20px',
                                border: phoneVerified ? '2px solid #22c55e' : '2px solid #e2e8f0'
                            }}>
                                <h3 style={{marginBottom: '15px'}}>
                                    {phoneVerified ? '✅ Phone Verified' : '📱 Step 1: Verify Your Phone Number'}
                                </h3>
                                
                                {!phoneVerified ? (
                                    <>
                                        <div className="form-group">
                                            <label htmlFor="staff_phone">
                                                Your Registered Phone Number *
                                            </label>
                                            <input 
                                                type="tel" 
                                                id="staff_phone"
                                                name="staff_phone"
                                                placeholder="Enter your 10-digit phone number"
                                                value={complaintForm.staff_phone}
                                                onChange={handleComplaintFormChange}
                                                maxLength="10"
                                                pattern="[0-9]{10}"
                                                required
                                                disabled={loading || verifyingPhone}
                                                style={{fontSize: '16px'}}
                                            />
                                            <small style={{color: '#64748b', display: 'block', marginTop: '5px'}}>
                                                Enter your registered phone number to verify your identity
                                            </small>
                                        </div>
                                        
                                        <button 
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={handleVerifyPhone}
                                            disabled={
                                                !complaintForm.staff_phone || 
                                                complaintForm.staff_phone.length !== 10 || 
                                                verifyingPhone || 
                                                loading
                                            }
                                            style={{marginTop: '10px'}}
                                        >
                                            {verifyingPhone ? 'Verifying...' : '🔐 Verify Phone Number'}
                                        </button>
                                    </>
                                ) : (
                                    <div className="verified-info" style={{
                                        padding: '15px',
                                        backgroundColor: 'white',
                                        borderRadius: '8px',
                                        border: '1px solid #86efac'
                                    }}>
                                        <div style={{display: 'grid', gap: '10px'}}>
                                            <div><strong>Name:</strong> {staffInfo?.name}</div>
                                            <div><strong>Employee ID:</strong> {staffInfo?.employee_id}</div>
                                            <div><strong>Phone:</strong> {staffInfo?.phone}</div>
                                            <div><strong>Role:</strong> {staffInfo?.user_type}</div>
                                            <div><strong>District:</strong> {staffInfo?.working_district}</div>
                                        </div>
                                        
                                        <button 
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => {
                                                setPhoneVerified(false);
                                                setStaffInfo(null);
                                                setComplaintForm({...complaintForm, staff_phone: ''});
                                            }}
                                            style={{marginTop: '15px', fontSize: '14px'}}
                                        >
                                            Change Phone Number
                                        </button>
                                    </div>
                                )}
                            </div>
            
                            {/* STEP 2: Complaint Details - Only show if verified */}
                            {phoneVerified && (
                                <>
                                    <div style={{
                                        padding: '20px',
                                        backgroundColor: '#f8fafc',
                                        borderRadius: '10px',
                                        marginBottom: '20px'
                                    }}>
                                        <h3 style={{marginBottom: '15px'}}>📝 Step 2: Complaint Details</h3>
                                        
                                        <div className="form-group">
                                            <label htmlFor="subject">Subject *</label>
                                            <input 
                                                type="text" 
                                                id="subject"
                                                name="subject"
                                                placeholder="Brief description of the issue"
                                                value={complaintForm.subject}
                                                onChange={handleComplaintFormChange}
                                                required
                                                disabled={loading}
                                                minLength="5"
                                            />
                                        </div>
            
                                        <div className="form-group">
                                            <label htmlFor="priority">Priority *</label>
                                            <select 
                                                id="priority"
                                                name="priority"
                                                value={complaintForm.priority}
                                                onChange={handleComplaintFormChange}
                                                required
                                                disabled={loading}
                                            >
                                                <option value="LOW">Low</option>
                                                <option value="MEDIUM">Medium</option>
                                                <option value="HIGH">High</option>
                                                <option value="EMERGENCY">Emergency</option>
                                            </select>
                                        </div>
            
                                        <div className="form-group">
                                            <label htmlFor="description">Description *</label>
                                            <textarea 
                                                id="description"
                                                name="description"
                                                rows="5"
                                                placeholder="Provide detailed information about the issue..."
                                                value={complaintForm.description}
                                                onChange={handleComplaintFormChange}
                                                required
                                                disabled={loading}
                                                minLength="10"
                                            ></textarea>
                                        </div>
            
                                        <div className="form-group">
                                            <label htmlFor="related_schedule">
                                                Related Schedule (Optional)
                                            </label>
                                            <select 
                                                id="related_schedule"
                                                name="related_schedule"
                                                value={complaintForm.related_schedule}
                                                onChange={handleComplaintFormChange}
                                                disabled={loading}
                                            >
                                                <option value="">Select a schedule (if applicable)</option>
                                                {allSchedules.map(schedule => (
                                                    <option key={schedule.id} value={schedule.id}>
                                                        {schedule.route_details?.route_name || schedule.route_name} - 
                                                        {schedule.schedule_date} at {schedule.departure_time} 
                                                        ({schedule.vehicle_details?.vehicle_number || schedule.vehicle_number})
                                                    </option>
                                                ))}
                                            </select>
                                            <small style={{color: '#64748b', display: 'block', marginTop: '5px'}}>
                                                Select if this complaint is about a specific trip
                                            </small>
                                        </div>
                                    </div>
            
                                    {/* STEP 3: Evidence Upload */}
                                    <div style={{
                                        padding: '20px',
                                        backgroundColor: '#fef3c7',
                                        borderRadius: '10px',
                                        marginBottom: '20px',
                                        border: '2px solid #fbbf24'
                                    }}>
                                        <h3 style={{marginBottom: '10px'}}>
                                            📸 Step 3: Upload Evidence (Mandatory)
                                        </h3>
                                        <p style={{
                                            marginBottom: '15px',
                                            color: '#92400e',
                                            fontWeight: '500'
                                        }}>
                                            ⚠️ You must upload either a photo OR video as evidence
                                        </p>
                                        
                                        <div className="form-group">
                                            <label htmlFor="issue_photo">
                                                Issue Photo
                                            </label>
                                            <input 
                                                type="file" 
                                                id="issue_photo"
                                                name="issue_photo"
                                                accept="image/*"
                                                onChange={handleComplaintFormChange}
                                                disabled={loading}
                                            />
                                            <small style={{color: '#64748b', display: 'block', marginTop: '5px'}}>
                                                Upload a photo of the issue (Max: 10MB)
                                            </small>
                                            {photoPreview && (
                                                <div style={{marginTop: '10px', position: 'relative'}}>
                                                    <img 
                                                        src={photoPreview} 
                                                        alt="Issue Evidence preview" 
                                                        style={{
                                                            maxWidth: '100%',
                                                            maxHeight: '200px',
                                                            borderRadius: '8px',
                                                            border: '2px solid #e5e7eb'
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveFile('issue_photo')}
                                                        disabled={loading}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '10px',
                                                            right: '10px',
                                                            background: '#dc2626',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '50%',
                                                            width: '32px',
                                                            height: '32px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: loading ? 'not-allowed' : 'pointer',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                                        }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
            
                                        <div className="form-group">
                                            <label htmlFor="issue_video">
                                                Issue Video
                                            </label>
                                            <input 
                                                type="file" 
                                                id="issue_video"
                                                name="issue_video"
                                                accept="video/*"
                                                onChange={handleComplaintFormChange}
                                                disabled={loading}
                                            />
                                            <small style={{color: '#64748b', display: 'block', marginTop: '5px'}}>
                                                Upload a video of the issue (Max: 50MB)
                                            </small>
                                            {videoPreview && (
                                                <div style={{marginTop: '10px', position: 'relative'}}>
                                                    <video 
                                                        src={videoPreview} 
                                                        controls 
                                                        style={{
                                                            maxWidth: '100%',
                                                            maxHeight: '200px',
                                                            borderRadius: '8px',
                                                            border: '2px solid #e5e7eb'
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveFile('issue_video')}
                                                        disabled={loading}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '10px',
                                                            right: '10px',
                                                            background: '#dc2626',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '50%',
                                                            width: '32px',
                                                            height: '32px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: loading ? 'not-allowed' : 'pointer',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                                        }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
            
                                    <div className="modal-actions">
                                        <button 
                                            type="button" 
                                            className="btn btn-secondary" 
                                            onClick={() => {
                                                setShowComplaintForm(false);
                                                setPhoneVerified(false);
                                                setStaffInfo(null);
                                                setPhotoPreview(null);
                                                setVideoPreview(null);
                                            }} 
                                            disabled={loading}
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            type="submit" 
                                            className="btn btn-primary" 
                                            disabled={
                                                loading || 
                                                !phoneVerified ||
                                                !complaintForm.subject || 
                                                !complaintForm.description || 
                                                !complaintForm.priority ||
                                                (!complaintForm.issue_photo && !complaintForm.issue_video)
                                            }
                                        >
                                            {loading ? '⏳ Filing Complaint...' : '✅ File Complaint'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffDashboard;