import React, { useState, useEffect, useRef } from "react";
import "./index.css";

const App = () => {
  const [messages, setMessages] = useState([]); // To manage chat messages
  const [milestoneProgress, setMilestoneProgress] = useState({
    subscribers: 350, // Example starting count
    goal: 1000, // Partnership goal
  });
  const chatPanelRef = useRef(null);

  // WebSocket logic for real-time updates (user comments, LLM responses, and subscriber count)
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:5000");

    ws.onopen = () => {
      console.log("WebSocket connection established");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "comment") {
        setMessages((prevMessages) => [
          ...prevMessages,
          ...data.comments.map((comment) => ({
            ...comment,
            type: "comment",
          })),
        ]);
      } else if (data.type === "llm-response") {
        setMessages((prevMessages) => [
          ...prevMessages,
          { username: "Chatbot", text: data.response, type: "llm-response" },
        ]);
      } else if (data.type === "subscriber-count") {
        setMilestoneProgress((prev) => ({
          ...prev,
          subscribers: data.count,
        }));
      }
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      ws.close();
    };
  }, []);

  // Auto-scroll to the latest message in the chat panel
  useEffect(() => {
    if (chatPanelRef.current) {
      chatPanelRef.current.scrollTop = chatPanelRef.current.scrollHeight;
    }
  }, [messages]);

  // Event handlers for engagement actions
  const handleSubscribe = () => {
    alert("Thank you for subscribing! 🎉");
    setMilestoneProgress((prev) => ({
      ...prev,
      subscribers: prev.subscribers + 1, // Increment subscriber count
    }));
  };

  const handleShare = () => {
    alert("Share the chat with your friends to help us grow!");
  };

  return (
    <div className="App">

    
      {/* Milestone Tracker */}
      <div className="milestone-tracker">
        <p>
          <strong>{milestoneProgress.subscribers}</strong> /
          <strong>{milestoneProgress.goal}</strong> Subscribers. 
        </p>
        <div className="progress-bar">
 
          <div
            className="progress"
            style={{
              width: `${
                (milestoneProgress.subscribers / milestoneProgress.goal) * 100
              }%`,
            }}
          ></div>
        </div>
                {/* Engagement Callout */}
                <div className="chat-message callout">
          <p>
            ❤️ Enjoying the discussion? Don’t forget to <strong>Like</strong>,{" "}
            <strong>Subscribe</strong>, and <strong>Share</strong>!
          </p>
    
        </div>
      </div>
      {/* Header */}
      <header>
        <h1>AI Youtube Group Chat</h1>
        <small>Comment on the video, and the AI will respond!
        </small><small> Powered by aiam.agency </small>
      </header>

      {/* Chat Panel */}
      <div className="chat-panel" ref={chatPanelRef}>
        {messages.map((message, idx) => (
          <div key={idx} className={`chat-message ${message.type}`}>
            <div className="user-comment">
              <strong className="username">
                {message.type === "comment" ? message.username : "Chatbot"}:
              </strong>{" "}
              {message.text}
            </div>
          </div>
        ))}


      </div>
    </div>
  );
};

export default App;