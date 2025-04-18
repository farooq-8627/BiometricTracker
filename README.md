# Eye Tracking & Heart Rate Monitoring System

A real-time biometric tracking system that monitors eye movements and heart rate. The application includes two interfaces:

1. **Mobile Interface** - For data collection (eye tracking and heart rate)
2. **Laptop Interface** - For data visualization and analysis

## Features

- Real-time eye tracking using face-api.js
- Heart rate monitoring using video processing
- Real-time communication between paired devices
- Data visualization using Chart.js
- Biofeedback system

## Technologies

- Node.js
- Express
- Socket.io
- WebSocket
- TensorFlow.js
- Face-api.js
- Chart.js

## Deployment Options

### Vercel (HTTPS without WebSocket support)

You can deploy this application to Vercel for free HTTPS hosting, but WebSockets (used for real-time communication) are not supported in Vercel's serverless environment. The application may still work for demos, but without real-time functionality.

Follow these steps:
1. Go to https://vercel.com 
2. Sign up or log in with GitHub
3. Import your repository
4. Deploy with default settings

### Railway.app or Heroku (Full HTTPS with WebSocket support)

For full functionality including WebSockets:

#### Railway.app
1. Sign up at https://railway.app
2. Connect your GitHub repository
3. Add a new service using your repository
4. Railway automatically detects Node.js apps and deploys them
5. Your app will be available at a https://your-app-name.up.railway.app domain

#### Heroku
1. Sign up at https://www.heroku.com
2. Create a new app
3. Connect your GitHub repository
4. Deploy the app
5. Your app will be available at https://your-app-name.herokuapp.com

### Local Testing with ngrok (Temporary HTTPS)

For temporary HTTPS during development:
1. Run your app locally: `npm start`
2. Install ngrok: `npm install -g ngrok`
3. Tunnel to your local port: `ngrok http 5000`
4. Use the HTTPS URL provided by ngrok
