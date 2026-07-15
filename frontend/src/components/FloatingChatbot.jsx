import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './FloatingChatbot.css';

export default function FloatingChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [thinkingMessage, setThinkingMessage] = useState('Hold on...');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Show welcome message when chat opens
    useEffect(() => {
      if (isOpen && messages.length === 0) {
        setMessages([
          {
            role: 'bot',
            content: 'Welcome to Srija\'s Taste! 🍽️ How can I help you today? I can help you book a table, check our menu, or answer any questions.'
          }
        ]);
      }
    }, [isOpen]);
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
  if (!loading) return;

  const thinkingMessages = [
    'Hold on...',
    'Working...',
    'Processing your request...',
    'Thinking...',
    'Almost there...'
  ];

  let messageIndex = 0;
  
  const interval = setInterval(() => {
    messageIndex = (messageIndex + 1) % thinkingMessages.length;
    setThinkingMessage(thinkingMessages[messageIndex]);
  }, 3000);

  return () => clearInterval(interval);
}, [loading]);

  const handleSend = async () => {
  if (!input.trim()) return;

  const userMessage = input;
  setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
  setInput('');

  // Check if it's a greeting
  const greetings = ['hi', 'hello', 'hey', 'what\'s up', 'how are you', 'thanks', 'bye', 'goodbye'];
  const isGreeting = greetings.some(g => userMessage.toLowerCase().includes(g));

  // Instant reply for greetings - don't call API
  if (isGreeting) {
    const greetingResponses = [
      "Hey! 👋 How can I help you today?",
      "Hi there! What can I do for you?",
      "Hello! 😊 What would you like?",
      "Hey! Ready to help! 🍽️"
    ];
    const randomGreeting = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
    setMessages(prev => [...prev, { role: 'bot', content: randomGreeting }]);
    return; // Don't call API
  }

  setLoading(true);

  try {
    const response = await fetch('http://localhost:5000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage })
    });

    const data = await response.json();
    
    if (data.success) {
      setMessages(prev => [...prev, { role: 'bot', content: data.response }]);
    }

    if (data.is_returning_customer) {
      setCustomer(data);
    }
        
  } catch (error) {
    console.error('Error:', error);
    setMessages(prev => [...prev, { role: 'bot', content: 'Connection error. Please try again.' }]);
  } finally {
    setLoading(false);
  }
};
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return createPortal(
    <div className="floating-chatbot">
      {/* Chat Bubble Button */}
      {!isOpen && (
        <button 
          className="chat-bubble"
          onClick={() => setIsOpen(true)}
          title="Open Chat"
        >
          💬
        </button>
      )}

      {/* Chat Widget */}
      {isOpen && (
        <div className="chat-widget">
          {/* Header */}
          <div className="chat-header">
            <div className="header-content">
              <h3>Srija's Taste 🍽️</h3>
              <span className="status">Online</span>
            </div>
            <button 
              className="close-btn"
              onClick={() => setIsOpen(false)}
              title="Close Chat"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}>
                <div className="message-content">
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Show question cards ONLY for returning customers */}
            {customer && messages.length >= 1 && (
              <div className="question-cards">
                <button className="question-card" onClick={() => setInput('Book my favorite corner table')}>
                  <span className="q-icon">💺</span>
                  <span className="q-text">Book your favorite table?</span>
                </button>
                <button className="question-card" onClick={() => setInput('Order Pasta Carbonara')}>
                  <span className="q-icon">🍽️</span>
                  <span className="q-text">Order your favorite dish?</span>
                </button>
                <button className="question-card" onClick={() => setInput('Book at 9pm')}>
                  <span className="q-icon">⏰</span>
                  <span className="q-text">Book at your favorite time?</span>
                </button>
              </div>
            )}

            {loading && (
            <div className="message bot">
              <div className="message-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>
                    {[
                      "Thinking...",
                      "Let me check...",
                      "One moment...",
                      "Processing your request...",
                      "Analyzing your request...",
                      "Preparing response...",
                      "Hold on..."
                    ][Math.floor(Math.random() * 10)]}
                  </span>
                  <span className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                </div>
              </div>
            </div>
          )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="chat-input-area">
            <input
              type="text"
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />
            <button 
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="send-btn"
            >
              Send
            </button>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions">
            <button onClick={() => setInput('Book a table')}>📅 Book Table</button>
            <button onClick={() => setInput('Show me the menu')}>🍽️ Menu</button>
            <button onClick={() => setInput('What are your hours?')}>⏰ Hours</button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
