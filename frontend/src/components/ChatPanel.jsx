import React, { useState, useEffect, useRef } from 'react';

const EMOJI_DATA = {
  'Smileys': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥴','😵','🤯','🥳','🥸','😎','🤓','🧐'],
  'Gestures': ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄'],
  'Hearts': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️🔥','❤️🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','💋','💌','💐','🌹','🥀','🌷','🌸','💮','🏵️','🌻','🌼','🌺'],
  'Objects': ['🎉','🎊','🎈','🎁','🎀','🏆','🥇','🥈','🥉','⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🎱','🔮','🧿','🎮','🕹️','🎯','🎲','🧩','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🪕','🎻','💻','⌨️','🖥️','📱','📞','📷','📸','💡','🔦','🕯️','📚','📖','✏️','📝'],
  'Animals': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪲','🪳','🦟','🦗','🕷️','🦂','🐢','🐍','🦎'],
  'Food': ['🍕','🍔','🍟','🌭','🍿','🧂','🥓','🥚','🍳','🧇','🥞','🧈','🍞','🥐','🥖','🥨','🧀','🥗','🥙','🥪','🌮','🌯','🫔','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍩','🍪']
};

const CATEGORIES = Object.keys(EMOJI_DATA);

function getAvatarColor(name) {
  if (!name) return '#3b82f6';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'linear-gradient(135deg, #ef4444, #b91c1c)',
    'linear-gradient(135deg, #f59e0b, #b45309)',
    'linear-gradient(135deg, #10b981, #047857)',
    'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    'linear-gradient(135deg, #8b5cf6, #5b21b6)',
    'linear-gradient(135deg, #ec4899, #be185d)'
  ];
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPanel({ messages = [], onSend, blockedMessage, currentUser, connected = true }) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [searchEmoji, setSearchEmoji] = useState('');
  const [recentEmojis, setRecentEmojis] = useState([]);
  const [activeEmojiTab, setActiveEmojiTab] = useState(CATEGORIES[0]);
  
  const messagesEndRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmoji(false);
      }
    };
    if (showEmoji) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmoji]);

  const handleSend = () => {
    if (!text.trim()) return;
    const ok = onSend(text);
    if (ok !== false) {
      setText('');
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 80)}px`;
  };

  const addEmoji = (emoji) => {
    setText(prev => prev + emoji);
    setRecentEmojis(prev => {
      const filtered = prev.filter(e => e !== emoji);
      return [emoji, ...filtered].slice(0, 20);
    });
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const renderEmojis = () => {
    if (searchEmoji.trim()) {
      const allEmojis = Object.values(EMOJI_DATA).flat();
      return (
        <div className="emoji-picker-category">
          RESULTS
          <div className="emoji-picker-grid">
            {allEmojis.slice(0, 48).map(e => (
              <button key={e} className="emoji-item" onClick={() => addEmoji(e)}>{e}</button>
            ))}
          </div>
        </div>
      );
    }
    
    return (
      <>
        {recentEmojis.length > 0 && (
          <div className="emoji-picker-category">
            RECENT
            <div className="emoji-picker-grid">
              {recentEmojis.map(e => (
                <button key={e} className="emoji-item" onClick={() => addEmoji(e)}>{e}</button>
              ))}
            </div>
          </div>
        )}
        <div className="emoji-picker-category">
          {activeEmojiTab.toUpperCase()}
          <div className="emoji-picker-grid">
            {EMOJI_DATA[activeEmojiTab].map(e => (
              <button key={e} className="emoji-item" onClick={() => addEmoji(e)}>{e}</button>
            ))}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="chat-panel">
      {!connected && (
        <div className="panel-connection-banner">
          Reconnecting… Chat will work once the status shows connected.
        </div>
      )}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="chat-empty-text">The room is quiet.<br/>Drop the first line.</div>
          </div>
        ) : (
          messages.map(msg => {
            const isOwn = msg.senderName === currentUser;
            return (
              <div key={msg.id} className={`chat-msg ${isOwn ? 'own' : ''}`}>
                {!isOwn && (
                  <div className="chat-msg-avatar" style={{ background: getAvatarColor(msg.senderName) }}>
                    {getInitials(msg.senderName)}
                  </div>
                )}
                <div>
                  <div className="chat-msg-bubble">
                    {!isOwn && <div className="chat-msg-name">{msg.senderName}</div>}
                    <div className="chat-msg-text">{msg.text}</div>
                  </div>
                  <div className="chat-msg-time">{formatTime(msg.ts)}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {blockedMessage && (
        <div className="chat-blocked-toast">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 8v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="16" r="1" fill="currentColor"/>
          </svg>
          {blockedMessage.reason || "Message blocked — inappropriate content detected"}
        </div>
      )}

      <div className="chat-input-area">
        <button 
          className={`chat-emoji-btn ${showEmoji ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setShowEmoji(!showEmoji);
          }}
        >
          😊
        </button>
        
        {showEmoji && (
          <div className="emoji-picker" ref={emojiPickerRef}>
            <div className="emoji-picker-search">
              <input 
                type="text" 
                placeholder="Search emojis..." 
                value={searchEmoji}
                onChange={e => setSearchEmoji(e.target.value)}
              />
            </div>
            <div className="emoji-picker-tabs">
              {CATEGORIES.map(cat => (
                <button 
                  key={cat} 
                  className={`emoji-picker-tab ${activeEmojiTab === cat ? 'active' : ''}`}
                  onClick={() => setActiveEmojiTab(cat)}
                  title={cat}
                >
                  {EMOJI_DATA[cat][0]}
                </button>
              ))}
            </div>
            <div className="emoji-picker-content">
              {renderEmojis()}
            </div>
          </div>
        )}

        <div className="chat-input-wrapper">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Type a message..."
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
          />
        </div>
        
        <button 
          className="chat-send-btn" 
          disabled={!text.trim() || !connected} 
          onClick={handleSend}
          title={connected ? "Send" : "Waiting for connection"}
        >
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
