import React, { useState, useEffect, useRef } from 'react';
import './ChatComponent.css'; // You'll need to create this

export default function ChatComponent() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);

  // API Base URL
  const API_URL = 'http://localhost:5000/api';

  // Check if API is running
  useEffect(() => {
    checkApiConnection();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const checkApiConnection = async () => {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) {
        setIsConnected(true);
        console.log('✅ Connected to API');
      }
    } catch (error) {
      setIsConnected(false);
      console.error('❌ API not connected:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (e) => {
    e.preventDefault();

    if (!input.trim()) {
      alert('Please type a message');
      return;
    }

    if (!isConnected) {
      alert('❌ API is not connected. Make sure the Python server is running on port 5000');
      return;
    }

    const userMessage = input.trim();
    setInput('');

    // Add user message to chat
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: 'user', content: userMessage }
    ]);

    setLoading(true);

    try {
      // Send to backend
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        // Add bot response
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, role: 'bot', content: data.response }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: 'bot',
            content: `❌ Error: ${data.error || 'Unknown error'}`,
          }
        ]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'bot',
          content: `❌ Failed to get response: ${error.message}`,
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const resetChat = async () => {
    try {
      await fetch(`${API_URL}/chat/reset`, {
        method: 'POST',
      });
      setMessages([]);
      console.log('✅ Chat reset');
    } catch (error) {
      console.error('Error resetting chat:', error);
    }
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <h1>🍽️ Srija's Taste - Restaurant Bot</h1>
        <div className="connection-status">
          <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="messages-area">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <h2>Welcome to Srija's Taste! 👋</h2>
            <p>I can help you with:</p>
            <ul>
              <li>🍽️ Making reservations</li>
              <li>⏰ Checking restaurant hours</li>
              <li>🍴 Browsing our menu</li>
              <li>❓ Any other questions</li>
            </ul>
            <p>Try: "Book a table for 4 people tomorrow at 7pm"</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`message message-${message.role}`}>
              <div className="message-avatar">
                {message.role === 'user' ? '👤' : '🤖'}
              </div>
              <div className="message-content">
                {message.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="message message-bot">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        <form onSubmit={sendMessage} className="chat-form">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message... (e.g., 'Book a table for 4 people')"
            disabled={loading || !isConnected}
            className="chat-input"
          />
          <button
            type="submit"
            disabled={loading || !isConnected}
            className="send-button"
          >
            {loading ? '⏳' : '📤'}
          </button>
          <button
            type="button"
            onClick={resetChat}
            disabled={loading}
            className="reset-button"
            title="Reset conversation"
          >
            🔄
          </button>
        </form>
        {!isConnected && (
          <div className="error-message">
            ❌ API not connected. Start the Python server: python app.py
          </div>
        )}
      </div>
    </div>
  );
}
