# Transport Management System

A comprehensive web application for managing transport operations including vehicles, staff, routes, schedules, bookings, and more.

## Features

- 🚌 Vehicle Management
- 👥 Staff Management (Drivers, Conductors, Supervisors)
- 🗺️ Route Planning
- 📅 Schedule Management
- 🎫 Passenger Bookings
- 🏖️ Leave Management with Auto-reassignment
- 📢 Priority-based Complaint System
- 💰 Payroll Management
- 📱 SMS Notifications
- 🔐 Role-based Access Control

## Tech Stack

**Backend:**
- Django 4.2
- Django REST Framework
- SQLite/PostgreSQL
- JWT Authentication
- Twilio (SMS)

**Frontend:**
- React 18
- React Router
- Tailwind CSS
- Axios
- Lucide Icons

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 14+
- pip
- npm

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your configurations
python manage.py migrate
python manage.py createsuperuser
python populate_data.py  # Load sample data
python manage.py runserver
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
npm start
```

## Access

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api
- Admin Panel: http://localhost:8000/admin

## Sample Credentials

**Admin:**
- Username: `admin`
- Password: `admin123`

**Staff (Driver):**
- Username: `driver1`
- Password: `driver123`

**Passenger:**
- Username: `passenger1`
- Password: `pass123`

## Documentation

See `/docs` folder for detailed documentation.

## License

MIT License