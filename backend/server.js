require("dotenv").config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const axios = require("axios");
const sanitizeHtml = require("sanitize-html");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());

wss.on("connection", (ws) => {
  console.log("Client connected");
  ws.on("close", () => {
    console.log("Client disconnected");
  });
  // Handle WebSocket connection
});

let nextPageToken = "";
let liveChatId = "";

// Function to extract video ID from YouTube URL
const extractVideoId = (url) => {
  const urlObj = new URL(url);
  return urlObj.searchParams.get("v");
};

// Function to get live chat ID from YouTube video ID
const getLiveChatId = async (videoId) => {
  try {
    const response = await axios.get(
      "https://www.googleapis.com/youtube/v3/videos",
      {
        params: {
          part: "liveStreamingDetails",
          id: videoId,
          key: process.env.YOUTUBE_API_KEY,
        },
        headers: {
          Referer: "http://localhost:5000",
        },
      }
    );
    const liveStreamingDetails = response.data.items[0].liveStreamingDetails;
    console.log("Live Streaming Details:", liveStreamingDetails);
    return liveStreamingDetails.activeLiveChatId;
  } catch (error) {
    console.error(
      "Error fetching live chat ID:",
      error.response ? error.response.data : error.message
    );
    return null;
  }
};

const fetchLiveComments = async () => {
  console.log("Fetching live comments...");
  if (!liveChatId) {
    console.error("Live chat ID is not set");
    return;
  }
  try {
    const response = await axios.get(
      "https://www.googleapis.com/youtube/v3/liveChat/messages",
      {
        params: {
          liveChatId: liveChatId,
          part: "snippet,authorDetails",
          key: process.env.YOUTUBE_API_KEY,
          pageToken: nextPageToken,
        },
        headers: {
          Referer: "http://localhost:5000",
        },
      }
    );
    const comments = response.data.items.map((item) => ({
      username: item.authorDetails.displayName,
      text: sanitizeHtml(item.snippet.displayMessage), // Sanitize user comment
    }));
    nextPageToken = response.data.nextPageToken || "";
    console.log("Fetched comments:", comments);

    // Broadcast comments to clients
    console.log(
      "Broadcasting comments to clients. Number of clients:",
      wss.clients.size
    );
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        console.log("Sending comment message to client");
        client.send(JSON.stringify({ type: "comment", comments }), (err) => {
          if (err) {
            console.error("Error sending comment message:", err);
          } else {
            console.log("Comment message sent successfully");
          }
        });
      } else {
        console.log("Client not open, skipping");
      }
    });

    // Check if there are no comments
    if (comments.length === 0) {
      console.log("No comments to process");
      return;
    }

    // Build a formatted string for the LLM
    const formattedString = comments
      .map((comment) => `${comment.username}: ${comment.text}`)
      .join("\n");
    console.log(`Sending formatted string to LLM: ${formattedString}`);
    const llmResponse = await handleLLMResponse(formattedString);
    console.log(`Received LLM response: ${llmResponse}`);

    // Broadcast the LLM response to clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "llm-response",
            response: llmResponse,
          })
        );
      }
    });
  } catch (error) {
    console.error(
      "Error fetching comments:",
      error.response ? error.response.data : error.message
    );
  }
};

// Function to fetch subscriber count
const fetchSubscriberCount = async () => {
  try {
    const response = await axios.get(
      "https://www.googleapis.com/youtube/v3/channels",
      {
        params: {
          part: "statistics",
          id: process.env.YOUTUBE_CHANNEL_ID,
          key: process.env.YOUTUBE_API_KEY,
        },
        headers: {
          Referer: "http://localhost:5000", // Add your server's referer
        },
      }
    );
    const subscriberCount = response.data.items[0].statistics.subscriberCount;
    console.log("Fetched subscriber count:", subscriberCount);

    // Broadcast subscriber count to clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "subscriber-count",
            count: subscriberCount,
          })
        );
      }
    });
  } catch (error) {
    console.error(
      "Error fetching subscriber count:",
      error.response ? error.response.data : error.message
    );
  }
};

// Fetch live comments every 15 seconds
setInterval(fetchLiveComments, 15000);

// Fetch subscriber count every minute
setInterval(fetchSubscriberCount, 60000);

// Set YouTube link and fetch live chat ID from environment variable
const youtubeLink = process.env.YOUTUBE_LINK;
console.log("YouTube Link from .env:", youtubeLink);
const videoId = extractVideoId(youtubeLink);
console.log("Extracted Video ID:", videoId);
getLiveChatId(videoId).then((id) => {
  liveChatId = id;
  console.log("Fetched Live Chat ID:", liveChatId);
});

// Endpoint to fetch live comments
app.get("/api/comments", async (req, res) => {
  console.log("GET /api/comments");
  try {
    const response = await axios.get(
      "https://www.googleapis.com/youtube/v3/liveChat/messages",
      {
        params: {
          liveChatId: liveChatId,
          part: "snippet,authorDetails",
          key: process.env.YOUTUBE_API_KEY,
          pageToken: nextPageToken,
        },
        headers: {
          Referer: "http://localhost:5000",
        },
      }
    );
    nextPageToken = response.data.nextPageToken || "";
    console.log("Fetched comments:", response.data.items);
    res.json(response.data.items);
  } catch (error) {
    console.error(
      "Error fetching comments:",
      error.response ? error.response.data : error.message
    );
    res.status(500).send("Error fetching comments");
  }
});

// Endpoint to handle YouTube search queries
app.post("/api/search", async (req, res) => {
  const { query } = req.body;
  console.log("POST /api/search", query);
  try {
    const response = await axios.get(
      "https://www.googleapis.com/youtube/v3/search",
      {
        params: {
          part: "snippet",
          q: query,
          key: process.env.YOUTUBE_API_KEY,
        },
        headers: {
          Referer: "http://localhost:5000",
        },
      }
    );
    console.log("Fetched search results:", response.data.items);
    res.json(response.data.items);
  } catch (error) {
    console.error(
      "Error fetching YouTube data:",
      error.response ? error.response.data : error.message
    );
    res.status(500).send("Error fetching YouTube data");
  }
});

// Function to handle LLM response
const handleLLMResponse = async (comment) => {
  console.log("Handling LLM response for comment:", comment);
  const llmModel = process.env.LLM_MODEL;
  if (llmModel === "openai") {
    return handleOpenAIResponse(comment);
  } else if (llmModel === "llama3.2:latest") {
    return handleLLaMAResponse(comment);
  } else {
    console.error("Unsupported LLM model:", llmModel);
    return "Unsupported LLM model";
  }
};

// Function to handle OpenAI response
const handleOpenAIResponse = async (comment) => {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a helpful chatbot." },
          { role: "user", content: comment },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.LLM_API_KEY}`,
        },
      }
    );
    console.log("OpenAI response:", response.data.choices[0].message.content);
    const chatResponse = sanitizeHtml(
      response.data.choices[0].message.content,
      { allowedTags: [], allowedAttributes: {} }
    );
    const cleanedResponse = chatResponse.replace(/data:[^ \n]+/g, "");
    return cleanedResponse;
  } catch (error) {
    console.error(
      "Error handling OpenAI response:",
      error.response ? error.response.data : error.message
    );
    return "Sorry, I am unable to respond at the moment.";
  }
};

// Function to handle LLaMA response
const handleLLaMAResponse = async (comment) => {
  try {
    const response = await axios.post(
      "http://127.0.0.1:11434/api/chat",
      {
        model: "llama3.2:latest",
        messages: [
          { role: "system", content: "You are a helpful chatbot." },
          { role: "user", content: comment },
        ],
        num_ctx: 500,
        stream: false,
        format: {
          type: "object",
          properties: {
            response: {
              type: "string",
            },
          },
          required: ["response"],
        },
        num_ctx: 300,
        repeat_penalty: 1.1,
        temperature: 1.1,
        keep_alive: "1s",
        top_k: 40,
        num_predict: 128,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Connection: "close",
        },
      }
    );

    let messageData = response.data;
    if (
      messageData &&
      messageData.message &&
      messageData.message.role === "assistant"
    ) {
      messageData = JSON.parse(messageData.message.content);
      if (messageData.response) {
        messageData = messageData.response;
      }
    }

    console.log("LLaMA response:", messageData);
    return messageData;
  } catch (error) {
    console.error(
      "Error handling LLaMA response:",
      error.response ? error.response.data : error.message
    );
    return "Sorry, I am unable to respond at the moment.";
  }
};

server.listen(5000, () => {
  console.log("Server is running on port 5000");
});
