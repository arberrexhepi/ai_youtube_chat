import React from 'react';

const ChatPanel = ({ conversation }) => {
  console.log('Rendering ChatPanel with conversation:', conversation);
  return (
    <div className="chat-panel">
      <h2>Chatbot in Action</h2>
      {conversation.map((msg, index) => (
        <div key={index} className={`message ${msg.sender}`}>
          <span>{msg.text}</span>
        </div>
      ))}
    </div>
  );
};

export default ChatPanel;