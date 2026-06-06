// src/pages/Login.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, User, Lock, AlertCircle, Bus } from 'lucide-react';
import { auth } from '../services/api';
import { setUser } from '../utils/auth';
import './Auth.css';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await auth.login(formData);
      const userData = response.data.user;
      
      setUser(userData);
      
      // Redirect based on user type
      switch(userData.user_type) {
        case 'ADMIN':
          navigate('/admin/dashboard');
          break;
        case 'DRIVER':
        case 'CONDUCTOR':
        case 'SUPERVISOR':
          navigate('/staff/dashboard');
          break;
        case 'PASSENGER':
          navigate('/passenger/dashboard');
          break;
        default:
          navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-background"></div>
      
      <div className="auth-content">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <Bus size={40} />
            </div>
            <h1>Welcome Back</h1>
            <p>Sign in to your Transport Management System account</p>
          </div>

          {error && (
            <div className="alert alert-error">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="username">
                <User size={18} />
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter your username"
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">
                <Lock size={18} />
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
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
                  <LogIn size={20} />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>Don't have an account? <Link to="/register">Register here</Link></p>
            <Link to="/" className="back-home">← Back to Home</Link>
          </div>
        </div>

        <div className="auth-info">
          <h2>Transport Management System</h2>
          <p>Manage your entire transport operations efficiently</p>
          <div className="auth-features">
            <div className="feature-item">
              <div className="feature-icon">✓</div>
              <span>Real-time tracking</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon">✓</div>
              <span>Staff management</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon">✓</div>
              <span>Route optimization</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon">✓</div>
              <span>Automated scheduling</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;