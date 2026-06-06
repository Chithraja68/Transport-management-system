// src/pages/Register.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, User, Phone, Mail, Briefcase, MapPin, AlertCircle, CheckCircle, Bus } from 'lucide-react';
import { auth } from '../services/api';
import './Auth.css';

const Register = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState('PASSENGER');
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    email: '',
    employee_status: '',
    employee_id: '',
    working_district: ''
  });
  const [otp, setOtp] = useState('');
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleCredentialsChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleStep1Submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let response;
      if (userType === 'PASSENGER') {
        response = await auth.passengerRegisterStep1({
          name: formData.name,
          phone_number: formData.phone_number,
          email: formData.email
        });
      } else {
        response = await auth.staffRegisterStep1({
          name: formData.name,
          phone_number: formData.phone_number,
          employee_status: formData.employee_status,
          employee_id: formData.employee_id,
          working_district: formData.working_district
        });
      }
      
      setSuccess('OTP sent successfully to your phone!');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await auth.verifyOTP({
        phone_number: formData.phone_number,
        otp: otp
      });
      
      setSuccess('OTP verified successfully!');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (credentials.password !== credentials.confirmPassword) {
      setError('Passwords do not match!');
      return;
    }

    if (credentials.password.length < 6) {
      setError('Password must be at least 6 characters long!');
      return;
    }

    setLoading(true);

    try {
      let response;
      if (userType === 'PASSENGER') {
        response = await auth.completePassengerRegistration({
          phone_number: formData.phone_number,
          username: credentials.username,
          password: credentials.password
        });
      } else {
        response = await auth.completeStaffRegistration({
          phone_number: formData.phone_number,
          username: credentials.username,
          password: credentials.password
        });
      }
      
      setSuccess('Registration successful! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const districts = [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem',
    'Tirunelveli', 'Tiruppur', 'Vellore', 'Erode', 'Thanjavur'
  ];

  const employeeStatuses = ['Driver', 'Conductor', 'Supervisor', 'Admin'];

  return (
    <div className="auth-container">
      <div className="auth-background"></div>
      
      <div className="auth-content">
        <div className="auth-card register-card">
          <div className="auth-header">
            <div className="auth-logo">
              <Bus size={40} />
            </div>
            <h1>Create Account</h1>
            <p>Join Transport Management System</p>
          </div>

          {/* User Type Selection */}
          {step === 1 && (
            <>
              <div className="user-type-selector">
                <button
                  className={`user-type-btn ${userType === 'PASSENGER' ? 'active' : ''}`}
                  onClick={() => setUserType('PASSENGER')}
                  type="button"
                >
                  <User size={24} />
                  <span>Passenger</span>
                </button>
                <button
                  className={`user-type-btn ${userType === 'STAFF' ? 'active' : ''}`}
                  onClick={() => setUserType('STAFF')}
                  type="button"
                >
                  <Briefcase size={24} />
                  <span>Staff/Admin</span>
                </button>
              </div>

              {error && (
                <div className="alert alert-error">
                  <AlertCircle size={20} />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="alert alert-success">
                  <CheckCircle size={20} />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleStep1Submit} className="auth-form">
                <div className="form-group">
                  <label htmlFor="name">
                    <User size={18} />
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="phone_number">
                    <Phone size={18} />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone_number"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    placeholder="10-digit phone number"
                    pattern="[0-9]{10}"
                    required
                  />
                </div>

                {userType === 'PASSENGER' ? (
                  <div className="form-group">
                    <label htmlFor="email">
                      <Mail size={18} />
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="your.email@example.com"
                    />
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label htmlFor="employee_status">
                        <Briefcase size={18} />
                        Employee Status
                      </label>
                      <select
                        id="employee_status"
                        name="employee_status"
                        value={formData.employee_status}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Select Status</option>
                        {employeeStatuses.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="employee_id">
                        <User size={18} />
                        Employee ID
                      </label>
                      <input
                        type="text"
                        id="employee_id"
                        name="employee_id"
                        value={formData.employee_id}
                        onChange={handleChange}
                        placeholder="e.g., EMP001"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="working_district">
                        <MapPin size={18} />
                        Working District
                      </label>
                      <select
                        id="working_district"
                        name="working_district"
                        value={formData.working_district}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Select District</option>
                        {districts.map(district => (
                          <option key={district} value={district}>{district}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <button 
                  type="submit" 
                  className="btn btn-primary btn-full"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="spinner"></span>
                  ) : (
                    <>
                      Send OTP
                      <Phone size={20} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {/* OTP Verification */}
          {step === 2 && (
            <>
              {error && (
                <div className="alert alert-error">
                  <AlertCircle size={20} />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="alert alert-success">
                  <CheckCircle size={20} />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleOTPSubmit} className="auth-form">
                <div className="otp-info">
                  <p>We've sent a 6-digit OTP to</p>
                  <strong>{formData.phone_number}</strong>
                </div>

                <div className="form-group">
                  <label htmlFor="otp">Enter OTP</label>
                  <input
                    type="text"
                    id="otp"
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value);
                      setError('');
                    }}
                    placeholder="Enter 6-digit OTP"
                    maxLength="6"
                    pattern="[0-9]{6}"
                    required
                    className="otp-input"
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary btn-full"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="spinner"></span>
                  ) : (
                    <>
                      Verify OTP
                      <CheckCircle size={20} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-outline btn-full"
                  onClick={() => setStep(1)}
                >
                  ← Back
                </button>
              </form>
            </>
          )}

          {/* Create Credentials */}
          {step === 3 && (
            <>
              {error && (
                <div className="alert alert-error">
                  <AlertCircle size={20} />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="alert alert-success">
                  <CheckCircle size={20} />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleFinalSubmit} className="auth-form">
                <div className="form-group">
                  <label htmlFor="username">
                    <User size={18} />
                    Create Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={credentials.username}
                    onChange={handleCredentialsChange}
                    placeholder="Choose a unique username"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">Create Password</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={credentials.password}
                    onChange={handleCredentialsChange}
                    placeholder="Minimum 6 characters"
                    minLength="6"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={credentials.confirmPassword}
                    onChange={handleCredentialsChange}
                    placeholder="Re-enter your password"
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary btn-full"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="spinner"></span>
                  ) : (
                    <>
                      <UserPlus size={20} />
                      Complete Registration
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          <div className="auth-footer">
            <p>Already have an account? <Link to="/login">Sign in</Link></p>
            <Link to="/" className="back-home">← Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;