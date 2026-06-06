// src/components/Payment/MockPaymentPage.js - FIXED VERSION
// FIX: Properly pass payment result with all required fields

import React, { useState } from 'react';
import { CreditCard, Smartphone, Building2, Wallet, Lock, CheckCircle, XCircle, Loader } from 'lucide-react';
import { transport } from '../../services/api';
import './MockPaymentPage.css';

const MockPaymentPage = ({ 
  amount, 
  orderDetails, 
  onSuccess, 
  onFailure, 
  onClose 
}) => {
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  
  // Card payment state
  const [cardData, setCardData] = useState({
    card_number: '',
    card_holder: '',
    expiry_month: '',
    expiry_year: '',
    cvv: ''
  });
  
  // UPI payment state
  const [upiId, setUpiId] = useState('');
  
  // Net Banking state
  const [selectedBank, setSelectedBank] = useState('');
  
  // Wallet state
  const [selectedWallet, setSelectedWallet] = useState('');
  const [walletPhone, setWalletPhone] = useState('');
  
  // Format card number with spaces
  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    
    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };
  
  const handleCardChange = (field, value) => {
    if (field === 'card_number') {
      value = formatCardNumber(value);
      if (value.replace(/\s/g, '').length > 16) return;
    }
    if (field === 'cvv' && value.length > 3) return;
    if (field === 'expiry_month' && value.length > 2) return;
    if (field === 'expiry_year' && value.length > 4) return;
    
    setCardData({ ...cardData, [field]: value });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    setResult(null);
    
    try {
      const paymentData = {
        order_id: orderDetails.order_id,
        payment_method: paymentMethod
      };
      
      if (paymentMethod === 'CARD') {
        // Validate card
        if (!cardData.card_number || !cardData.cvv || !cardData.expiry_month || !cardData.expiry_year) {
          throw new Error('Please fill all card details');
        }
        
        paymentData.card_number = cardData.card_number.replace(/\s/g, '');
        paymentData.cvv = cardData.cvv;
        paymentData.card_holder = cardData.card_holder;
        paymentData.expiry_month = cardData.expiry_month;
        paymentData.expiry_year = cardData.expiry_year;
      } else if (paymentMethod === 'UPI') {
        if (!upiId) {
          throw new Error('Please enter UPI ID');
        }
        paymentData.upi_id = upiId;
      } else if (paymentMethod === 'NETBANKING') {
        if (!selectedBank) {
          throw new Error('Please select a bank');
        }
        paymentData.bank_code = selectedBank;
      } else if (paymentMethod === 'WALLET') {
        if (!selectedWallet) {
          throw new Error('Please select a wallet');
        }
        if (!walletPhone) {
          throw new Error('Please enter phone number linked to wallet');
        }
        paymentData.wallet_provider = selectedWallet;
        paymentData.wallet_phone = walletPhone;
      }
      
      console.log('🔄 Processing payment with data:', paymentData);
      
      // Process payment
      const response = await transport.processMockPayment(paymentData);
      
      console.log('✅ Payment response:', response.data);
      
      // ✅ FIX: Check if payment was successful and structure the result properly
      if (response.data && response.data.success && response.data.status === 'SUCCESS') {
        // ✅ CREATE PROPERLY STRUCTURED PAYMENT RESULT
        const paymentResult = {
          id: response.data.id,              // ✅ Add numeric ID
          payment_id: response.data.payment_id,
          order_id: response.data.order_id,
          signature: response.data.signature,
          status: response.data.status,
          amount: amount
        };
        
        console.log('✅ Structured payment result:', paymentResult);
        
        setResult({ 
          success: true, 
          data: paymentResult 
        });
        
        // Wait a bit to show success, then call onSuccess with the structured result
        setTimeout(() => {
          onSuccess(paymentResult);  // ✅ Pass the complete paymentResult object
        }, 2000);
      } else {
        throw new Error(response.data?.error_description || response.data?.error || 'Payment processing failed');
      }
      
    } catch (error) {
      console.error('❌ Payment error:', error);
      
      const errorMessage = error.response?.data?.error_description ||
                          error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Payment failed. Please try again.';
      
      setResult({ 
        success: false, 
        error: errorMessage 
      });
      
      // Optionally call onFailure callback
      if (onFailure) {
        onFailure(errorMessage);
      }
    } finally {
      setProcessing(false);
    }
  };
  
  // Test card suggestions
  const fillTestCard = (type) => {
    if (type === 'success') {
      setCardData({
        card_number: '4111 1111 1111 1111',
        card_holder: 'Test User',
        expiry_month: '12',
        expiry_year: '2025',
        cvv: '123'
      });
    } else {
      setCardData({
        card_number: '4111 1111 1111 0000',
        card_holder: 'Test User',
        expiry_month: '12',
        expiry_year: '2025',
        cvv: '123'
      });
    }
  };
  
  if (result) {
    return (
      <div className="payment-result">
        {result.success ? (
          <div className="success-result">
            <CheckCircle size={64} className="success-icon" />
            <h2>Payment Successful!</h2>
            <p>Your booking is being confirmed...</p>
            <div className="result-details">
              <div className="detail-row">
                <span>Amount Paid:</span>
                <strong>₹{amount}</strong>
              </div>
              {result.data.payment_id && (
                <div className="detail-row">
                  <span>Payment ID:</span>
                  <strong>{result.data.payment_id}</strong>
                </div>
              )}
              {result.data.order_id && (
                <div className="detail-row">
                  <span>Order ID:</span>
                  <strong>{result.data.order_id}</strong>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="failure-result">
            <XCircle size={64} className="failure-icon" />
            <h2>Payment Failed</h2>
            <p>{result.error}</p>
            <button onClick={() => setResult(null)} className="retry-btn">
              Try Again
            </button>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className="mock-payment-page">
      <div className="payment-header">
        <button onClick={onClose} className="close-btn" type="button">×</button>
        <h2>Secure Payment</h2>
        <div className="amount-display">
          <span>Amount to Pay</span>
          <h1>₹{amount}</h1>
        </div>
      </div>
      
      <div className="payment-methods">
        <button
          type="button"
          className={`method-btn ${paymentMethod === 'CARD' ? 'active' : ''}`}
          onClick={() => setPaymentMethod('CARD')}
        >
          <CreditCard size={20} />
          <span>Card</span>
        </button>
        <button
          type="button"
          className={`method-btn ${paymentMethod === 'UPI' ? 'active' : ''}`}
          onClick={() => setPaymentMethod('UPI')}
        >
          <Smartphone size={20} />
          <span>UPI</span>
        </button>
        <button
          type="button"
          className={`method-btn ${paymentMethod === 'NETBANKING' ? 'active' : ''}`}
          onClick={() => setPaymentMethod('NETBANKING')}
        >
          <Building2 size={20} />
          <span>Net Banking</span>
        </button>
        <button
          type="button"
          className={`method-btn ${paymentMethod === 'WALLET' ? 'active' : ''}`}
          onClick={() => setPaymentMethod('WALLET')}
        >
          <Wallet size={20} />
          <span>Wallet</span>
        </button>
      </div>
      
      <div className="payment-content">
        <form onSubmit={handleSubmit} className="payment-form">
        {paymentMethod === 'CARD' && (
          <div className="card-form">
            <div className="test-cards-info">
              <p>🧪 <strong>Test Cards:</strong></p>
              <button type="button" onClick={() => fillTestCard('success')} className="test-btn">
                Use Success Card (4111 1111 1111 1111)
              </button>
              <button type="button" onClick={() => fillTestCard('failure')} className="test-btn">
                Use Failure Card (4111 1111 1111 0000)
              </button>
            </div>
            
            <div className="form-group">
              <label>Card Number</label>
              <input
                type="text"
                placeholder="1234 5678 9012 3456"
                value={cardData.card_number}
                onChange={(e) => handleCardChange('card_number', e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Card Holder Name</label>
              <input
                type="text"
                placeholder="John Doe"
                value={cardData.card_holder}
                onChange={(e) => handleCardChange('card_holder', e.target.value)}
                required
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Expiry Month</label>
                <input
                  type="text"
                  placeholder="MM"
                  value={cardData.expiry_month}
                  onChange={(e) => handleCardChange('expiry_month', e.target.value)}
                  maxLength="2"
                  required
                />
              </div>
              <div className="form-group">
                <label>Expiry Year</label>
                <input
                  type="text"
                  placeholder="YYYY"
                  value={cardData.expiry_year}
                  onChange={(e) => handleCardChange('expiry_year', e.target.value)}
                  maxLength="4"
                  required
                />
              </div>
              <div className="form-group">
                <label>CVV</label>
                <input
                  type="password"
                  placeholder="123"
                  value={cardData.cvv}
                  onChange={(e) => handleCardChange('cvv', e.target.value)}
                  maxLength="3"
                  required
                />
              </div>
            </div>
          </div>
        )}
        
        {paymentMethod === 'UPI' && (
          <div className="upi-form">
            <div className="test-upi-info">
              <p>🧪 <strong>Test UPIs:</strong></p>
              <p>Success: <code>success@paytm</code></p>
              <p>Failure: <code>fail@paytm</code></p>
            </div>
            
            <div className="form-group">
              <label>UPI ID</label>
              <input
                type="text"
                placeholder="yourname@paytm"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                required
              />
            </div>
          </div>
        )}
        
        {paymentMethod === 'NETBANKING' && (
          <div className="netbanking-form">
            <div className="test-upi-info">
              <p>🧪 <strong>Test Banks:</strong></p>
              <p>Success: Select <code>Test Bank - Success</code></p>
              <p>Failure: Select <code>Test Bank - Failure</code></p>
            </div>
            
            <div className="form-group">
              <label>Select Your Bank</label>
              <select 
                className="bank-select"
                value={selectedBank} 
                onChange={(e) => setSelectedBank(e.target.value)}
                required
              >
                <option value="">-- Choose your bank --</option>
                <optgroup label="🧪 Test Banks">
                  <option value="test_success">✅ Test Bank - Success</option>
                  <option value="test_failure">❌ Test Bank - Failure</option>
                </optgroup>
                <optgroup label="🏦 Popular Banks">
                  <option value="sbi">State Bank of India (SBI)</option>
                  <option value="hdfc">HDFC Bank</option>
                  <option value="icici">ICICI Bank</option>
                  <option value="axis">Axis Bank</option>
                  <option value="kotak">Kotak Mahindra Bank</option>
                  <option value="pnb">Punjab National Bank</option>
                  <option value="bob">Bank of Baroda</option>
                  <option value="canara">Canara Bank</option>
                </optgroup>
              </select>
            </div>
            
            <div className="netbanking-note">
              <p>ℹ️ You will be redirected to your bank's secure payment page</p>
            </div>
          </div>
        )}
        
        {paymentMethod === 'WALLET' && (
          <div className="wallet-form">
            <div className="test-upi-info">
              <p>🧪 <strong>Test Wallets:</strong></p>
              <p>Success: Select <code>Test Wallet - Success</code> + any 10-digit phone</p>
              <p>Failure: Select <code>Test Wallet - Failure</code> + any 10-digit phone</p>
            </div>
            
            <div className="form-group">
              <label>Select Wallet</label>
              <select 
                className="wallet-select"
                value={selectedWallet} 
                onChange={(e) => setSelectedWallet(e.target.value)}
                required
              >
                <option value="">-- Choose wallet --</option>
                <optgroup label="🧪 Test Wallets">
                  <option value="test_success">✅ Test Wallet - Success</option>
                  <option value="test_failure">❌ Test Wallet - Failure</option>
                </optgroup>
                <optgroup label="👛 Popular Wallets">
                  <option value="paytm">Paytm Wallet</option>
                  <option value="phonepe">PhonePe Wallet</option>
                  <option value="googlepay">Google Pay</option>
                  <option value="amazonpay">Amazon Pay</option>
                  <option value="mobikwik">Mobikwik</option>
                  <option value="freecharge">Freecharge</option>
                </optgroup>
              </select>
            </div>
            
            <div className="form-group">
              <label>Phone Number (linked to wallet)</label>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                value={walletPhone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 10) setWalletPhone(value);
                }}
                pattern="[0-9]{10}"
                maxLength="10"
                required
              />
            </div>
            
            <div className="wallet-note">
              <p>ℹ️ You will receive an OTP on this number for verification</p>
            </div>
          </div>
        )}
        
        <div className="security-badge">
          <Lock size={16} />
          <span>Your payment is secured with 256-bit encryption</span>
        </div>
        
        <button 
          type="submit" 
          className="pay-btn"
          disabled={processing}
        >
          {processing ? (
            <>
              <Loader className="spinner" size={20} />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Lock size={20} />
              <span>Pay ₹{amount}</span>
            </>
          )}
        </button>
      </form>
      
      <div className="mock-notice">
        <p>🔧 <strong>MOCK PAYMENT SYSTEM</strong></p>
        <p>This is a test payment gateway. No real money will be charged.</p>
      </div>
      </div>
    </div>
  );
};

export default MockPaymentPage;