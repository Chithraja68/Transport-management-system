import React, { useState, useEffect } from 'react';
import { transport } from '../../services/api';
import './SeatBooking.css';

const SeatBookingWithFlags = ({ scheduleId }) => {
    const [seatMatrix, setSeatMatrix] = useState([]);
    const [selectedSeats, setSelectedSeats] = useState([]);
    const [passengerDetails, setPassengerDetails] = useState({});
    const [loading, setLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmationType, setConfirmationType] = useState(null);
    const [confirmationMessage, setConfirmationMessage] = useState('');
    const [pendingSeat, setPendingSeat] = useState(null);
    const [availableSeatsCount, setAvailableSeatsCount] = useState(0);

    // Load seat matrix with flags
    useEffect(() => {
        loadSeatMatrix();
    }, [scheduleId]);

    const loadSeatMatrix = async () => {
        setLoading(true);
        try {
            const response = await transport.getSeatMatrixWithFlags(scheduleId);
            setSeatMatrix(response.data.seat_matrix);
            
            // Count available seats
            const available = response.data.seat_matrix
                .flat()
                .filter(seat => !seat.is_booked).length;
            setAvailableSeatsCount(available);
        } catch (error) {
            console.error('Error loading seat matrix:', error);
            alert('Failed to load seats');
        } finally {
            setLoading(false);
        }
    };

    const handleSeatClick = async (seat) => {
        // Can't select booked seats
        if (seat.is_booked) {
            alert(`Seat ${seat.seat_number} is already booked`);
            return;
        }

        // Toggle selection
        if (selectedSeats.includes(seat.seat_number)) {
            // Deselect
            setSelectedSeats(prev => prev.filter(s => s !== seat.seat_number));
            setPassengerDetails(prev => {
                const updated = { ...prev };
                delete updated[seat.seat_number];
                return updated;
            });
        } else {
            // Select
            setSelectedSeats(prev => [...prev, seat.seat_number]);
            
            // Auto-lock gender if seat is female-only
            const initialGender = seat.is_female_only ? 'FEMALE' : '';
            setPassengerDetails(prev => ({
                ...prev,
                [seat.seat_number]: {
                    passenger_name: '',
                    passenger_age: '',
                    passenger_gender: initialGender,
                    passenger_phone: '',
                    passenger_alternate_phone: '',
                    seat_number: seat.seat_number
                }
            }));
        }
    };

    const updatePassengerDetail = (seatNumber, field, value) => {
        setPassengerDetails(prev => ({
            ...prev,
            [seatNumber]: {
                ...prev[seatNumber],
                [field]: value
            }
        }));
    };

    const handleBooking = async () => {
        // Validate
        if (selectedSeats.length === 0) {
            alert('Please select at least one seat');
            return;
        }

        // Check all details filled
        for (const seat of selectedSeats) {
            const details = passengerDetails[seat];
            if (!details.passenger_name || !details.passenger_age || !details.passenger_gender) {
                alert(`Please fill all details for seat ${seat}`);
                return;
            }
        }

        setLoading(true);
        try {
            const response = await transport.createBookingWithFlags({
                schedule_id: scheduleId,
                passenger_details: Object.values(passengerDetails),
                confirmed_warnings: [] // Will be filled if confirmation needed
            });

            // Check if confirmation required
            if (response.data.requires_confirmation) {
                setPendingSeat(response.data.seat);
                setConfirmationType(response.data.confirmation_type);
                setConfirmationMessage(response.data.message);
                setShowConfirmation(true);
                setLoading(false);
                return;
            }

            alert(`Booking successful! Booking ID: ${response.data.booking_id}`);
            loadSeatMatrix();
            setSelectedSeats([]);
            setPassengerDetails({});
        } catch (error) {
            console.error('Booking error:', error);
            alert(error.response?.data?.error || 'Booking failed');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmBooking = async (confirmed) => {
        setShowConfirmation(false);

        if (!confirmed) {
            // Check if there are other available seats
            const otherSeatsAvailable = availableSeatsCount - selectedSeats.length;
            
            if (otherSeatsAvailable <= 0) {
                alert(
                    '⚠️ No Other Seats Available\n\n' +
                    'There are no other available seats on this bus.\n\n' +
                    'You may need to:\n' +
                    '• Choose a different bus/schedule\n' +
                    '• Travel on a different date\n' +
                    '• Accept this seat with the warning'
                );
            }
            return;
        }

        // Retry booking with confirmation
        setLoading(true);
        try {
            const response = await transport.createBookingWithFlags({
                schedule_id: scheduleId,
                passenger_details: Object.values(passengerDetails),
                confirmed_warnings: [confirmationType] // Include confirmed type
            });

            alert(`Booking successful! Booking ID: ${response.data.booking_id}`);
            loadSeatMatrix();
            setSelectedSeats([]);
            setPassengerDetails({});
        } catch (error) {
            console.error('Booking error:', error);
            alert(error.response?.data?.error || 'Booking failed');
        } finally {
            setLoading(false);
        }
    };

    const getSeatClassName = (seat) => {
        const classes = ['seat'];

        if (selectedSeats.includes(seat.seat_number)) {
            classes.push('seat-selected');
        } else if (seat.is_booked) {
            if (seat.passenger_gender === 'MALE') {
                classes.push('seat-booked-male');
            } else if (seat.passenger_gender === 'FEMALE') {
                classes.push('seat-booked-female');
            } else {
                classes.push('seat-booked-other');
            }
        } else if (seat.seat_type === 'WOMEN_RESERVED') {
            classes.push('seat-women-reserved');
        } else if (seat.is_female_only) {
            classes.push('seat-female-only');
        } else {
            classes.push('seat-available');
        }

        return classes.join(' ');
    };

    const getSeatIcon = (seat) => {
        if (selectedSeats.includes(seat.seat_number)) return '✓';
        if (seat.is_booked) {
            if (seat.passenger_gender === 'MALE') return '♂';
            if (seat.passenger_gender === 'FEMALE') return '♀';
            return '👤';
        }
        if (seat.seat_type === 'WOMEN_RESERVED') return '💗';
        if (seat.is_female_only) return '⚠️';
        return '👤';
    };

    // Check if there are other seats available
    const hasOtherSeats = () => {
        return availableSeatsCount - selectedSeats.length > 0;
    };

    return (
        <div className="seat-booking-container">
            <div className="booking-header">
                <h2>🚌 Select Your Seats</h2>
            </div>

            {/* Legend */}
            <div className="seat-legend">
                <div className="legend-item">
                    <div className="seat seat-available"><span>👤</span></div>
                    <span>Available</span>
                </div>
                <div className="legend-item">
                    <div className="seat seat-women-reserved"><span>💗</span></div>
                    <span>Women Reserved</span>
                </div>
                <div className="legend-item">
                    <div className="seat seat-female-only"><span>⚠️</span></div>
                    <span>Female Only (Flag)</span>
                </div>
                <div className="legend-item">
                    <div className="seat seat-booked-male"><span>♂</span></div>
                    <span>Booked Male</span>
                </div>
                <div className="legend-item">
                    <div className="seat seat-booked-female"><span>♀</span></div>
                    <span>Booked Female</span>
                </div>
                <div className="legend-item">
                    <div className="seat seat-selected"><span>✓</span></div>
                    <span>Your Selection</span>
                </div>
            </div>

            {/* Driver Section */}
            <div className="driver-section">
                <div className="driver-icon">🎯</div>
                <div className="driver-text">DRIVER</div>
            </div>

            {/* Seat Matrix */}
            <div className="seat-matrix">
                {seatMatrix.map((row, rowIndex) => (
                    <div key={rowIndex} className="seat-row">
                        <div className="row-number">{rowIndex + 1}</div>
                        <div className="seats-container">
                            {row.map((seat, seatIndex) => (
                                <React.Fragment key={seat.seat_number}>
                                    <div
                                        className={getSeatClassName(seat)}
                                        onClick={() => handleSeatClick(seat)}
                                        title={`${seat.seat_number} - ${seat.seat_type}${seat.is_female_only ? ' (Female Only)' : ''}`}
                                    >
                                        <div className="seat-icon">{getSeatIcon(seat)}</div>
                                        <div className="seat-label">{seat.seat_number}</div>
                                        {seat.restrictions && seat.restrictions.length > 0 && (
                                            <div className="seat-flag">🚩</div>
                                        )}
                                    </div>
                                    {seat.is_aisle && <div className="aisle">AISLE</div>}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Passenger Details */}
            {selectedSeats.length > 0 && (
                <div className="passenger-details-section">
                    <h3>👥 Passenger Details ({selectedSeats.length} seat{selectedSeats.length > 1 ? 's' : ''})</h3>

                    {selectedSeats.map(seatNumber => {
                        const seat = seatMatrix.flat().find(s => s.seat_number === seatNumber);
                        const details = passengerDetails[seatNumber] || {};
                        const isFemaleOnly = seat?.is_female_only || seat?.seat_type === 'WOMEN_RESERVED';

                        return (
                            <div key={seatNumber} className="passenger-card">
                                <div className="passenger-card-header">
                                    <h4>🪑 Seat {seatNumber}</h4>
                                    {isFemaleOnly && (
                                        <span className="female-only-badge">⚠️ Female Only</span>
                                    )}
                                </div>

                                {isFemaleOnly && (
                                    <div className="warning-box">
                                        ℹ️ This seat is restricted to female passengers only
                                        {seat?.restrictions?.map((r, i) => (
                                            <div key={i} className="restriction-reason">
                                                Reason: {r.type.replace(/_/g, ' ')}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Name *</label>
                                        <input
                                            type="text"
                                            value={details.passenger_name || ''}
                                            onChange={(e) => updatePassengerDetail(seatNumber, 'passenger_name', e.target.value)}
                                            placeholder="Passenger name"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Age *</label>
                                        <input
                                            type="number"
                                            value={details.passenger_age || ''}
                                            onChange={(e) => updatePassengerDetail(seatNumber, 'passenger_age', e.target.value)}
                                            placeholder="Age"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Gender * {isFemaleOnly && <small>(Female Only)</small>}</label>
                                        <select
                                            value={details.passenger_gender || ''}
                                            onChange={(e) => updatePassengerDetail(seatNumber, 'passenger_gender', e.target.value)}
                                            disabled={isFemaleOnly}
                                        >
                                            <option value="">Select</option>
                                            <option value="FEMALE">Female</option>
                                            {!isFemaleOnly && <option value="MALE">Male</option>}
                                            {!isFemaleOnly && <option value="OTHER">Other</option>}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Phone *</label>
                                        <input
                                            type="tel"
                                            value={details.passenger_phone || ''}
                                            onChange={(e) => updatePassengerDetail(seatNumber, 'passenger_phone', e.target.value)}
                                            placeholder="Contact number"
                                            maxLength="10"
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Alternate Phone *</label>
                                    <input
                                        type="tel"
                                        value={details.passenger_alternate_phone || ''}
                                        onChange={(e) => updatePassengerDetail(seatNumber, 'passenger_alternate_phone', e.target.value)}
                                        placeholder="Emergency contact"
                                        maxLength="10"
                                    />
                                </div>
                            </div>
                        );
                    })}

                    <div className="booking-actions">
                        <button
                            className="btn btn-primary btn-full"
                            onClick={handleBooking}
                            disabled={loading}
                        >
                            {loading ? '⏳ Processing...' : '✅ Confirm Booking'}
                        </button>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmation && (
                <div className="modal-overlay" onClick={() => handleConfirmBooking(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>⚠️ Adjacent Seat Warning</h3>
                        </div>
                        <div className="modal-body">
                            <div className="warning-icon-large">⚠️</div>
                            
                            <div className="seat-info-box">
                                <strong>Selected Seat:</strong> <span className="seat-number">{pendingSeat}</span>
                            </div>

                            <div className="confirmation-message">
                                <p className="main-warning">
                                    <strong>The adjacent seat is occupied by a MALE or OTHER gender passenger.</strong>
                                </p>
                                <div className="warning-highlight">
                                    ⚠️ {confirmationMessage}
                                </div>
                                <p className="question-text">
                                    <strong>Do you want to proceed with this booking?</strong>
                                </p>
                            </div>

                            {!hasOtherSeats() && (
                                <div className="last-seat-warning">
                                    <strong>⚠️ This is the last available seat on this bus!</strong>
                                </div>
                            )}
                        </div>
                        <div className="modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => handleConfirmBooking(false)}
                            >
                                {hasOtherSeats() ? '❌ No, Select Another Seat' : '❌ Cancel Booking'}
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => handleConfirmBooking(true)}
                            >
                                ✅ Yes, Proceed with Booking
                            </button>
                        </div>
                        
                        {!hasOtherSeats() && (
                            <div className="no-seats-message">
                                <small>
                                    📢 This is the only available seat. You can either proceed with this booking 
                                    or choose a different bus/schedule.
                                </small>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {loading && (
                <div className="loading-overlay">
                    <div className="loading-spinner">⏳ Loading...</div>
                </div>
            )}
        </div>
    );
};

export default SeatBookingWithFlags;