Backend: Node.js Server (server.js)
Prerequisites:

Node.js environment.
Install dependencies:
bash
Copy
npm install express axios ws dotenv
Create a .env file with required environment variables:
env
Copy
PORT=3000
YOUTUBE_API_KEY=your_youtube_api_key
VIDEO_ID=your_youtube_video_id
OPENAI_API_KEY=your_openai_api_key
server.js:

js
Copy
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const WebSocket = require('ws');
const http = require('http');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const VIDEO_ID = process.env.VIDEO_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let liveChatId = null;
let commentBuffer = []; // Buffer for comments within the last 10 seconds
let connectedClients = [];

// Handle WebSocket connections
wss.on('connection', (ws) => {
connectedClients.push(ws);
ws.on('close', () => {
connectedClients = connectedClients.filter(client => client !== ws);
});
});

// Fetch liveChatId for the active stream
async function fetchLiveChatId() {
try {
const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
params: {
part: 'liveStreamingDetails',
id: VIDEO_ID,
key: YOUTUBE_API_KEY
}
});
liveChatId = response.data.items[0].liveStreamingDetails.activeLiveChatId;
} catch (error) {
console.error('Error fetching liveChatId:', error.message);
}
}

// Fetch live comments from YouTube
async function fetchLiveComments() {
if (!liveChatId) return;
try {
const response = await axios.get('https://www.googleapis.com/youtube/v3/liveChat/messages', {
params: {
liveChatId: liveChatId,
part: 'snippet,authorDetails',
key: YOUTUBE_API_KEY
}
});
const messages = response.data.items;
messages.forEach(item => {
const comment = {
id: item.id,
username: item.authorDetails.displayName,
text: item.snippet.displayMessage,
timestamp: new Date(item.snippet.publishedAt).getTime()
};
commentBuffer.push(comment);
});
// Remove comments older than 10 seconds
const tenSecondsAgo = Date.now() - 10000;
commentBuffer = commentBuffer.filter(c => c.timestamp >= tenSecondsAgo);
} catch (error) {
console.error('Error fetching live comments:', error.message);
}
}

// Call OpenAI's API to get an LLM-generated response for a comment
async function getLLMResponse(commentText) {
try {
const data = {
model: "gpt-4",
messages: [
{ role: "system", content: "You are a helpful chatbot responding to YouTube live comments." },
{ role: "user", content: commentText }
]
};
const response = await axios.post('https://api.openai.com/v1/chat/completions', data, {
headers: {
"Authorization": `Bearer ${OPENAI_API_KEY}`,
"Content-Type": "application/json"
}
});
return response.data.choices[0].message.content;
} catch (error) {
console.error('Error from LLM:', error.message);
return "I'm having trouble understanding that right now.";
}
}

// Randomly select a comment and process it with LLM every 10 seconds
async function selectRandomCommentAndRespond() {
const tenSecondsAgo = Date.now() - 10000;
commentBuffer = commentBuffer.filter(c => c.timestamp >= tenSecondsAgo);
if (commentBuffer.length === 0) {
console.log('No new comments to select');
return;
}
const randomIndex = Math.floor(Math.random() \* commentBuffer.length);
const selectedComment = commentBuffer[randomIndex];
const llmReply = await getLLMResponse(selectedComment.text);

const payload = {
selectedComment,
llmReply
};

// Broadcast the selected comment and response to all connected clients
connectedClients.forEach(client => {
if (client.readyState === WebSocket.OPEN) {
client.send(JSON.stringify(payload));
}
});
}

// Initialize processes
(async () => {
await fetchLiveChatId();
setInterval(fetchLiveComments, 5000); // Fetch comments every 5 seconds
setInterval(selectRandomCommentAndRespond, 10000); // Select and process comment every 10 seconds
})();

server.listen(process.env.PORT || 3000, () => {
console.log(`Server started on port ${server.address().port}`);
});

## Running the Backend Server

1. Ensure you have Node.js installed.
2. Navigate to the backend directory.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a `.env` file with the required environment variables:
   ```env
   PORT=3000
   YOUTUBE_API_KEY=your_youtube_api_key
   VIDEO_ID=your_youtube_video_id
   OPENAI_API_KEY=your_openai_api_key
   ```
5. Start the server:
   ```bash
   node server.js
   ```

Frontend: React Application
Prerequisites:

Create a new React app, e.g., using Create React App.
Install dependencies:
bash
Copy
npx create-react-app youtube-chatbot-ui
cd youtube-chatbot-ui
npm install
Update the WebSocket URL in the code to point to your backend server.
src/App.js:

jsx
Copy
import React, { useEffect, useState } from 'react';
import './App.css';

function App() {
const [liveComments, setLiveComments] = useState([]);
const [conversation, setConversation] = useState([]);
const [timer, setTimer] = useState(10);

useEffect(() => {
const ws = new WebSocket('ws://localhost:3000'); // Replace with your backend URL

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const { selectedComment, llmReply } = data;

      // Update live feed with the selected comment
      setLiveComments(prev => [...prev, selectedComment]);

      // Append to conversation log
      setConversation(prev => [
        ...prev,
        {
          username: selectedComment.username,
          comment: selectedComment.text,
          reply: llmReply
        }
      ]);
    };

    ws.onopen = () => console.log('WebSocket connected');
    ws.onclose = () => console.log('WebSocket connection closed');

    return () => ws.close();

}, []);

// Countdown timer logic
useEffect(() => {
const interval = setInterval(() => {
setTimer(prev => (prev === 0 ? 10 : prev - 1));
}, 1000);
return () => clearInterval(interval);
}, []);

return (
<div className="App">
<header>
<h1>YouTube Chatbot Live</h1>
<div className="countdown-timer">Next comment in: {timer}s</div>
</header>
<div className="panels">
<div className="left-panel">
<h2>YouTube Live Feed</h2>
<div className="live-feed">
{liveComments.map((comment, idx) => (
<div key={idx} className="comment">
<span className="username">{comment.username}:</span>
<span className="text">{comment.text}</span>
</div>
))}
</div>
</div>
<div className="right-panel">
<h2>Chatbot in Action</h2>
<div className="chat-panel">
{conversation.map((msg, idx) => (
<div key={idx} className="chat-message">
<div className="user-comment">
<strong>{msg.username}:</strong> {msg.comment}
</div>
<div className="bot-reply">
<strong>Chatbot:</strong> {msg.reply}
</div>
</div>
))}
</div>
</div>
</div>
</div>
);
}

export default App;
src/App.css: (Basic styles for dark mode and layout)

css
Copy
.App {
background-color: #121212;
color: #e0e0e0;
font-family: 'Roboto', sans-serif;
padding: 20px;
}
header {
text-align: center;
}
.countdown-timer {
margin-top: 10px;
font-size: 1.2em;
color: #00eaff;
}
.panels {
display: flex;
margin-top: 20px;
}
.left-panel, .right-panel {
flex: 1;
margin: 10px;
padding: 10px;
background: #1e1e1e;
border-radius: 8px;
overflow-y: auto;
max-height: 70vh;
}
h2 {
border-bottom: 2px solid #00eaff;
padding-bottom: 5px;
}
.comment, .chat-message {
margin-bottom: 10px;
}
.username {
font-weight: bold;
color: #00eaff;
}
.bot-reply {
margin-left: 20px;
color: #ff4081;
}

## Running the Frontend Application

1. Ensure you have Node.js installed.
2. Navigate to the frontend directory (e.g., `youtube-chatbot-ui`).
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the React application:
   ```bash
   npm start
   ```
5. Open your browser and navigate to `http://localhost:3000`.
