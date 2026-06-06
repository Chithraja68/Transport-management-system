import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './components/Dashboard/AdminDashboard';
import StaffDashboard from './components/Dashboard/StaffDashboard';
import PassengerDashboard from './components/Dashboard/PassengerDashboard';
import { getUser } from './utils/auth';
import { auth } from './services/api';
import './App.css';

const PrivateRoute = ({ children, allowedTypes }) => {
  const user = getUser();
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (allowedTypes && !allowedTypes.includes(user.user_type)) {
    return <Navigate to="/" />;
  }
  
  return children;
};

function App() {
  const user = getUser();

  useEffect(() => {
    // Fetch CSRF token when app loads
    const fetchCsrfToken = async () => {
      try {
        await auth.getCsrfToken();
        console.log('CSRF token fetched successfully');
      } catch (err) {
        console.log('CSRF token fetch failed (non-critical):', err.message);
      }
    };

    fetchCsrfToken();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route 
          path="/admin/dashboard" 
          element={
            <PrivateRoute allowedTypes={['ADMIN']}>
              <AdminDashboard />
            </PrivateRoute>
          } 
        />
        
        <Route 
          path="/staff/dashboard" 
          element={
            <PrivateRoute allowedTypes={['DRIVER', 'CONDUCTOR', 'SUPERVISOR']}>
              <StaffDashboard />
            </PrivateRoute>
          } 
        />
        
        <Route 
          path="/passenger/dashboard" 
          element={
            <PrivateRoute allowedTypes={['PASSENGER']}>
              <PassengerDashboard />
            </PrivateRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;