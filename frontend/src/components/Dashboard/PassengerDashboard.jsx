//src/Dashboard/PassengerDashboard.js
// PART 1 OF 5 - Imports and State Management

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Calendar, MapPin, DollarSign, LogOut, Menu, X,
  AlertCircle, Plus, Ticket, Clock, Bus, XCircle, User,
  Upload, Image, Video, CheckCircle, Trash2,CreditCard  
} from 'lucide-react';
import { transport, auth } from '../../services/api';
import { getUser, removeUser } from '../../utils/auth';
import './Dashboard.css'; 
import BusTracker from './BusTracker';
import SeatLayout from '../SeatSelection/SeatSelection';
import MockPaymentPage from '../Payment/MockPaymentPage';
// Add this info section to your dashboard

const TestCardsInfo = () => (
  <div className="test-cards-help">
    <h3>🧪 Test Payment Details</h3>
    
    <div className="test-section">
      <h4>Credit/Debit Cards</h4>
      <div className="test-card">
        <strong>✅ Success Card</strong>
        <p>Number: 4111 1111 1111 1111</p>
        <p>CVV: Any 3 digits (e.g., 123)</p>
        <p>Expiry: Any future date</p>
      </div>
      <div className="test-card">
        <strong>❌ Failure Card</strong>
        <p>Number: 4111 1111 1111 0000</p>
        <p>CVV: Any 3 digits</p>
        <p>Expiry: Any future date</p>
      </div>
    </div>
    
    <div className="test-section">
      <h4>UPI</h4>
      <p>✅ Success: success@paytm</p>
      <p>❌ Failure: fail@paytm</p>
    </div>
    
    <div className="note">
      <p><strong>Note:</strong> This is a mock payment system for testing.</p>
      <p>No real money will be charged.</p>
      <p>Refunds are processed instantly in mock mode.</p>
    </div>
  </div>
);
const PassengerDashboard = () => {
  const navigate = useNavigate();
  const user = getUser();
  const [activeTab, setActiveTab] = useState('profile');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // Consolidated search term for all tabs
  const [searchTerm, setSearchTerm] = useState(''); 
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [showTrackBus, setShowTrackBus] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Data states
  const [schedules, setSchedules] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [selectedSeatNumbers, setSelectedSeatNumbers] = useState([]);
  
  
  
  // Profile stats
  const [profileStats, setProfileStats] = useState({
    totalBookings: 0,
    totalComplaints: 0
  });

  // Booking modal
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    boarding_point: '',
    destination_point: ''
  });
  const [passengerDetailsList, setPassengerDetailsList] = useState([]);
  const [calculatedFare, setCalculatedFare] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null);
  const [pendingBookingData, setPendingBookingData] = useState(null);
  const [showMockPayment, setShowMockPayment] = useState(false);
  const [mockPaymentData, setMockPaymentData] = useState(null);
  const [bookingConfirmData, setBookingConfirmData] = useState(null);
  // Complaint form states - UPDATED
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [complaintForm, setComplaintForm] = useState({
    subject: '',
    description: '',
    priority: 'MEDIUM'
  });
  const [complaintFiles, setComplaintFiles] = useState({
    seat_photo: null,
    issue_photo: null,
    issue_video: null
  });
  const [filePreview, setFilePreview] = useState({
    seat_photo: null,
    issue_photo: null,
    issue_video: null
  });
  const [complaintError, setComplaintError] = useState('');
  const [complaintSuccess, setComplaintSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [phoneVerification, setPhoneVerification] = useState({
  phone: '',
  isVerified: false,
  matchedBookings: [],
  selectedBooking: null,
  isVerifying: false,
  error: ''
  });

  // Find your useState declarations and add:
  const [trackingSchedule, setTrackingSchedule] = useState(null);
  // Load districts on mount
  useEffect(() => {
    loadDistricts();
    loadSchedules();
    loadBookings();
    loadComplaints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load data when active tab changes or filters change
  useEffect(() => {
    if (activeTab === 'bookings') {
      loadBookings();
    } else if (activeTab === 'complaints') {
      loadComplaints();
    } else if (activeTab === 'search') {
      loadSchedules();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedDistrict, selectedDate]);

  // Update profile stats
  useEffect(() => {
    setProfileStats({
      totalBookings: bookings.length,
      totalComplaints: complaints.length
    });
  }, [bookings, complaints]);
  // Auto-refresh for all tabs
  useEffect(() => {
    let refreshInterval;
    
    if (activeTab === 'bookings') {
      // My Bookings - Critical for payment confirmations and status updates (30 seconds)
      refreshInterval = setInterval(() => {
        console.log('🔄 Auto-refreshing bookings...');
        loadBookings();
      }, 30000);
    } else if (activeTab === 'complaints') {
      // My Complaints - Check for resolution updates (60 seconds)
      refreshInterval = setInterval(() => {
        console.log('🔄 Auto-refreshing complaints...');
        loadComplaints();
      }, 60000);
    } else if (activeTab === 'search') {
      // Search Routes - Update seat availability and new schedules (45 seconds)
      refreshInterval = setInterval(() => {
        console.log('🔄 Auto-refreshing schedules...');
        loadSchedules();
      }, 45000);
    }
    // Note: 'profile' tab doesn't need auto-refresh (stats auto-update when bookings/complaints change)
    
    // Cleanup interval when tab changes or component unmounts
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [activeTab, selectedDistrict, selectedDate]);
  
  const loadDistricts = async () => {
    try {
      const response = await transport.getDistricts();
      setDistricts(response.data || []);
    } catch (error) {
      console.error('Error loading districts:', error);
    }
  };

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedDistrict) params.district = selectedDistrict;
      if (selectedDate) params.date = selectedDate;
      
      const response = await transport.getSchedules(params);
      setSchedules(response.data || []);
    } catch (error) {
      console.error('Error loading schedules:', error);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async () => {
    setLoading(true);
    try {
      const response = await transport.getBookings({});
      setBookings(response.data || []);
    } catch (error) {
      console.error('Error loading bookings:', error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const response = await transport.getComplaints({});
      setComplaints(response.data || []);
    } catch (error) {
      console.error('Error loading complaints:', error);
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      removeUser();
      navigate('/login');
    }
  };

  const calculateFare = (boardingPoint, destinationPoint, baseFare, stops) => {
    if (!boardingPoint || !destinationPoint || !stops || stops.length === 0) {
      return baseFare;
    }
  
    try {
      const boardingIndex = stops.indexOf(boardingPoint);
      const destinationIndex = stops.indexOf(destinationPoint);
    
      if (boardingIndex === -1 || destinationIndex === -1 || boardingIndex >= destinationIndex) {
        return baseFare;
      }
    
      const stopsTraveled = destinationIndex - boardingIndex;
      const totalStops = stops.length - 1;
    
      const calculatedFare = baseFare * (stopsTraveled / totalStops);
      return Math.round(calculatedFare * 100) / 100;
    } catch (error) {
      console.error('Error calculating fare:', error);
      return baseFare;
    }
  };

  // Continue to Part 2...
  // PART 2 OF 5 - Booking and File Upload Handlers

  const handleBookNow = (schedule) => {
    setSelectedSchedule(schedule);
    setSelectedSeatNumbers([]);
    setPassengerDetailsList([]);
    setBookingForm({
      boarding_point: '',
      destination_point: ''
    });
    setCalculatedFare(0);
    setShowBookingModal(true);
  };

  const handleBookingFormChange = (field, value) => {
    const newForm = { ...bookingForm, [field]: value };
    setBookingForm(newForm);
    
    if (selectedSchedule && (field === 'boarding_point' || field === 'destination_point')) {
      const routeDetails = selectedSchedule.route_details || selectedSchedule.route || {};
      const stops = routeDetails.stops_list || [];
      const baseFare = parseFloat(selectedSchedule.fare) || 0;
      
      const newFare = calculateFare(
        field === 'boarding_point' ? value : newForm.boarding_point,
        field === 'destination_point' ? value : newForm.destination_point,
        baseFare,
        stops
      );
      
      setCalculatedFare(newFare);
    }
  };

  const handleSeatSelection = (seats) => {
    setSelectedSeatNumbers(seats);
    const newDetailsList = seats.map((seat, index) => {
      if (passengerDetailsList[index]) {
        return { ...passengerDetailsList[index], seat_number: seat };
      }
      return {
        seat_number: seat,
        passenger_name: '',
        passenger_gender: '',
        passenger_age: '',
        passenger_phone: '',
        passenger_alternate_phone: ''
      };
    });
    setPassengerDetailsList(newDetailsList);
  };

  const handlePassengerDetailChange = (index, field, value) => {
    const newList = [...passengerDetailsList];
    newList[index] = {
      ...newList[index],
      [field]: value
    };
    setPassengerDetailsList(newList);
  };

  // ✅ CORRECTED handleBookingSubmit function
  // Replace the existing function (around line 334-438) with this:
  // ✅ FIXED handleBookingSubmit with seat availability checking
  const handleBookingSubmit = async (e) => {
    if (e) e.preventDefault();
    
    if (selectedSeatNumbers.length === 0) {
      alert('Please select at least one seat');
      return;
    }
    
    if (!bookingForm.boarding_point || !bookingForm.boarding_point.trim()) {
      alert('Please select boarding point');
      return;
    }
    
    if (!bookingForm.destination_point || !bookingForm.destination_point.trim()) {
      alert('Please select destination point');
      return;
    }

    if (bookingForm.boarding_point === bookingForm.destination_point) {
      alert('Boarding point and destination point cannot be the same');
      return;
    }

    // Validate all passenger details
    for (let i = 0; i < passengerDetailsList.length; i++) {
      const detail = passengerDetailsList[i];
      const seat = detail.seat_number;
      
      if (!detail.passenger_name.trim()) {
        alert(`Please enter passenger name for seat ${seat}`);
        return;
      }
      
      if (!detail.passenger_gender) {
        alert(`Please select gender for seat ${seat}`);
        return;
      }
      
      if (!detail.passenger_age || detail.passenger_age < 1 || detail.passenger_age > 120) {
        alert(`Please enter valid age (1-120) for seat ${seat}`);
        return;
      }
      
      if (!detail.passenger_phone.trim()) {
        alert(`Please enter phone number for seat ${seat}`);
        return;
      }
      
      const phoneClean = detail.passenger_phone.trim().replace(/[^0-9]/g, '');
      if (phoneClean.length !== 10) {
        alert(`Phone number must be 10 digits for seat ${seat}`);
        return;
      }
      
      if (!detail.passenger_alternate_phone.trim()) {
        alert(`Please enter alternate phone number for seat ${seat}`);
        return;
      }
      
      const altPhoneClean = detail.passenger_alternate_phone.trim().replace(/[^0-9]/g, '');
      if (altPhoneClean.length !== 10) {
        alert(`Alternate phone number must be 10 digits for seat ${seat}`);
        return;
      }
      
      if (phoneClean === altPhoneClean) {
        alert(`Passenger phone number and alternate phone number cannot be the same for seat ${seat}`);
        return;
      }
    }

    if (!user || !user.id) {
      alert('Please log in to make a booking');
      navigate('/login');
      return;
    }

    // ✅ NEW: CHECK SEAT AVAILABILITY WITH FLAGS
    try {
      setLoading(true);
      
      console.log('🔍 Checking seat availability...');
      
      // Check each seat with its passenger gender
      const seatChecks = [];
      const warningSeats = [];
      const blockedSeats = [];
      
      for (const detail of passengerDetailsList) {
        console.log(`Checking seat ${detail.seat_number} for ${detail.passenger_gender} passenger`);
        
        const checkResponse = await transport.checkSeatAvailabilityWithFlags({
          schedule_id: selectedSchedule.id,
          seats: [detail.seat_number],
          passenger_gender: detail.passenger_gender,
          is_group_booking: selectedSeatNumbers.length >= 2,
          current_booking_seats: selectedSeatNumbers // All seats in THIS booking
        });
        
        console.log(`Seat ${detail.seat_number} check result:`, checkResponse.data);
        
        const seatInfo = checkResponse.data.seat_info[0];
        console.log(`📊 DETAILED CHECK for ${detail.seat_number}:`, {
          can_book: seatInfo.can_book,
          reason: seatInfo.reason,
          requires_confirmation: seatInfo.requires_confirmation,
          confirmation_type: seatInfo.confirmation_type,
          is_female_only: seatInfo.is_female_only,
          restriction_type: seatInfo.restriction_type,
          restrictions: seatInfo.restrictions
        });

        seatChecks.push(seatInfo);
        
        // Check if seat is blocked
        if (!seatInfo.can_book) {
          blockedSeats.push({
            seat: detail.seat_number,
            reason: seatInfo.reason
          });
        }
        
        // Check if seat requires confirmation
        if (seatInfo.requires_confirmation) {
          warningSeats.push({
            seat: detail.seat_number,
            reason: seatInfo.reason,
            confirmationType: seatInfo.confirmation_type
          });
        }
      }
      
      // ✅ BLOCK if any seats cannot be booked
      if (blockedSeats.length > 0) {
        const blockedMessages = blockedSeats.map(s => `• Seat ${s.seat}: ${s.reason}`).join('\n');
        alert(`❌ Cannot book the following seats:\n\n${blockedMessages}\n\nPlease select different seats.`);
        setLoading(false);
        return;
      }
      
      // ✅ WARN if any seats require confirmation
      if (warningSeats.length > 0) {
        const warningMessages = warningSeats.map(s => `• Seat ${s.seat}: ${s.reason}`).join('\n');
        const userConfirmed = window.confirm(
          `⚠️ WARNING:\n\n${warningMessages}\n\nDo you want to proceed with this booking?`
        );
        
        if (!userConfirmed) {
          console.log('❌ User cancelled booking due to warnings');
          setLoading(false);
          return;
        }
        
        console.log('✅ User confirmed booking despite warnings');
      }
      
      // ✅ All checks passed - proceed with booking
      console.log('✅ All seat availability checks passed');
      setLoading(false); 
    } catch (error) {
      console.error('❌ Seat availability check error:', error);
      alert('Failed to verify seat availability. Please try again.');
      setLoading(false);
      return;
    } 

    // ✅ PREPARE BOOKING DATA (original code continues from here)
    const farePerSeat = calculatedFare || parseFloat(selectedSchedule.fare) || 0;
    const totalFare = farePerSeat * selectedSeatNumbers.length;
    
    console.log('📊 Calculated fare:', {
      farePerSeat,
      selectedSeats: selectedSeatNumbers.length,
      totalFare
    });

    // ✅ CREATE BOOKING DATA (to be sent AFTER payment)
    const bookingData = {
      passenger: user.id,
      schedule: selectedSchedule.id,
      schedule_id: selectedSchedule.id,
      seat_numbers: selectedSeatNumbers,
      boarding_point: bookingForm.boarding_point.trim(),
      destination_point: bookingForm.destination_point.trim(),
      passenger_details: passengerDetailsList.map(detail => ({
        ...detail,
        passenger_phone: detail.passenger_phone.trim().replace(/[^0-9]/g, ''),
        passenger_alternate_phone: detail.passenger_alternate_phone.trim().replace(/[^0-9]/g, '')
      })),
      total_fare: totalFare
    };

    setPendingBookingData(bookingData);

    // ✅ CREATE CONFIRMATION DATA for display
    const confirmData = {
      scheduleName: selectedSchedule.route_details?.route_name || 'N/A',
      vehicleNumber: selectedSchedule.vehicle_details?.vehicle_number || 'N/A',
      departureTime: selectedSchedule.departure_time,
      scheduleDate: selectedSchedule.schedule_date,
      seats: selectedSeatNumbers,
      passengers: passengerDetailsList,
      totalFare: totalFare,
      boarding: bookingForm.boarding_point,
      destination: bookingForm.destination_point
    };
    
    setBookingConfirmData(confirmData);

    console.log('✅ Booking data prepared, proceeding to payment...');
    console.log('Booking data:', bookingData);
    
    // ✅ GO DIRECTLY TO PAYMENT - Don't create booking yet!
    await initiateMockPayment(confirmData);
  };

  const initiateMockPayment = async (confirmData) => {
    const dataToUse = confirmData || bookingConfirmData;
    console.log('💳 Initiating payment...');
    console.log('bookingConfirmData:',dataToUse );
    
    try {
      // ✅ CHECK IF DATA EXISTS
      if (!dataToUse) {
        console.error('❌ Missing booking confirmation data:', bookingConfirmData);
        alert('Error: Booking data not found. Please try booking again.');
        return;
      }
      
      if (!dataToUse.totalFare) {
        console.error('❌ Missing totalFare:', bookingConfirmData);
        alert('Error: Total fare calculation failed. Please try again.');
        return;
      }
      
      setLoading(true);
      
      const totalFare = dataToUse.totalFare;
      
      console.log('💰 Creating payment order for amount:', totalFare);

      const response = await transport.createMockPaymentOrder({
        amount: totalFare,
        notes: {
          booking_type: 'bus_booking',
          seats: dataToUse.seats.join(','),
          schedule:dataToUse.scheduleName
        }
      });

      console.log('✅ Payment order created:', response.data);

      setMockPaymentData({
        ...response.data,
        amount: totalFare
      });

      setShowBookingModal(false);  // Close booking modal
      setShowMockPayment(true);    // Show payment modal

    } catch (error) {
      console.error('❌ Payment order creation error:', error);
      alert('Failed to initiate payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleMockPaymentFailure = () => {
    setShowMockPayment(false);
    alert('Payment cancelled');
  };
  const handleMockPaymentSuccess = async (paymentResult) => {
    try {
      setLoading(true);

      console.log('✅ Payment successful, verifying...');

      // Verify payment
      const verifyResponse = await transport.verifyMockPayment({
        order_id: paymentResult.order_id,
        payment_id: paymentResult.payment_id,
        signature: paymentResult.signature
      });

      if (verifyResponse.data.status === 'SUCCESS') {
        console.log('✅ Payment verified, creating booking NOW...');
        
        // ✅ NOW create the booking for the first time (not confirming existing one)
        const bookingResponse = await transport.confirmMockBooking({
          payment_id: paymentResult.payment_id,
          booking_data: pendingBookingData  // This creates the booking
        });

        console.log('✅ Booking created:', bookingResponse.data);

        alert(
          `🎉 Booking Confirmed Successfully!\n\n` +
          `Booking Reference: ${bookingResponse.data.booking_reference}\n` +
          `Amount Paid: ₹${bookingConfirmData.totalFare}\n` +
          `Seats: ${bookingConfirmData.seats.join(', ')}`
        );

        // Close all modals and reset states
        setShowMockPayment(false);
        setShowBookingModal(false);
        setPendingBookingData(null);
        setMockPaymentData(null);
        setConfirmationData(null);
        setBookingConfirmData(null);
        setSelectedSeatNumbers([]);
        setPassengerDetailsList([]);
        setBookingForm({
          boarding_point: '',
          destination_point: ''
        });
        setCalculatedFare(0);

        // Refresh data and switch to bookings tab
        await loadBookings();
        await loadSchedules();
        setActiveTab('bookings');
      }
    } catch (error) {
      console.error('❌ Payment verification error:', error);
      alert('Payment verification failed. Please contact support if amount was deducted.');
    } finally {
      setLoading(false);
    }
  };

  // 🆕 ADD THIS ENTIRE FUNCTION:
  const handleConfirmation = async (confirmed) => {
    setShowConfirmModal(false);

    if (confirmed) {
      console.log('✅ User confirmed, proceeding to payment...');
      
      // User confirmed - proceed to payment
      await initiateMockPayment(bookingConfirmData);
      
    } else {
      console.log('❌ User declined, staying in booking modal');
      
      // Don't close the booking modal, just clear the pending data
      setPendingBookingData(null);
      setConfirmationData(null);
      // User stays in booking modal to select different seat
      // The booking modal (showBookingModal) stays open!
    }
  }; 

  // UPDATED FILE HANDLING WITH BETTER VALIDATION
  const handleFileChange = (e, fileType) => {
    const file = e.target.files[0];
    
    if (!file) return;

    // Clear previous errors
    setComplaintError('');

    // Validate file type
    if (fileType === 'seat_photo' || fileType === 'issue_photo') {
      if (!file.type.startsWith('image/')) {
        setComplaintError(`❌ ${fileType === 'seat_photo' ? 'Seat photo' : 'Issue photo'} must be an image file (JPG, PNG, etc.)`);
        return;
      }
    } else if (fileType === 'issue_video') {
      if (!file.type.startsWith('video/')) {
        setComplaintError('❌ Issue video must be a video file (MP4, MOV, etc.)');
        return;
      }
    }

    // Validate file size
    const maxSize = fileType === 'issue_video' ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setComplaintError(`❌ File too large. Maximum size: ${fileType === 'issue_video' ? '50MB' : '10MB'}`);
      return;
    }

    // Update files state
    setComplaintFiles(prev => ({
      ...prev,
      [fileType]: file
    }));
    
    // Create preview
    if (fileType === 'seat_photo' || fileType === 'issue_photo') {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(prev => ({
          ...prev,
          [fileType]: reader.result
        }));
      };
      reader.onerror = () => {
        setComplaintError('❌ Failed to read file. Please try again.');
      };
      reader.readAsDataURL(file);
    } else {
      // For videos, store filename
      setFilePreview(prev => ({
        ...prev,
        [fileType]: file.name
      }));
    }
  };

  // Remove uploaded file
  const handleRemoveFile = (fileType) => {
    setComplaintFiles(prev => ({
      ...prev,
      [fileType]: null
    }));
    setFilePreview(prev => ({
      ...prev,
      [fileType]: null
    }));
    
    // Reset the file input
    const input = document.getElementById(fileType);
    if (input) input.value = '';
    
    setComplaintError('');
  };
  // NEW: Phone verification handler
const handleVerifyPhone = async () => {
  const phone = phoneVerification.phone.trim();
  
  if (!phone) {
    setPhoneVerification(prev => ({
      ...prev,
      error: 'Please enter your phone number'
    }));
    return;
  }
  
  const phoneClean = phone.replace(/[^0-9]/g, '');
  if (phoneClean.length !== 10) {
    setPhoneVerification(prev => ({
      ...prev,
      error: 'Phone number must be 10 digits'
    }));
    return;
  }
  
  setPhoneVerification(prev => ({ ...prev, isVerifying: true, error: '' }));
  
  try {
    const response = await transport.verifyPassengerPhone({ passenger_phone: phoneClean });
    
    if (response.data.verified) {
      setPhoneVerification(prev => ({
        ...prev,
        isVerified: true,
        matchedBookings: response.data.bookings,
        selectedBooking: response.data.bookings[0] || null,
        isVerifying: false,
        error: ''
      }));
    } else {
      setPhoneVerification(prev => ({
        ...prev,
        isVerified: false,
        matchedBookings: [],
        selectedBooking: null,
        isVerifying: false,
        error: response.data.message || 'No recent booking found with this phone number'
      }));
    }
  } catch (error) {
    console.error('Phone verification error:', error);
    setPhoneVerification(prev => ({
      ...prev,
      isVerifying: false,
      error: error.response?.data?.error || 'Failed to verify phone number'
    }));
  }
  };

    // Continue to Part 3...
    // PART 3 OF 5 - Complaint Submission Handler
// UPDATED: Complaint submit with passenger phone
const handleComplaintSubmit = async (e) => {
  if (e) e.preventDefault();
  
  setComplaintError('');
  setComplaintSuccess('');

  // Validate phone verification
  if (!phoneVerification.isVerified) {
    setComplaintError('❌ Please verify your passenger phone number first');
    return;
  }

  if (!phoneVerification.selectedBooking) {
    setComplaintError('❌ Please select a booking');
    return;
  }

  // Validate subject
  if (!complaintForm.subject || !complaintForm.subject.trim()) {
    setComplaintError('❌ Please enter a subject for your complaint');
    return;
  }

  if (complaintForm.subject.trim().length < 5) {
    setComplaintError('❌ Subject must be at least 5 characters long');
    return;
  }

  // Validate description
  if (!complaintForm.description || !complaintForm.description.trim()) {
    setComplaintError('❌ Please enter a description');
    return;
  }

  if (complaintForm.description.trim().length < 10) {
    setComplaintError('❌ Description must be at least 10 characters long');
    return;
  }

  // Seat photo mandatory
  if (!complaintFiles.seat_photo) {
    setComplaintError('📸 Seat photo is mandatory! Please upload a clear photo of your seat number.');
    return;
  }

  // At least one evidence
  if (!complaintFiles.issue_photo && !complaintFiles.issue_video) {
    setComplaintError('⚠️ Please upload either an issue photo OR an issue video');
    return;
  }

  setIsSubmitting(true);
  setLoading(true);

  try {
    const formData = new FormData();
    formData.append('subject', complaintForm.subject.trim());
    formData.append('description', complaintForm.description.trim());
    formData.append('priority', complaintForm.priority || 'MEDIUM');
    formData.append('passenger_phone', phoneVerification.phone.replace(/[^0-9]/g, ''));

    if (complaintFiles.seat_photo) {
      formData.append('seat_photo', complaintFiles.seat_photo);
    }
    
    if (complaintFiles.issue_photo) {
      formData.append('issue_photo', complaintFiles.issue_photo);
    }
    
    if (complaintFiles.issue_video) {
      formData.append('issue_video', complaintFiles.issue_video);
    }

    const response = await transport.createComplaint(formData);

    setComplaintSuccess(`✅ Complaint submitted successfully! Complaint ID: ${response.data.complaint_id || response.data.id}`);

    // Reset form after 2 seconds
    setTimeout(() => {
      setShowComplaintForm(false);
      setComplaintForm({ 
        subject: '', 
        description: '', 
        priority: 'MEDIUM' 
      });
      setComplaintFiles({
        seat_photo: null,
        issue_photo: null,
        issue_video: null
      });
      setFilePreview({
        seat_photo: null,
        issue_photo: null,
        issue_video: null
      });
      setPhoneVerification({
        phone: '',
        isVerified: false,
        matchedBookings: [],
        selectedBooking: null,
        isVerifying: false,
        error: ''
      });
      setComplaintSuccess('');
      loadComplaints();
    }, 2000);

  } catch (error) {
    console.error('Complaint submission error:', error);
    let errorMessage = 'Failed to submit complaint. Please try again.';
    if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    }
    setComplaintError(`❌ ${errorMessage}`);
  } finally {
    setIsSubmitting(false);
    setLoading(false);
  }
};

  
  // In your PassengerDashboard, update the cancel booking handler

  const handleCancelBooking = async (booking) => {
    const confirmCancel = window.confirm(
      `Are you sure you want to cancel this booking?\n\n` +
      `Booking Reference: ${booking.booking_id || booking.id}\n` +
      `Amount: ₹${booking.total_fare}\n\n` +
      `INSTANT REFUND will be processed!\n` +
      `(In real system, takes 5-7 days)`
    );
    
    if (!confirmCancel) return;
    
    try {
      setLoading(true);
      
      const reason = prompt('Please tell us why you are canceling:\n\n(This helps us improve our service)');
      if (reason === null) {
      console.log('❌ User cancelled the reason prompt');
      setLoading(false);
      return; // Don't proceed with cancellation
    }
    if (!reason || reason.trim() === '') {
      alert('Cancellation reason is required to process your refund');
      setLoading(false);
      return;
    }
      const response = await transport.cancelBookingWithMockRefund(booking.id, {
        reason: reason || 'User requested cancellation'
      });
      
      alert(
        `✅ Booking Cancelled & Refund Processed!\n\n` +
        `Refund Amount: ₹${response.data.refund_amount}\n` +
        `Cancellation Charge: ₹${response.data.cancellation_charge}\n` +
        `Refund ID: ${response.data.refund_id}\n\n` +
        `✨ ${response.data.note}`
      );
      
      await loadBookings();
      
    } catch (error) {
      console.error('Cancellation error:', error);
      alert('Failed to cancel booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isCancellable = (bookingStatus, scheduleDate) => {
    if (!['CONFIRMED', 'PENDING'].includes(bookingStatus?.toUpperCase())) {
      return false;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const schedule = new Date(scheduleDate);
    schedule.setHours(0, 0, 0, 0);
    
    return schedule > today;
  };

  const getStatusColor = (status) => {
    const colors = {
      'PENDING': 'yellow',
      'CONFIRMED': 'green',
      'CANCELLED': 'red',
      'COMPLETED': 'blue',
      'RESOLVED': 'green',
      'IN_PROGRESS': 'blue',
      'OPEN': 'yellow'
    };
    return colors[status?.toUpperCase()] || 'gray';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'LOW': 'green',
      'MEDIUM': 'yellow',
      'HIGH': 'orange',
      'EMERGENCY': 'red'
    };
    return colors[priority?.toUpperCase()] || 'gray';
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };
  
  // Filter functions
  const filteredSchedules = schedules.filter(schedule => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase().trim();
    const routeDetails = schedule.route_details || schedule.route || {};
    const vehicleDetails = schedule.vehicle_details || schedule.vehicle || {};
    
    const routeName = (routeDetails.route_name || routeDetails.name || '').toLowerCase();
    const vehicleNumber = (vehicleDetails.vehicle_number || vehicleDetails.registration_number || '').toLowerCase();
    const startPoint = (routeDetails.start_point || routeDetails.origin || routeDetails.from_location || '').toLowerCase();
    const endPoint = (routeDetails.end_point || routeDetails.destination || routeDetails.to_location || '').toLowerCase();
    
    return routeName.includes(search) || 
           vehicleNumber.includes(search) ||
           startPoint.includes(search) ||
           endPoint.includes(search);
  });

  const filteredBookings = bookings.filter(booking => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase().trim();
    const bookingId = (booking.booking_id || booking.id || '').toString().toLowerCase();
    const scheduleDetails = booking.schedule_details || booking.schedule || {};
    const vehicleDetails = scheduleDetails.vehicle_details || scheduleDetails.vehicle || {};
    const vehicleNumber = (vehicleDetails.vehicle_number || vehicleDetails.registration_number || '').toLowerCase();
    const boardingPoint = (booking.boarding_point || '').toLowerCase();
    const destinationPoint = (booking.destination_point || '').toLowerCase();
    
    return bookingId.includes(search) || 
           vehicleNumber.includes(search) ||
           boardingPoint.includes(search) ||
           destinationPoint.includes(search);
  });
  
  const filteredComplaints = complaints.filter(complaint => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase().trim();
    const complaintId = (complaint.complaint_id || complaint.id || '').toString().toLowerCase();
    const subject = (complaint.subject || '').toLowerCase();
    const priority = (complaint.priority || '').toLowerCase();
    
    return complaintId.includes(search) || 
           subject.includes(search) || 
           priority.includes(search);
  });

  if (!user) {
    navigate('/login');
    return null;
  }

  const StatusBadge = ({ status }) => (
    <span className={`status-badge status-${getStatusColor(status)}`}>
      {status || 'N/A'}
    </span>
  );
  
  const PriorityBadge = ({ priority }) => (
    <span className={`priority-badge priority-${getPriorityColor(priority)}`}>
      {priority || 'N/A'}
    </span>
  );
  const PaymentDetailsCell = ({ booking }) => {
    const paymentDetails = booking.payment_details || {};
    const hasPayment = paymentDetails && Object.keys(paymentDetails).length > 0;
    
    if (!hasPayment) {
      return (
        <div style={{
          padding: '8px',
          background: '#f3f4f6',
          borderRadius: '6px',
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '13px'
        }}>
          No payment info
        </div>
      );
    }

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

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minWidth: '200px',
        fontSize: '13px'
      }}>
        {/* Payment Status */}
        {paymentDetails.payment_status && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            background: `${getPaymentStatusColor(paymentDetails.payment_status)}20`,
            border: `2px solid ${getPaymentStatusColor(paymentDetails.payment_status)}`,
            borderRadius: '6px',
            fontWeight: '600',
            color: getPaymentStatusColor(paymentDetails.payment_status)
          }}>
            <CreditCard size={14} />
            <span>{paymentDetails.payment_status}</span>
          </div>
        )}

        {/* Payment ID */}
        {paymentDetails.payment_id && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 0',
            color: '#374151'
          }}>
            <strong style={{ minWidth: '65px', color: '#6b7280' }}>ID:</strong>
            <span style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              background: '#f3f4f6',
              padding: '2px 6px',
              borderRadius: '4px',
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
            padding: '4px 0',
            color: '#374151'
          }}>
            <strong style={{ minWidth: '65px', color: '#6b7280' }}>Method:</strong>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
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
            padding: '4px 0',
            color: '#374151',
            fontSize: '12px'
          }}>
            <strong style={{ minWidth: '65px', color: '#6b7280' }}>Date:</strong>
            <span>{new Date(paymentDetails.transaction_date).toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</span>
          </div>
        )}

        {/* Refund Info (if refunded) */}
        {paymentDetails.refund_id && (
          <div style={{
            marginTop: '8px',
            padding: '10px',
            background: '#f3e8ff',
            border: '2px solid #8b5cf6',
            borderRadius: '6px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: '#5b21b6',
              fontWeight: '600',
              marginBottom: '6px',
              fontSize: '13px'
            }}>
              <span>🔄</span>
              <span>REFUND DETAILS</span>
            </div>
            
            {/* Refund ID - Full */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 0',
              color: '#374151',
              fontSize: '12px'
            }}>
              <strong style={{ minWidth: '65px', color: '#6b21a8' }}>Ref ID:</strong>
              <span style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                background: '#ede9fe',
                padding: '2px 6px',
                borderRadius: '4px',
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
                padding: '4px 0',
                color: '#374151',
                fontSize: '12px'
              }}>
                <strong style={{ minWidth: '65px', color: '#6b21a8' }}>Amount:</strong>
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
                padding: '4px 0',
                color: '#374151',
                fontSize: '12px'
              }}>
                <strong style={{ minWidth: '65px', color: '#6b21a8' }}>Date:</strong>
                <span style={{ color: '#5b21b6' }}>
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
                marginTop: '4px',
                padding: '4px 8px',
                background: '#10b981',
                color: 'white',
                borderRadius: '4px',
                fontSize: '11px',
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

  // Continue to Part 4...
  // PART 4 OF 5 - Main UI Structure and Tab Content

  return (
    <div className="dashboard">
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <Bus size={32} />
          <h2>TMS Passenger</h2>
        </div>

        <div className="user-info-sidebar">
          <div className="user-avatar-large">
            {user?.name?.charAt(0).toUpperCase() || 'P'}
          </div>
          <h3>{user?.name || 'Passenger'}</h3>
          <p className="user-role-tag">Passenger</p>
        </div>

        <nav className="sidebar-nav">
          <button
            className={activeTab === 'profile' ? 'active' : ''}
            onClick={() => setActiveTab('profile')}
          >
            <User size={20} />
            <span>My Profile</span>
          </button>
          <button
            className={activeTab === 'search' ? 'active' : ''}
            onClick={() => setActiveTab('search')}
          >
            <Search size={20} />
            <span>Search Routes</span>
          </button>
          <button
            className={activeTab === 'bookings' ? 'active' : ''}
            onClick={() => setActiveTab('bookings')}
          >
            <Ticket size={20} />
            <span>My Bookings</span>
          </button>
          <button
            className={activeTab === 'complaints' ? 'active' : ''}
            onClick={() => setActiveTab('complaints')}
          >
            <AlertCircle size={20} />
            <span>Complaints</span>
          </button>
        </nav>

        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </aside>

      <main className="main-content">
        <header className="dashboard-header">
          <button 
            className="menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          
          <h1>
            {activeTab === 'profile' ? 'My Profile' :
              activeTab === 'search' ? 'Search Routes' : 
              activeTab === 'bookings' ? 'My Bookings' : 'My Complaints'}
          </h1>
          
          <div className="header-actions">
            {activeTab === 'complaints' && (
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setShowComplaintForm(true);
                  setComplaintError('');
                  setComplaintSuccess('');
                }}
              >
                <Plus size={18} /> File Complaint
              </button>
            )}
          </div>
        </header>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="profile-container">
            <div className="profile-card">
              <div className="profile-header">
                <div className="profile-avatar">
                  {user?.name?.charAt(0).toUpperCase() || 'P'}
                </div>
                <div className="profile-info">
                  <h2>{user?.name || 'Passenger'}</h2>
                  <p>Passenger Account</p>
                </div>
              </div>
              
              <div className="info-grid">
                <div className="info-field">
                  <label>Full Name</label>
                  <div className="value">{user?.name || 'N/A'}</div>
                </div>
                <div className="info-field">
                  <label>Username</label>
                  <div className="value">{user?.username || 'N/A'}</div>
                </div>
                <div className="info-field">
                  <label>Mobile Number</label>
                  <div className="value">{user?.phone_number || user?.mobile || user?.phone || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Bookings</h3>
                <div className="stat-value">{profileStats.totalBookings}</div>
              </div>
              <div className="stat-card">
                <h3>Total Complaints</h3>
                <div className="stat-value">{profileStats.totalComplaints}</div>
              </div>
            </div>
          </div>
        )}

        {/* Search Routes Tab */}
        {activeTab === 'search' && (
          <div className="search-content">
            <div className="search-filters">
              <div className="filter-group">
                
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                >
                  <option value="">All Districts</option>
                  {districts.map(d => (
                    <option key={d.id} value={d.name || d.district_name}>
                      {d.name || d.district_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={getTodayDate()}
                />
              </div>

              <div className="filter-group flex-grow">
                
                <div className="search-box">
                  <Search size={20} />
                  <input
                    type="text"
                    placeholder="Search by route name, vehicle number, location..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="loading">Loading schedules...</div>
            ) : (
              <div className="schedules-list">
                {filteredSchedules.length === 0 ? (
                  <div className="empty-state">
                    <Calendar size={64} />
                    <h3>No schedules found</h3>
                    <p>{searchTerm ? 'No schedules match your search criteria' : 'Try adjusting your filters'}</p>
                  </div>
                ) : (
                  filteredSchedules.map(schedule => {
                    const routeDetails = schedule.route_details || schedule.route || {};
                    const vehicleDetails = schedule.vehicle_details || schedule.vehicle || {};
                    const routeName = routeDetails.route_name || routeDetails.name || 'Route';
                    const startPoint = routeDetails.start_point || routeDetails.origin || 'Start';
                    const endPoint = routeDetails.end_point || routeDetails.destination || 'End';
                    const vehicleNumber = vehicleDetails.vehicle_number || vehicleDetails.registration_number || 'N/A';
                    const availableSeats = schedule.available_seats || 0;
                    const fare = schedule.fare || 0;
                    
                    return (
                      <div key={schedule.id} className="schedule-item">
                        <div className="schedule-main">
                          <div className="schedule-route">
                            <h3>{routeName}</h3>
                            <div className="route-points">
                              <div className="point">
                                <MapPin size={16} />
                                <span>{startPoint}</span>
                              </div>
                              <div className="route-arrow">→</div>
                              <div className="point">
                                <MapPin size={16} />
                                <span>{endPoint}</span>
                              </div>
                            </div>
                          </div>

                          <div className="schedule-info-grid">
                            <div className="info-item">
                              <Calendar size={16} />
                              <span>{schedule.schedule_date || 'N/A'}</span>
                            </div>
                            <div className="info-item">
                              <Clock size={16} />
                              <span>{schedule.departure_time || 'N/A'}</span>
                            </div>
                            <div className="info-item">
                              <Ticket size={16} />
                              <span>{availableSeats} seats</span>
                            </div>
                            <div className="info-item">
                              <DollarSign size={16} />
                              <span>₹{fare}</span>
                            </div>
                          </div>
                        </div>

                        <div className="schedule-actions">
                          <span className="vehicle-badge">
                            {vehicleNumber}
                          </span>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleBookNow(schedule)}
                            disabled={availableSeats === 0}
                          >
                            {availableSeats === 0 ? 'Fully Booked' : 'Book Now'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* My Bookings Tab - Similar to original, keeping it concise */}
        {activeTab === 'bookings' && (
          <div className="tab-content">
            <div className="search-box">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search by Booking ID, vehicle number, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="loading">Loading bookings...</div>
            ) : filteredBookings.length === 0 ? (
              <div className="empty-state">
                <Ticket size={64} />
                <h3>No bookings found</h3>
                <p>{searchTerm ? 'No bookings match your search criteria' : 'Start by searching and booking routes'}</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Booking ID</th>
                      <th>Route</th>
                      <th>Date/Time</th>
                      <th>Vehicle</th>
                      <th>Passengers</th>
                      <th>Seats</th>
                      <th>Fare</th>
                      <th>Payment Details</th>   
                      <th>Status</th>
                      <th>Bus Location</th>
                      <th>Actions</th>
                      
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map(booking => {
                      const scheduleDetails = booking.schedule_details || booking.schedule || {};
                      const vehicleDetails = scheduleDetails.vehicle_details || scheduleDetails.vehicle || {};
                      const bookingStatus = booking.status || 'PENDING';
                      const scheduleDate = scheduleDetails.schedule_date || null;
                      const route = `${booking.boarding_point || 'N/A'} → ${booking.destination_point || 'N/A'}`;
                      const canCancel = isCancellable(bookingStatus, scheduleDate);
                      // Add these two lines
                      const isConfirmed = bookingStatus.toUpperCase() === 'CONFIRMED';
                      const isCancelled = bookingStatus.toUpperCase() === 'CANCELLED'||bookingStatus.toUpperCase() === 'REFUNDED';
                      let seatNumbers = [];
                      if (booking.seat_numbers_list && Array.isArray(booking.seat_numbers_list)) {
                        seatNumbers = booking.seat_numbers_list;
                      } else if (booking.seat_numbers) {
                        try {
                          seatNumbers = typeof booking.seat_numbers === 'string' 
                            ? JSON.parse(booking.seat_numbers) 
                            : booking.seat_numbers;
                        } catch (e) {
                          seatNumbers = [];
                        }
                      }

                      return (
                        <tr key={booking.id}>
                          <td data-label="Booking ID">
                            <strong>#{booking.booking_id || booking.id}</strong>
                          </td>
                          <td data-label="Route">{route}</td>
                          <td data-label="Date/Time">
                            {scheduleDetails.schedule_date || 'N/A'} @ {scheduleDetails.departure_time || 'N/A'}
                          </td>
                          <td data-label="Vehicle">
                            {vehicleDetails.vehicle_number || 'N/A'}
                          </td>
                          <td data-label="Passengers">{booking.seats_booked || seatNumbers.length}</td>
                          <td data-label="Seats">
                            {seatNumbers.map((seat, idx) => (
                              <span key={idx} className="seat-badge">{seat}</span>
                            ))}
                          </td>
                          <td data-label="Fare">₹{booking.total_fare}</td>
                          <td data-label="Payment Details">
                            <PaymentDetailsCell booking={booking} />
                          </td>

                          <td data-label="Status">
                            <StatusBadge status={bookingStatus} />
                          </td>

                          <td data-label="Bus Location">
                            {/* ONLY show Track Bus button for CONFIRMED passengers */}
                            {isConfirmed && (
                              <button 
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  setSelectedBooking(booking);
                                  setShowTrackBus(true);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 16px',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <MapPin size={16} />
                                Track Bus
                              </button>
                            )}
                            
                            {/* Empty for CANCELLED passengers */}
                            {isCancelled && (
                              <span style={{ color: '#9ca3af' }}>—</span>
                            )}
                            
                            {/* For PENDING or other statuses */}
                            {!isConfirmed && !isCancelled && (
                              <span style={{ color: '#9ca3af', fontSize: '13px' }}>
                                Not available
                              </span>
                            )}
                          </td>
                          <td data-label="Actions">
                            {canCancel ? (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleCancelBooking(booking)}
                                disabled={loading}
                              >
                                <XCircle size={16} /> Cancel
                              </button>
                            ) : (
                              <span className="text-muted">
                                {isCancelled ? 'Cancelled' : 
                                bookingStatus === 'COMPLETED' ? 'Completed' : 'No Action'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Complaints Tab */}
        {activeTab === 'complaints' && (
          <div className="tab-content">
          <div className="search-box">
        <Search size={20} />
      <input
        type="text"
        placeholder="Search by Complaint ID, Subject, or Priority..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
    </div>

    {loading ? (
      <div className="loading">Loading complaints...</div>
    ) : filteredComplaints.length === 0 ? (
      <div className="empty-state">
        <AlertCircle size={64} />
        <h3>No complaints found</h3>
        <p>
          {searchTerm 
            ? 'No complaints match your search criteria.' 
            : "You haven't filed any complaints yet"}
        </p>
      </div>
    ) : (
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Complaint ID</th>
              <th>Date Filed</th>
              <th>Passenger Name</th>
              <th>Phone Verified</th>
              <th>Subject</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {filteredComplaints.map(complaint => (
              <tr key={complaint.id}>
                <td data-label="Complaint ID">
                  <strong>#{complaint.complaint_id || complaint.id}</strong>
                </td>
                <td data-label="Date Filed">
                  {new Date(complaint.created_date || complaint.created_at).toLocaleDateString()}
                </td>
                <td data-label="Passenger Name">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <strong>{complaint.passenger_name || 'N/A'}</strong>
                    {complaint.seat_number && (
                      <span style={{ 
                        fontSize: '12px', 
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        🪑 Seat {complaint.seat_number}
                      </span>
                    )}
                  </div>
                </td>
                <td data-label="Phone Verified">
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
                      <CheckCircle size={14} /> Verified
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
                      <XCircle size={14} /> Not Verified
                    </span>
                  )}
                  {complaint.passenger_phone && (
                    <div style={{ 
                      fontSize: '11px', 
                      color: '#64748b',
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      📱 {complaint.passenger_phone}
                    </div>
                  )}
                </td>
                <td data-label="Subject">
                  <strong>{complaint.subject}</strong>
                </td>
                <td data-label="Priority">
                  <PriorityBadge priority={complaint.priority} />
                </td>
                <td data-label="Status">
                  <StatusBadge status={complaint.status} />
                </td>
                <td data-label="Evidence">
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '6px',
                    minWidth: '120px'
                  }}>
                    {/* Seat Photo */}
                    {complaint.seat_photo_url ? (
                      <a 
                        href={complaint.seat_photo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 10px',
                          background: '#dcfce7',
                          color: '#065f46',
                          borderRadius: '6px',
                          textDecoration: 'none',
                          fontSize: '12px',
                          fontWeight: '600',
                          border: '1px solid #10b981',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#bbf7d0'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#dcfce7'}
                      >
                        <CheckCircle size={14} /> Seat Photo
                      </a>
                    ) : (
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        background: '#f1f5f9',
                        color: '#64748b',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}>
                        <XCircle size={14} /> No Seat Photo
                      </span>
                    )}
                    
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
                        <Image size={14} /> Issue Photo
                      </a>
                    ) : null}
                    
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
                        <Video size={14} /> Issue Video
                      </a>
                    ) : null}
                    
                    {/* No evidence message */}
                    {!complaint.issue_photo_url && !complaint.issue_video_url && (
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        background: '#f1f5f9',
                        color: '#64748b',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}>
                        <XCircle size={14} /> No Issue Media
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}

      {/* Continue to Part 5 for Modals... */}

      {/* Booking Modal - Keeping original for brevity */}
      {showBookingModal && selectedSchedule && (
        <div className="modal-overlay" onClick={() => setShowBookingModal(false)}>
          <div className="modal-content booking-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1000px' }}>
            <div className="modal-header">
              <h2>Select Seats & Enter Passenger Details</h2>
              <button className="modal-close" onClick={() => setShowBookingModal(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="booking-summary">
              <h3>{selectedSchedule.route_details?.route_name || 'Route'}</h3>
              <div className="summary-details">
                <div className="summary-row">
                  <span>Date:</span>
                  <strong>{selectedSchedule.schedule_date}</strong>
                </div>
                <div className="summary-row">
                  <span>Departure:</span>
                  <strong>{selectedSchedule.departure_time}</strong>
                </div>
                <div className="summary-row">
                  <span>Vehicle:</span>
                  <strong>{selectedSchedule.vehicle_details?.vehicle_number || 'N/A'}</strong>
                </div>
                <div className="summary-row">
                  <span>Base Fare:</span>
                  <strong>₹{selectedSchedule.fare}</strong>
                </div>
                {calculatedFare > 0 && calculatedFare !== parseFloat(selectedSchedule.fare) && (
                  <div className="summary-row" style={{ color: '#10b981', fontWeight: 'bold' }}>
                    <span>Your Fare (Per Seat):</span>
                    <strong>₹{calculatedFare}</strong>
                  </div>
                )}
              </div>
            </div>

            <div style={{ 
              background: '#fff3cd', 
              padding: '20px', 
              borderRadius: '10px', 
              marginBottom: '20px',
              border: '2px solid #ffc107'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '15px' }}>
                ⚠️ Select Your Journey (Required)
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label>Boarding Point *</label>
                  <select
                    value={bookingForm.boarding_point}
                    onChange={(e) => handleBookingFormChange('boarding_point', e.target.value)}
                    required
                  >
                    <option value="">Select Boarding Point</option>
                    {(selectedSchedule.route_details?.stops_list || []).map((stop, index) => (
                      <option 
                        key={index} 
                        value={stop}
                        disabled={stop === bookingForm.destination_point}
                      >
                        {stop}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Destination Point *</label>
                  <select
                    value={bookingForm.destination_point}
                    onChange={(e) => handleBookingFormChange('destination_point', e.target.value)}
                    required
                  >
                    <option value="">Select Destination Point</option>
                    {(selectedSchedule.route_details?.stops_list || []).map((stop, index) => (
                      <option 
                        key={index} 
                        value={stop}
                        disabled={
                          stop === bookingForm.boarding_point ||
                          (bookingForm.boarding_point && 
                           (selectedSchedule.route_details?.stops_list || []).indexOf(stop) <= 
                           (selectedSchedule.route_details?.stops_list || []).indexOf(bookingForm.boarding_point))
                        }
                      >
                        {stop}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <SeatLayout
              schedule={selectedSchedule}
              onSeatSelect={handleSeatSelection}
              selectedSeats={selectedSeatNumbers}
            />

            {selectedSeatNumbers.length > 0 && (
              <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '10px', marginTop: '20px' }}>
                <h3>Passenger Information</h3>
                {passengerDetailsList.map((details, index) => (
                  <div key={index} style={{ background: 'white', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                    <h4>🪑 Seat {details.seat_number}</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                      <input
                        type="text"
                        placeholder="Passenger Name *"
                        value={details.passenger_name}
                        onChange={(e) => handlePassengerDetailChange(index, 'passenger_name', e.target.value)}
                        required
                      />
                      <select
                        value={details.passenger_gender}
                        onChange={(e) => handlePassengerDetailChange(index, 'passenger_gender', e.target.value)}
                        required
                      >
                        <option value="">Gender *</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Age *"
                        min="1"
                        max="120"
                        value={details.passenger_age}
                        onChange={(e) => handlePassengerDetailChange(index, 'passenger_age', e.target.value)}
                        required
                      />
                      <input
                        type="tel"
                        placeholder="Phone Number *"
                        value={details.passenger_phone}
                        onChange={(e) => handlePassengerDetailChange(index, 'passenger_phone', e.target.value)}
                        required
                      />
                      <input
                        type="tel"
                        placeholder="Alternate Phone *"
                        value={details.passenger_alternate_phone}
                        onChange={(e) => handlePassengerDetailChange(index, 'passenger_alternate_phone', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="total-fare">
              <span>Total Fare:</span>
              <strong>₹{(calculatedFare || parseFloat(selectedSchedule.fare)) * selectedSeatNumbers.length}</strong>
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => setShowBookingModal(false)}
              >
                Cancel
              </button>
              <button 
                type="button"
               onClick={handleBookingSubmit} 
                className="btn btn-primary"
                disabled={loading || selectedSeatNumbers.length === 0}
              >
                {loading ? 'Processing...' : 'Proceed to Payment'}
              </button>

            </div>
          </div>
        </div>
      )}
      {showComplaintForm && (
  <div className="modal-overlay" onClick={() => !isSubmitting && setShowComplaintForm(false)}>
    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
      <div className="modal-header">
        <h2>📋 File a New Complaint</h2>
        <button 
          className="modal-close" 
          onClick={() => !isSubmitting && setShowComplaintForm(false)}
          disabled={isSubmitting}
        >
          <X size={24} />
        </button>
      </div>
      
      {complaintSuccess && (
        <div style={{ 
          background: '#d1fae5', 
          border: '2px solid #10b981',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#065f46'
        }}>
          <CheckCircle size={24} color="#10b981" />
          <span style={{ fontWeight: '600' }}>{complaintSuccess}</span>
        </div>
      )}

      {complaintError && (
        <div style={{
          background: '#fee2e2',
          border: '2px solid #dc2626',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          color: '#991b1b'
        }}>
          <AlertCircle size={24} color="#dc2626" style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: '600' }}>{complaintError}</span>
        </div>
      )}
      
      <form onSubmit={handleComplaintSubmit}>
        {/* STEP 1: Phone Verification */}
        <div style={{
          background: '#fef3c7',
          border: '3px solid #f59e0b',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#92400e' }}>
            📱 Step 1: Verify Your Passenger Phone Number *
          </h3>
          
          {!phoneVerification.isVerified ? (
            <>
              <p style={{ color: '#92400e', marginBottom: '15px', fontSize: '14px' }}>
                Enter the phone number used when booking your ticket to verify you traveled on the bus.
              </p>
              
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input
                  type="tel"
                  placeholder="Enter passenger phone (10 digits)"
                  value={phoneVerification.phone}
                  onChange={(e) => setPhoneVerification(prev => ({
                    ...prev,
                    phone: e.target.value,
                    error: ''
                  }))}
                  disabled={phoneVerification.isVerifying}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '2px solid #f59e0b',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
                <button
                  type="button"
                  onClick={handleVerifyPhone}
                  disabled={phoneVerification.isVerifying || !phoneVerification.phone}
                  style={{
                    padding: '12px 24px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: phoneVerification.isVerifying ? 'wait' : 'pointer',
                    opacity: !phoneVerification.phone ? 0.5 : 1
                  }}
                >
                  {phoneVerification.isVerifying ? 'Verifying...' : 'Verify Phone'}
                </button>
              </div>
              
              {phoneVerification.error && (
                <p style={{ color: '#dc2626', fontSize: '13px', margin: '10px 0 0 0' }}>
                  ⚠️ {phoneVerification.error}
                </p>
              )}
            </>
          ) : (
            <div style={{ background: '#d1fae5', padding: '15px', borderRadius: '6px' }}>
              <p style={{ color: '#065f46', fontWeight: '600', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={20} /> Phone Verified: {phoneVerification.phone}
              </p>
              
              {phoneVerification.matchedBookings.length > 1 && (
                <div style={{ marginTop: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', color: '#065f46', fontSize: '13px' }}>
                    Select Booking:
                  </label>
                  <select
                    value={phoneVerification.matchedBookings.indexOf(phoneVerification.selectedBooking)}
                    onChange={(e) => setPhoneVerification(prev => ({
                      ...prev,
                      selectedBooking: prev.matchedBookings[e.target.value]
                    }))}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #10b981',
                      borderRadius: '6px'
                    }}
                  >
                    {phoneVerification.matchedBookings.map((booking, idx) => (
                      <option key={idx} value={idx}>
                        {booking.booking_id} - {booking.route} - Seat {booking.seat_number} ({booking.date})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {phoneVerification.selectedBooking && (
                <div style={{ marginTop: '15px', fontSize: '13px', color: '#065f46', background: 'white', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px' }}>
                    <strong>Passenger:</strong>
                    <span>{phoneVerification.selectedBooking.passenger_name}</span>
                    <strong>Seat:</strong>
                    <span>🪑 {phoneVerification.selectedBooking.seat_number}</span>
                    <strong>Route:</strong>
                    <span>{phoneVerification.selectedBooking.route}</span>
                    <strong>Date:</strong>
                    <span>{phoneVerification.selectedBooking.date}</span>
                    <strong>Vehicle:</strong>
                    <span>{phoneVerification.selectedBooking.vehicle}</span>
                  </div>
                </div>
              )}
              
              <button
                type="button"
                onClick={() => setPhoneVerification({
                  phone: '',
                  isVerified: false,
                  matchedBookings: [],
                  selectedBooking: null,
                  isVerifying: false,
                  error: ''
                })}
                style={{
                  marginTop: '10px',
                  padding: '8px 16px',
                  background: 'white',
                  color: '#dc2626',
                  border: '2px solid #dc2626',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Change Phone Number
              </button>
            </div>
          )}
        </div>

        {/* Rest of form - only enabled if phone verified */}
        <fieldset disabled={!phoneVerification.isVerified} style={{ border: 'none', padding: 0, margin: 0 }}>
          
          {/* Subject */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e293b' }}>
              Subject * <small style={{ color: '#64748b', fontWeight: 'normal' }}>(min 5 characters)</small>
            </label>
            <input
              type="text"
              value={complaintForm.subject}
              onChange={(e) => setComplaintForm({...complaintForm, subject: e.target.value})}
              placeholder="Brief description of the issue"
              required
              minLength={5}
              disabled={isSubmitting}
              style={{ 
                width: '100%', 
                padding: '12px', 
                border: '2px solid #e2e8f0', 
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
          
          {/* Priority */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e293b' }}>
              Priority *
            </label>
            <select
              value={complaintForm.priority}
              onChange={(e) => setComplaintForm({...complaintForm, priority: e.target.value})}
              required
              disabled={isSubmitting}
              style={{ 
                width: '100%', 
                padding: '12px', 
                border: '2px solid #e2e8f0', 
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="LOW">Low - Minor inconvenience</option>
              <option value="MEDIUM">Medium - Moderate issue</option>
              <option value="HIGH">High - Serious problem</option>
              <option value="EMERGENCY">Emergency - Critical issue</option>
            </select>
          </div>
          
          {/* Description */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e293b' }}>
              Description * <small style={{ color: '#64748b', fontWeight: 'normal' }}>(min 10 characters)</small>
            </label>
            <textarea
              value={complaintForm.description}
              onChange={(e) => setComplaintForm({...complaintForm, description: e.target.value})}
              placeholder="Provide detailed information about the issue..."
              required
              rows="4"
              minLength={10}
              disabled={isSubmitting}
              style={{ 
                width: '100%', 
                padding: '12px', 
                border: '2px solid #e2e8f0', 
                borderRadius: '6px', 
                resize: 'vertical',
                fontSize: '14px',
                fontFamily: 'inherit'
              }}
            />
          </div>
          
          {/* MANDATORY: Seat Photo */}
          <div style={{
            background: '#dcfce7',
            border: '3px solid #10b981',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <label style={{ display: 'block', marginBottom: '12px', fontWeight: '700', color: '#065f46', fontSize: '15px' }}>
              📸 Seat Photo * (MANDATORY)
            </label>
            <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#065f46' }}>
              Upload a clear photo showing your seat number. This is required to verify you actually traveled.
            </p>
            
            {!filePreview.seat_photo ? (
              <div>
                <input
                  type="file"
                  id="seat_photo"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'seat_photo')}
                  disabled={isSubmitting}
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="seat_photo"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '15px',
                    background: 'white',
                    border: '2px dashed #10b981',
                    borderRadius: '8px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    color: '#065f46',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                >
                  <Upload size={24} />
                  Click to Upload Seat Photo
                </label>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <img 
                  src={filePreview.seat_photo} 
                  alt="Seat preview" 
                  style={{ 
                    width: '100%', 
                    maxHeight: '200px', 
                    objectFit: 'contain',
                    borderRadius: '8px',
                    border: '2px solid #10b981'
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveFile('seat_photo')}
                  disabled={isSubmitting}
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
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
          
          {/* Issue Photo */}
          <div style={{
            background: '#dbeafe',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <label style={{ display: 'block', marginBottom: '12px', fontWeight: '700', color: '#1e40af', fontSize: '15px' }}>
              📷 Issue Photo (Optional)
            </label>
            <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#1e40af' }}>
              Upload a photo of the problem/issue (either photo OR video required).
            </p>
            
            {!filePreview.issue_photo ? (
              <div>
                <input
                  type="file"
                  id="issue_photo"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'issue_photo')}
                  disabled={isSubmitting}
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="issue_photo"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '15px',
                    background: 'white',
                    border: '2px dashed #3b82f6',
                    borderRadius: '8px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    color: '#1e40af',
                    fontWeight: '600'
                  }}
                >
                  <Image size={24} />
                  Click to Upload Issue Photo
                </label>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <img 
                  src={filePreview.issue_photo} 
                  alt="Issue preview" 
                  style={{ 
                    width: '100%', 
                    maxHeight: '200px', 
                    objectFit: 'contain',
                    borderRadius: '8px',
                    border: '2px solid #3b82f6'
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveFile('issue_photo')}
                  disabled={isSubmitting}
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
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
          
          {/* Issue Video */}
          <div style={{
            background: '#f3e8ff',
            border: '2px solid #8b5cf6',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <label style={{ display: 'block', marginBottom: '12px', fontWeight: '700', color: '#5b21b6', fontSize: '15px' }}>
              🎥 Issue Video (Optional)
            </label>
            <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#5b21b6' }}>
              Upload a video of the problem/issue (either photo OR video required, max 50MB).
            </p>
            
            {!filePreview.issue_video ? (
              <div>
                <input
                  type="file"
                  id="issue_video"
                  accept="video/*"
                  onChange={(e) => handleFileChange(e, 'issue_video')}
                  disabled={isSubmitting}
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="issue_video"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '15px',
                    background: 'white',
                    border: '2px dashed #8b5cf6',
                    borderRadius: '8px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    color: '#5b21b6',
                    fontWeight: '600'
                  }}
                >
                  <Video size={24} />
                  Click to Upload Issue Video
                </label>
              </div>
            ) : (
              <div style={{ position: 'relative', background: 'white', padding: '15px', borderRadius: '8px', border: '2px solid #8b5cf6' }}>
                <p style={{ margin: 0, color: '#5b21b6', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Video size={20} />
                  <strong>{filePreview.issue_video}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => handleRemoveFile('issue_video')}
                  disabled={isSubmitting}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            )}
          </div>
          
        </fieldset>
        
        <div className="modal-actions" style={{ 
          marginTop: '20px', 
          display: 'flex', 
          gap: '10px', 
          justifyContent: 'flex-end',
          paddingTop: '20px',
          borderTop: '2px solid #e2e8f0'
        }}>
          <button 
            type="button" 
            className="btn btn-outline" 
            onClick={() => setShowComplaintForm(false)}
            disabled={isSubmitting}
            style={{
              padding: '12px 24px',
              border: '2px solid #64748b',
              background: 'white',
              color: '#64748b',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: isSubmitting ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>
          <button 
            type="submit"
            className="btn btn-primary"
            disabled={
              isSubmitting || 
              !phoneVerification.isVerified ||
              !complaintFiles.seat_photo || 
              (!complaintFiles.issue_photo && !complaintFiles.issue_video)
            }
            style={{
              padding: '12px 24px',
              background: isSubmitting || !phoneVerification.isVerified || !complaintFiles.seat_photo || (!complaintFiles.issue_photo && !complaintFiles.issue_video) ? '#94a3b8' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: isSubmitting || !phoneVerification.isVerified || !complaintFiles.seat_photo || (!complaintFiles.issue_photo && !complaintFiles.issue_video) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isSubmitting ? (
              <>
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  border: '2px solid white', 
                  borderTopColor: 'transparent', 
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite'
                }} />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle size={18} />
                Submit Complaint
              </>
            )}
          </button>
        </div>
      </form>
      
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  </div>
)}
{showMockPayment && mockPaymentData && (
      <div className="modal-overlay">
        <MockPaymentPage
          amount={mockPaymentData.amount}
          orderDetails={mockPaymentData}
          onSuccess={handleMockPaymentSuccess}
          onFailure={handleMockPaymentFailure}
          onClose={() => {
            setShowMockPayment(false);
            setMockPaymentData(null);
          }}
        />
      </div>
    )}

      </main>
      
      {showTrackBus && selectedBooking && (
        <div 
          className="modal-overlay" 
          onClick={() => setShowTrackBus(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              maxWidth: '900px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              position: 'relative'
            }}
          >
            <button
              onClick={() => setShowTrackBus(false)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: 'bold',
                zIndex: 10
              }}
            >
              <X size={18} />
            </button>

            <BusTracker
              scheduleId={selectedBooking.schedule?.id || selectedBooking.schedule}
              onClose={() => setShowTrackBus(false)}
            />
          </div>
        </div>
      )}

      {/* 🆕 ADD THIS ENTIRE CONFIRMATION MODAL */}
        {showConfirmModal && confirmationData && (
          <ConfirmationModal
            confirmationData={confirmationData}
            onConfirm={() => handleConfirmation(true)}
            onCancel={() => handleConfirmation(false)}
          />
        )}
        {trackingSchedule && (
          <BusTracker 
            scheduleId={trackingSchedule}
            onClose={() => setTrackingSchedule(null)}
          />
        )}

    </div>
  );
};
function ConfirmationModal({ confirmationData, onConfirm, onCancel }) {
  const hasOtherSeats = confirmationData.available_seats > 1;
  
  return (
    <div 
      className="modal-overlay-custom" 
      onClick={onCancel}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        animation: 'fadeIn 0.3s ease'
      }}
      
    >
      <div 
        className="modal-content-custom" 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '20px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 30px 60px rgba(0, 0, 0, 0.4)',
          animation: 'slideUp 0.3s ease'
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: 'white',
          padding: '30px',
          borderRadius: '20px 20px 0 0',
          borderBottom: '5px solid #b45309',
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <div style={{ fontSize: '32px' }}>⚠️</div>
          <h2 style={{ 
            margin: 0, 
            fontSize: '26px', 
            fontWeight: '700',
            letterSpacing: '-0.5px'
          }}>
            Seat Selection Notice
          </h2>
        </div>
        
        {/* Body */}
        <div style={{ padding: '35px' }}>
          {/* Warning Icon */}
          <div style={{
            fontSize: '80px',
            textAlign: 'center',
            marginBottom: '25px',
            animation: 'pulse 2s infinite'
          }}>
            ⚠️
          </div>
          
          {/* Seat Info */}
          <div style={{
            background: '#f3f4f6',
            border: '3px solid #d1d5db',
            borderRadius: '12px',
            padding: '18px',
            marginBottom: '25px',
            textAlign: 'center',
            fontSize: '18px',
            fontWeight: '600'
          }}>
            You are booking seat <span style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '6px 18px',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '20px',
              marginLeft: '8px'
            }}>{confirmationData.seat}</span>
          </div>
          
          {/* Main Warning */}
          <div style={{
            fontSize: '20px',
            color: '#dc2626',
            textAlign: 'center',
            marginBottom: '25px',
            lineHeight: '1.6',
            fontWeight: '600'
          }}>
            {confirmationData.message}
          </div>
          
          {/* Info Box */}
          <div style={{
            background: '#fef3c7',
            border: '3px solid #f59e0b',
            borderRadius: '12px',
            padding: '20px',
            margin: '25px 0',
            color: '#78350f',
            lineHeight: '1.8',
            fontSize: '16px'
          }}>
            <p style={{ margin: 0 }}>
              <strong style={{ display: 'block', marginBottom: '8px', fontSize: '17px' }}>
                Please Note:
              </strong>
              You will be seated next to a {confirmationData.confirmation_type === 'MALE_ADJACENT' ? 'male' : 'other gender'} passenger. 
              This seating arrangement may not provide the privacy you might prefer during your journey.
            </p>
          </div>
          
          {/* Explanation */}
          <p style={{
            fontSize: '16px',
            color: '#4b5563',
            lineHeight: '1.8',
            textAlign: 'center',
            margin: '25px 0'
          }}>
            We provide this notice to ensure your comfort during the journey. 
            You can proceed with this seat or choose a different one.
          </p>
          
          {/* Question */}
          <div style={{
            fontSize: '19px',
            color: '#1f2937',
            textAlign: 'center',
            margin: '25px 0',
            padding: '25px',
            background: '#f9fafb',
            borderRadius: '12px',
            borderLeft: '5px solid #667eea',
            fontWeight: '600'
          }}>
            Do you want to proceed with this seat?
          </div>
          
          {/* Last Seat Warning */}
          {!hasOtherSeats && (
            <div style={{
              background: '#fee2e2',
              border: '3px solid #dc2626',
              borderRadius: '12px',
              padding: '20px',
              margin: '25px 0',
              textAlign: 'center',
              color: '#991b1b',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
            }}>
              <strong style={{ 
                display: 'block', 
                fontSize: '19px', 
                marginBottom: '10px' 
              }}>
                ⚠️ Last Available Seat
              </strong>
              <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.6' }}>
                This is the last available seat on this bus. If you decline, 
                you won't be able to complete your booking.
              </p>
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: '15px',
          padding: '0 35px 35px 35px'
        }}>
          <button 
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '18px 30px',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: 'white',
              boxShadow: '0 6px 20px rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(239, 68, 68, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.3)';
            }}
          >
            <span style={{ fontSize: '22px' }}>❌</span>
            <span>No, Select Another Seat</span>
          </button>
          
          <button 
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '18px 30px',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              boxShadow: '0 6px 20px rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.3)';
            }}
          >
            <span style={{ fontSize: '22px' }}>✅</span>
            <span>Yes, Proceed with This Seat</span>
          </button>
        </div>
        
        {/* Footer Tip */}
        {hasOtherSeats && (
          <div style={{
            background: '#fef3c7',
            borderTop: '3px solid #f59e0b',
            padding: '20px 35px',
            margin: '0 -35px -35px -35px',
            borderRadius: '0 0 20px 20px',
            textAlign: 'center'
          }}>
            <small style={{
              color: '#78350f',
              fontSize: '15px',
              lineHeight: '1.6',
              display: 'block'
            }}>
              💡 <strong>Tip:</strong> Other seats are available. You can select a different seat for more comfort.
            </small>
          </div>
        )}
      </div>
      
      {/* Add keyframe animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(40px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
    
    
  );
}

export default PassengerDashboard;