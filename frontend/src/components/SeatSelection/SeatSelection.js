import React, { useState, useEffect } from 'react';
import { User, UserX, Heart } from 'lucide-react';
import './SeatSelection.css';

const SeatLayout = ({ schedule, onSeatSelect, selectedSeats = [] }) => {
  const [localSelectedSeats, setLocalSelectedSeats] = useState(selectedSeats);

  useEffect(() => {
    setLocalSelectedSeats(selectedSeats);
  }, [selectedSeats]);

  // Get seat configuration
  const seatLayout = schedule.seat_layout || '2-2';
  const totalRows = schedule.total_rows || 15;
  const lastRowSeats = schedule.last_row_seats || 5;
  const bookedSeats = schedule.booked_seats_list || [];
  const womenSeats = schedule.women_seats_list || [];

  // Parse layout (e.g., "2-2" means 2 seats, aisle, 2 seats)
  const layoutParts = seatLayout.split('-').map(Number);
  const seatsPerRow = layoutParts.reduce((a, b) => a + b, 0);

  // Generate seat labels (A, B, C, D)
  const generateSeatLabel = (rowIndex, seatIndex) => {
    const row = rowIndex + 1;
    const labels = ['A', 'B', 'C', 'D', 'E'];
    return `${row}${labels[seatIndex]}`;
  };

  // Check seat status
  const getSeatStatus = (seatLabel) => {
    if (bookedSeats.includes(seatLabel)) return 'booked';
    if (localSelectedSeats.includes(seatLabel)) return 'selected';
    if (womenSeats.includes(seatLabel)) return 'women';
    return 'available';
  };

  // Handle seat click
  const handleSeatClick = (seatLabel) => {
    const status = getSeatStatus(seatLabel);
    
    // Can't select booked seats
    if (status === 'booked') {
      return;
    }

    let newSelectedSeats;
    if (status === 'selected') {
      // Deselect
      newSelectedSeats = localSelectedSeats.filter(s => s !== seatLabel);
    } else {
      // Select (limit to 6 seats per booking)
      if (localSelectedSeats.length >= 6) {
        alert('Maximum 6 seats can be selected per booking');
        return;
      }
      newSelectedSeats = [...localSelectedSeats, seatLabel];
    }

    setLocalSelectedSeats(newSelectedSeats);
    onSeatSelect(newSelectedSeats);
  };

  // Render a single seat
  const renderSeat = (rowIndex, seatIndex) => {
    const seatLabel = generateSeatLabel(rowIndex, seatIndex);
    const status = getSeatStatus(seatLabel);

    return (
      <div
        key={seatLabel}
        className={`seat seat-${status}`}
        onClick={() => handleSeatClick(seatLabel)}
        title={`Seat ${seatLabel} - ${status}`}
      >
        <div className="seat-icon">
          {status === 'booked' ? (
            <UserX size={20} />
          ) : status === 'women' ? (
            <Heart size={20} />
          ) : (
            <User size={20} />
          )}
        </div>
        <div className="seat-label">{seatLabel}</div>
      </div>
    );
  };

  // Render a row of seats
  const renderRow = (rowIndex) => {
    const isLastRow = rowIndex === totalRows - 1;
    const seatsInThisRow = isLastRow ? lastRowSeats : seatsPerRow;

    // For last row, center the seats
    const seats = [];
    let seatIndex = 0;

    if (isLastRow) {
      // Last row: render all seats together (usually 5 seats in back)
      for (let i = 0; i < seatsInThisRow; i++) {
        seats.push(renderSeat(rowIndex, seatIndex++));
      }
    } else {
      // Normal rows: follow layout pattern (e.g., 2-2)
      layoutParts.forEach((count, partIndex) => {
        const seatGroup = [];
        for (let i = 0; i < count; i++) {
          seatGroup.push(renderSeat(rowIndex, seatIndex++));
        }
        seats.push(
          <div key={`group-${partIndex}`} className="seat-group">
            {seatGroup}
          </div>
        );
        
        // Add aisle after each group except last
        if (partIndex < layoutParts.length - 1) {
          seats.push(<div key={`aisle-${partIndex}`} className="aisle" />);
        }
      });
    }

    return (
      <div key={`row-${rowIndex}`} className={`seat-row ${isLastRow ? 'last-row' : ''}`}>
        <div className="row-number">{rowIndex + 1}</div>
        <div className="seats-container">
          {seats}
        </div>
      </div>
    );
  };

  // Render all rows
  const rows = [];
  for (let i = 0; i < totalRows; i++) {
    rows.push(renderRow(i));
  }

  return (
    <div className="seat-layout-container">
      {/* Driver section */}
      <div className="driver-section">
        <div className="steering-wheel">🎯</div>
        <div className="driver-label">Driver</div>
      </div>

      {/* Legend */}
      <div className="seat-legend">
        <div className="legend-item">
          <div className="seat seat-available seat-mini"><User size={16} /></div>
          <span>Available</span>
        </div>
        <div className="legend-item">
          <div className="seat seat-selected seat-mini"><User size={16} /></div>
          <span>Selected</span>
        </div>
        <div className="legend-item">
          <div className="seat seat-booked seat-mini"><UserX size={16} /></div>
          <span>Booked</span>
        </div>
        <div className="legend-item">
          <div className="seat seat-women seat-mini"><Heart size={16} /></div>
          <span>Women Only</span>
        </div>
      </div>

      {/* Seat grid */}
      <div className="seat-grid">
        {rows}
      </div>

      {/* Selection summary */}
      {localSelectedSeats.length > 0 && (
        <div className="selection-summary">
          <strong>Selected Seats:</strong> {localSelectedSeats.join(', ')}
          <span className="seat-count">({localSelectedSeats.length} seat{localSelectedSeats.length > 1 ? 's' : ''})</span>
        </div>
      )}
    </div>
  );
};

export default SeatLayout;