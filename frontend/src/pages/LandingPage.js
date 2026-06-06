// src/pages/LandingPage.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, Users, MapPin, Calendar, Shield, TrendingUp } from 'lucide-react';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Bus size={40} />,
      title: 'Fleet Management',
      description: 'Track and manage your entire vehicle fleet in real-time'
    },
    {
      icon: <Users size={40} />,
      title: 'Staff Management',
      description: 'Comprehensive staff scheduling and payroll system'
    },
    {
      icon: <MapPin size={40} />,
      title: 'Route Planning',
      description: 'Optimize routes across Tamil Nadu districts'
    },
    {
      icon: <Calendar size={40} />,
      title: 'Smart Scheduling',
      description: 'Automated schedule management with leave handling'
    },
    {
      icon: <Shield size={40} />,
      title: 'Secure Platform',
      description: 'OTP-based authentication and role-based access'
    },
    {
      icon: <TrendingUp size={40} />,
      title: 'Analytics',
      description: 'Real-time insights and performance metrics'
    }
  ];

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <header className="hero">
        <nav className="navbar">
          <div className="container">
            <div className="logo">
              <Bus size={32} />
              <span>Transport Management System</span>
            </div>
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/login')}
            >
              Login
            </button>
          </div>
        </nav>

        <div className="hero-content container">
          <h1 className="hero-title">
            Streamline Your Transport Operations
          </h1>
          <p className="hero-subtitle">
            Complete solution for managing vehicles, staff, routes, and bookings 
            across Tamil Nadu. Efficient, secure, and easy to use.
          </p>
          <div className="hero-buttons">
            <button 
              className="btn btn-large btn-primary"
              onClick={() => navigate('/login')}
            >
              Get Started
            </button>
            <button 
              className="btn btn-large btn-outline"
              onClick={() => navigate('/register')}
            >
              Register Now
            </button>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="features">
        <div className="container">
          <h2 className="section-title">Powerful Features</h2>
          <p className="section-subtitle">
            Everything you need to manage your transport business efficiently
          </p>
          
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Register</h3>
              <p>Create your account with OTP verification</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Set Up</h3>
              <p>Configure routes, vehicles, and staff</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Manage</h3>
              <p>Monitor operations in real-time</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-number">4</div>
              <h3>Grow</h3>
              <p>Scale your business efficiently</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="container">
          <h2>Ready to Transform Your Transport Management?</h2>
          <p>Join hundreds of transport operators across Tamil Nadu</p>
          <button 
            className="btn btn-large btn-white"
            onClick={() => navigate('/register')}
          >
            Start Free Today
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h4>TMS</h4>
              <p>Complete transport management solution for Tamil Nadu</p>
            </div>
            <div className="footer-section">
              <h4>Quick Links</h4>
              <ul>
                <li><a href="/login">Login</a></li>
                <li><a href="/register">Register</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Contact</h4>
              <p>Email: support@tms.com</p>
              <p>Phone: +91 1234567890</p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2026 Transport Management System. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;