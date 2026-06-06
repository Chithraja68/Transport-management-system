import { useState, useEffect } from "react";
import SeatSelection from "./SeatSelection/SeatSelection";
import axios from "axios";
import './BookingPage.css';

export default function BookingPage({ scheduleId }) {
  const [showSeatSelection, setShowSeatSelection] = useState(false);
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null);
  const [pendingBookingData, setPendingBookingData] = useState(null);

  // Fetch schedule details when component mounts
  useEffect(() => {
    fetchScheduleDetails();
  }, [scheduleId]);

  const fetchScheduleDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `http://localhost:8000/api/transport/schedules/${scheduleId}/`,
        { withCredentials: true }
      );
      setScheduleData(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching schedule:', err);
      setError('Failed to load schedule details');
    } finally {
      setLoading(false);
    }
  };

  // Check if there are other available seats
  const hasOtherAvailableSeats = (currentSeat) => {
    if (!scheduleData) return false;
    
    // Get total available seats minus the currently selected seat
    const otherSeatsAvailable = scheduleData.available_seats - 1;
    return otherSeatsAvailable > 0;
  };

  // Handle confirmation modal response
  const handleConfirmation = (confirmed) => {
    setShowConfirmModal(false);
    
    if (confirmed) {
      console.log('✅ User confirmed, proceeding with booking...');
      
      // Add confirmation to booking data
      const retryData = {
        ...pendingBookingData,
        confirmed_warnings: [confirmationData.confirmation_type]
      };
      
      // Retry booking with confirmation
      handleSeatBookingConfirm(retryData);
    } else {
      console.log('❌ User declined, returning to seat selection');
      
      // Check if there are other seats available
      if (!hasOtherAvailableSeats(confirmationData.seat)) {
        alert(
          '⚠️ No Other Seats Available\n\n' +
          'There are no other available seats on this bus.\n\n' +
          'You may need to:\n' +
          '• Choose a different bus/schedule\n' +
          '• Travel on a different date\n' +
          '• Accept this seat with the warning'
        );
      }
      
      // Clear pending data
      setPendingBookingData(null);
      setConfirmationData(null);
    }
  };

  // Handle seat booking confirmation from SeatSelection component
  const handleSeatBookingConfirm = async (bookingData) => {
    try {
      console.log('📤 Sending booking request:', bookingData);
      
      const response = await axios.post(
        'http://localhost:8000/api/transport/bookings/',
        bookingData,
        { 
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      console.log('📥 Response received:', response.data);
      console.log('📥 Response status:', response.status);

      // Check for confirmation requirement FIRST
      if (response.data.requires_confirmation) {
        console.log('⚠️ Confirmation required:', {
          type: response.data.confirmation_type,
          seat: response.data.seat,
          message: response.data.message
        });
        
        // Store data for modal
        setConfirmationData({
          confirmation_type: response.data.confirmation_type,
          seat: response.data.seat,
          message: response.data.message,
          available_seats: scheduleData.available_seats
        });
        setPendingBookingData(bookingData);
        setShowConfirmModal(true);
        
        return; // Stop here, modal will handle next steps
      }

      // Check for successful booking
      if (response.data.booking_id) {
        console.log('✅ Booking successful!');
        
        // Close seat selection modal
        setShowSeatSelection(false);
        
        // Parse seat numbers from response
        const seatNumbers = JSON.parse(response.data.seat_numbers || '[]');
        const seats = seatNumbers.join(', ');
        
        alert(
          `✅ Booking Confirmed!\n\n` +
          `Booking ID: ${response.data.booking_id}\n` +
          `Seats: ${seats}\n` +
          `Total Fare: ₹${response.data.total_fare}\n\n` +
          `Route: ${response.data.schedule?.route?.route_name || 'N/A'}\n` +
          `Date: ${response.data.schedule?.schedule_date || 'N/A'}\n` +
          `Departure: ${response.data.schedule?.departure_time || 'N/A'}\n\n` +
          `Check your bookings for more details.`
        );
        
        // Refresh schedule data to update available seats
        fetchScheduleDetails();
      }
    } catch (err) {
      console.error('❌ Booking error:', err);
      
      // Extract error message
      let errorMessage = 'Failed to create booking';
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else if (err.response.data.error) {
          errorMessage = err.response.data.error;
        } else if (err.response.data.detail) {
          errorMessage = err.response.data.detail;
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        }
      }
      
      alert(`❌ Booking Failed\n\n${errorMessage}`);
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Loading schedule details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button onClick={fetchScheduleDetails} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  if (!scheduleData) {
    return (
      <div className="error-container">
        <p className="error-message">Schedule not found</p>
      </div>
    );
  }

  return (
    <div className="booking-page-container">
      {/* Schedule Information Card */}
      <div className="schedule-card">
        <div className="schedule-header">
          <h2>🚌 {scheduleData.route?.route_name || 'Schedule Details'}</h2>
          <span className={`status-badge ${scheduleData.status?.toLowerCase()}`}>
            {scheduleData.status}
          </span>
        </div>

        <div className="schedule-details">
          <div className="route-info">
            <div className="route-point">
              <span className="point-icon">📍</span>
              <div>
                <div className="point-label">From</div>
                <div className="point-value">{scheduleData.route?.start_point || scheduleData.start_point}</div>
              </div>
            </div>
            <div className="route-arrow">→</div>
            <div className="route-point">
              <span className="point-icon">🎯</span>
              <div>
                <div className="point-label">To</div>
                <div className="point-value">{scheduleData.route?.end_point || scheduleData.end_point}</div>
              </div>
            </div>
          </div>

          <div className="timing-info">
            <div className="timing-item">
              <span className="timing-icon">📅</span>
              <div>
                <div className="timing-label">Date</div>
                <div className="timing-value">{scheduleData.schedule_date}</div>
              </div>
            </div>
            <div className="timing-item">
              <span className="timing-icon">🕐</span>
              <div>
                <div className="timing-label">Departure</div>
                <div className="timing-value">{scheduleData.departure_time}</div>
              </div>
            </div>
            <div className="timing-item">
              <span className="timing-icon">🕐</span>
              <div>
                <div className="timing-label">Arrival</div>
                <div className="timing-value">{scheduleData.arrival_time}</div>
              </div>
            </div>
          </div>

          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Base Fare</span>
              <span className="detail-value fare">
                ₹{scheduleData?.fare}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Available Seats</span>
              <span className="detail-value seats">
                {scheduleData?.available_seats} / {scheduleData?.vehicle?.capacity || 'N/A'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Vehicle</span>
              <span className="detail-value">
                {scheduleData?.vehicle?.vehicle_number || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className="booking-action">
          <button
            onClick={() => setShowSeatSelection(true)}
            disabled={scheduleData?.available_seats === 0}
            className="select-seats-btn"
          >
            {scheduleData?.available_seats === 0 
              ? '🚫 Fully Booked' 
              : '🪑 Select Your Seats'}
          </button>
          
          {scheduleData?.available_seats > 0 && scheduleData?.available_seats <= 10 && (
            <p className="limited-seats-warning">
              ⚠️ Only {scheduleData.available_seats} seats left!
            </p>
          )}
        </div>
      </div>

      {/* Important Information */}
      <div className="info-cards">
        <div className="info-card">
          <h4>📋 Booking Instructions</h4>
          <ul>
            <li>Select your preferred seats from the layout</li>
            <li>Maximum 6 seats can be booked at once</li>
            <li>Enter passenger details for each seat</li>
            <li>Women-reserved seats are for female passengers only</li>
          </ul>
        </div>

        <div className="info-card">
          <h4>👺 Seat Restrictions</h4>
          <ul>
            <li><strong>Women-Reserved:</strong> Only female passengers can book</li>
            <li><strong>Adjacent to Female:</strong> Only females can book adjacent seats</li>
            <li><strong>Safety First:</strong> All restrictions ensure passenger comfort</li>
          </ul>
        </div>

        <div className="info-card">
          <h4>❌ Cancellation Policy</h4>
          <ul>
            <li>Free cancellation up to 2 hours before departure</li>
            <li>Full refund on cancellation</li>
            <li>Cannot cancel after departure time</li>
            <li>Refund processed within 3-5 business days</li>
          </ul>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {showConfirmModal && confirmationData && (
        <ConfirmationModal
          confirmationData={confirmationData}
          onConfirm={() => handleConfirmation(true)}
          onCancel={() => handleConfirmation(false)}
        />
      )}

      {/* Seat Selection Modal */}
      {showSeatSelection && scheduleData && (
        <SeatSelection
          schedule={{
            id: scheduleId,
            route: scheduleData.route,
            route_name: scheduleData.route?.route_name,
            start_point: scheduleData.route?.start_point || scheduleData.start_point,
            end_point: scheduleData.route?.end_point || scheduleData.end_point,
            schedule_date: scheduleData.schedule_date,
            departure_time: scheduleData.departure_time,
            arrival_time: scheduleData.arrival_time,
            fare: scheduleData.fare,
            available_seats: scheduleData.available_seats,
            vehicle: scheduleData.vehicle
          }}
          onClose={() => setShowSeatSelection(false)}
          onConfirm={handleSeatBookingConfirm}
        />
      )}
    </div>
  );
}

// Custom Confirmation Modal Component
function ConfirmationModal({ confirmationData, onConfirm, onCancel }) {
  const { confirmation_type, seat, message, available_seats } = confirmationData;
  
  const hasOtherSeats = available_seats > 1;
  
  // Parse the message to extract gender
  const adjacentGender = message.includes('MALE') ? 'MALE' : 
                        message.includes('OTHER') ? 'OTHER' : 
                        'MALE or OTHER';
  
  return (
    <div className="modal-overlay-custom" onClick={onCancel}>
      <div className="modal-content-custom" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-custom">
          <h2>⚠️ Adjacent Seat Warning</h2>
        </div>
        
        <div className="modal-body-custom">
          <div className="warning-icon-large">⚠️</div>
          
          <div className="seat-info-box">
            <strong>Selected Seat:</strong> <span className="seat-number">{seat}</span>
          </div>
          
          <div className="warning-message">
            <p className="main-warning">
              <strong>The adjacent seat is occupied by a {adjacentGender} passenger.</strong>
            </p>
            
            <div className="info-box-modal">
              <p>
                ℹ️ For your comfort and safety, we want to inform you that the seat next to your 
                selected seat is currently occupied by a {adjacentGender.toLowerCase()} passenger.
              </p>
            </div>
            
            <p className="explanation-text">
              You may feel more comfortable selecting a different seat if available, but you 
              can proceed with this seat if you prefer.
            </p>
            
            <p className="question-text">
              <strong>Do you want to proceed with this booking?</strong>
            </p>
          </div>
          
          {!hasOtherSeats && (
            <div className="last-seat-warning">
              <strong>⚠️ This is the LAST available seat on this bus!</strong>
              <p style={{ marginTop: '8px', fontSize: '14px' }}>
                If you choose "No", you'll need to select a different bus or schedule.
              </p>
            </div>
          )}
        </div>
        
        <div className="modal-actions-custom">
          <button 
            className="btn-cancel-custom" 
            onClick={onCancel}
          >
            {hasOtherSeats ? '❌ No, Select Another Seat' : '❌ Cancel Booking'}
          </button>
          <button className="btn-confirm-custom" onClick={onConfirm}>
            ✅ Yes, Proceed with Booking
          </button>
        </div>
        
        {!hasOtherSeats && (
          <div className="no-seats-message">
            <small>
              📢 This is the only available seat. You can either proceed with this booking 
              or choose a different bus/schedule.
            </small>
          </div>
        )}
      </div>
    </div>
  );
}