# BioVision - Biometric Tracking System

![BioVision Logo](generated-icon.png)

## Overview

BioVision is an advanced biometric tracking system that enhances human-computer interaction through real-time monitoring of physiological signals using standard device cameras. The system utilizes computer vision and machine learning to track eye movements, detect heart rate, and analyze emotional states.

## Features

- **Eye Tracking**: Blink detection, gaze direction, pupil dilation monitoring
- **Heart Rate Monitoring**: Non-contact BPM estimation through facial video analysis
- **Emotion Detection**: Recognition of seven basic emotions with confidence scoring
- **Real-time Processing**: Client-side data processing for privacy and reduced latency
- **Comprehensive Analytics**: Combined analysis of all biometric signals with visualizations

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Libraries**:
  - TensorFlow.js for ML processing
  - Face-API.js for facial detection
  - Chart.js for data visualization
  - Socket.io for real-time communication
- **Backend**: Node.js, Express.js

## Architecture

BioVision employs a client-server architecture with two primary interfaces:

1. **Mobile Interface**: Captures biometric data through the device's camera
2. **Laptop Interface**: Displays comprehensive analytics and visualizations

Data flows between devices through WebSocket connections, ensuring real-time communication.

## Installation

### Prerequisites

- Node.js (v14.0.0 or higher)
- NPM (v6.0.0 or higher)
- Modern web browser with WebRTC support

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/biometric-tracker.git
   cd biometric-tracker
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open in browser:
   - Navigate to `http://localhost:3000`
   - Download ML models for offline use when prompted

## Usage

### Mobile Device

1. Select "Phone" mode from the interface
2. Grant camera permissions when prompted
3. Use "Pair with Laptop" to establish connection

### Laptop

1. Select "Laptop" mode from the interface
2. Accept pairing requests from mobile devices
3. View real-time analytics and visualizations

## Documentation

For complete documentation, please see [documentation.md](documentation.md) which includes:

- Detailed API documentation
- Implementation details
- Function descriptions
- Project architecture

## License

[MIT License](LICENSE)

## Acknowledgments

- TensorFlow.js team for the machine learning framework
- Face-API.js for the facial recognition capabilities
- All contributors who helped build this project
