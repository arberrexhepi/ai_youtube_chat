An arbër inc project, [www.arber.design](http://www.arber.design)

### Installation Instructions

Follow these steps to install dependencies for each `package.json`:

1. **Root Directory**:

   ```bash
   npm install
   ```

2. **Frontend Directory**:

   ```bash
   cd frontend
   npm install
   ```

3. **Backend Directory**:
   ```bash
   cd backend
   npm install
   ```

### Prerequisites

For .env required variables, you will need to have the following:

1. Youtube API V3 Key
2. OAuth credentials in Google Cloud Console
3. Youtube Channel ID
4. Livestream Link
5. Livestream ID
6. Choose LLM: app supports Ollama or OPENAI

### Running The App

To run the application, you need to start both the front-end and back-end services. Ensure that ports `3000` and `4000` are available in your environment.

1. **Running Frontend**:

   ```bash
   cd frontend
   npm start
   ```

2. **Running Backend**:
   ```bash
   cd backend
   node server.js
   ```

### Considerations

Please refer to PLAN.md for AI generated insights on how you could extend the functionality of the app.
