import { Bot, Paperclip, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Button from '../../components/elements/Button';
import Input from '../../components/elements/InputField';
import { MoreDotIcon, PaperPlaneIcon } from '../../components/icons';

const Chat = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: 'Hello! I\'m your AI assistant. How can I help you today?',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
    },
    {
      id: 2,
      type: 'user',
      content: 'Hi there! I need help with my project.',
      timestamp: new Date(Date.now() - 3 * 60 * 1000),
    },
    {
      id: 3,
      type: 'bot',
      content: 'I\'d be happy to help you with your project! Could you please provide more details about what you\'re working on and what specific assistance you need?',
      timestamp: new Date(Date.now() - 2 * 60 * 1000),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newUserMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newUserMessage]);
    setInputMessage('');
    setIsTyping(true);

  try {
  const response = await fetch('http://localhost:5000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: inputMessage,
    }),
  });

  const data = await response.json();

  const botResponse = {
    id: Date.now() + 1,
    type: 'bot',
    content: data.response,
    timestamp: new Date(),
  };

  setMessages(prev => [...prev, botResponse]);

} catch (error) {
  console.error(error);

  const errorMessage = {
    id: Date.now() + 1,
    type: 'bot',
    content: '❌ Failed to connect to backend',
    timestamp: new Date(),
  };

  setMessages(prev => [...prev, errorMessage]);

} finally {
  setIsTyping(false);
}
  };

  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const MessageBubble = ({ message }) => {
    const isBot = message.type === 'bot';
    
    return (
      <div className={`flex gap-3 ${isBot ? 'justify-start' : 'justify-end'} mb-4`}>
        {isBot && (
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            </div>
          </div>
        )}
        
        <div className={`flex flex-col max-w-[70%] ${!isBot ? 'items-end' : 'items-start'}`}>
          <div
            className={`px-4 py-3 rounded-2xl text-sm ${
              isBot
                ? 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white/90'
                : 'bg-brand-500 text-white'
            }`}
          >
            <p className="leading-relaxed">{message.content}</p>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-1">
            {formatTime(message.timestamp)}
          </span>
        </div>
        
        {!isBot && (
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        )}
      </div>
    );
  };

  const TypingIndicator = () => (
    <div className="flex gap-3 justify-start mb-4">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center">
          <Bot className="w-4 h-4 text-brand-600 dark:text-brand-400" />
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-2xl">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">AI Assistant</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Online</p>
          </div>
        </div>
        <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <MoreDotIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 rounded-b-xl">
        <form onSubmit={handleSendMessage} className="flex items-end gap-3">
          <div className="flex-1">
            <div className="relative">
              <Input
                ref={inputRef}
                type="text"
                placeholder="Type your message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="pr-12 resize-none"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <Paperclip className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>
          <Button
            type="submit"
            disabled={!inputMessage.trim()}
            className="!px-4 !py-3 flex-shrink-0"
            startIcon={<PaperPlaneIcon className="w-4 h-4" />}
          >
            Send
          </Button>
        </form>
        
        {/* Quick Actions */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">Quick actions:</span>
          <button className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            Help me with...
          </button>
          <button className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            Explain
          </button>
          <button className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            Generate
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
