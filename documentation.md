# BioVision - Biometric Tracking System Documentation

## Project Overview

BioVision is an advanced biometric tracking system designed to enhance human-computer interaction through real-time monitoring of physiological and behavioral signals. The system utilizes computer vision techniques and machine learning to track and analyze eye movements, heart rate, and emotional states, providing valuable insights for user experience optimization, health monitoring, and attention analysis.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Technologies Used](#technologies-used)
3. [Core Features](#core-features)
4. [Implementation Details](#implementation-details)
   - [Face Detection and Tracking](#face-detection-and-tracking)
   - [Eye Tracking System](#eye-tracking-system)
   - [Heart Rate Monitoring](#heart-rate-monitoring)
   - [Emotion Detection](#emotion-detection)
   - [Data Visualization](#data-visualization)
   - [Real-time Communication](#real-time-communication)
5. [API Documentation](#api-documentation)
6. [Future Enhancements](#future-enhancements)
7. [Installation and Setup](#installation-and-setup)
8. [Conclusion](#conclusion)

## System Architecture

BioVision employs a client-server architecture with two primary interfaces:

1. **Mobile Interface**: Captures real-time biometric data through the device's camera, processes preliminary data locally, and transmits the results to the laptop interface.

2. **Laptop Interface (Analytics Dashboard)**: Receives data from the mobile interface, conducts advanced analysis, and presents comprehensive visualizations and metrics through an interactive dashboard.

The system architecture facilitates seamless data flow between the devices through WebSocket connections, ensuring real-time communication and synchronization.

### Data Flow Diagram

```
[Mobile Device] → Camera Feed → Face API Processing → Socket.io → [Laptop/Server]
                                                                      ↓
                                                             Data Processing Engine
                                                                      ↓
                                                             Analytics Dashboard
```

## Technologies Used

- **Frontend Technologies**:

  - HTML5, CSS3, JavaScript (ES6+)
  - Chart.js for data visualization
  - TensorFlow.js for client-side ML processing
  - Face-API.js for facial feature detection and analysis

- **Backend Technologies**:

  - Node.js
  - Express.js (RESTful API framework)
  - Socket.io (real-time bidirectional communication)

- **Machine Learning**:

  - TensorFlow.js
  - Face-API.js (built on TensorFlow.js)
  - Custom emotion detection models

- **Data Visualization**:
  - Chart.js
  - Chart.js Annotation plugin

## Core Features

### 1. Eye Tracking

The eye tracking system monitors various eye-related metrics:

- Blink detection and rate analysis
- Gaze direction tracking
- Pupil dilation monitoring
- Eye movement patterns

### 2. Heart Rate Monitoring

Non-contact heart rate detection through facial video analysis:

- Real-time BPM (beats per minute) calculation
- Heart rate variability analysis
- Trend visualization over time

### 3. Emotion Detection

Advanced facial expression analysis for emotion recognition:

- Detection of seven basic emotions (happy, sad, angry, surprise, fear, disgust, neutral)
- Confidence scoring for detected emotions
- Emotion trends over time

### 4. Real-time Data Processing

- Client-side processing for privacy and reduced latency
- Optimized algorithms for mobile performance
- Device pairing for synchronized analysis

### 5. Comprehensive Analytics Dashboard

- Combined analysis of all biometric signals
- Attention and stress level estimation
- Historical data comparison
- Customizable visualization options

## Implementation Details

### Face Detection and Tracking

The system uses Face-API.js, a JavaScript module built on TensorFlow.js, to detect and track facial landmarks in real-time video streams.

```javascript
// Key function: initializeFaceApi
async function initializeFaceApi() {
	try {
		// Load required models
		await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
		await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
		await faceapi.nets.faceExpressionNet.loadFromUri("/models");

		console.log("Face API models loaded successfully");
		return true;
	} catch (error) {
		console.error("Error loading Face API models:", error);
		return false;
	}
}
```

### Eye Tracking System

The eye tracking module extracts detailed information about eye states and movements from facial landmarks.

#### Key Functions:

```javascript
// Extract eye landmarks from face detection results
function getEyeLandmarks(detection) {
	if (!detection || !detection.landmarks) return null;

	const landmarks = detection.landmarks || detection.landmarks.positions;
	const leftEye = landmarks.getLeftEye();
	const rightEye = landmarks.getRightEye();

	return { leftEye, rightEye };
}

// Calculate eye aspect ratio to detect blinks
function calculateEAR(eye) {
	// Vertical eye landmarks
	const p2_p6 = distance(eye[1], eye[5]);
	const p3_p5 = distance(eye[2], eye[4]);

	// Horizontal eye landmarks
	const p1_p4 = distance(eye[0], eye[3]);

	// Eye aspect ratio
	return (p2_p6 + p3_p5) / (2.0 * p1_p4);
}

// Detect blink events using the eye aspect ratio
function detectBlink(leftEAR, rightEAR, threshold = 0.2) {
	const avgEAR = (leftEAR + rightEAR) / 2.0;
	return avgEAR < threshold;
}

// Track gaze direction based on pupil position relative to eye corners
function trackGazeDirection(eye) {
	const eyeWidth = distance(eye[0], eye[3]);
	const pupilX = (eye[1].x + eye[2].x + eye[4].x + eye[5].x) / 4;
	const eyeCenterX = (eye[0].x + eye[3].x) / 2;

	// Normalized gaze position (-1 to 1, where 0 is center)
	const gazeX = (pupilX - eyeCenterX) / (eyeWidth / 2);

	return gazeX;
}
```

### Heart Rate Monitoring

Heart rate detection is implemented using remote photoplethysmography (rPPG), which analyzes subtle color changes in facial regions of interest.

#### Key Functions:

```javascript
// Initialize heart rate detection
function initHeartRateDetection(videoElement, faceDetection) {
	// Select region of interest (forehead and cheeks)
	const roi = extractROI(faceDetection);
	heartRateTracker.addFrame(roi);
}

// Extract the region of interest for heart rate analysis
function extractROI(faceDetection) {
	const landmarks = faceDetection.landmarks;
	const boundingBox = faceDetection.detection.box;

	// Define forehead region
	const foreheadY = landmarks.positions[21].y - boundingBox.height * 0.1;
	const foreheadHeight = boundingBox.height * 0.15;

	return {
		forehead: {
			x: boundingBox.x,
			y: foreheadY,
			width: boundingBox.width,
			height: foreheadHeight,
		},
		leftCheek: extractCheekROI(landmarks, "left"),
		rightCheek: extractCheekROI(landmarks, "right"),
	};
}

// Process frames to extract color signals
function processColorSignals(imageData) {
	// Extract RGB channels from the region of interest
	const redChannel = [];
	const greenChannel = [];
	const blueChannel = [];

	// Process each pixel in the ROI
	for (let i = 0; i < imageData.data.length; i += 4) {
		redChannel.push(imageData.data[i]);
		greenChannel.push(imageData.data[i + 1]);
		blueChannel.push(imageData.data[i + 2]);
	}

	// Calculate average RGB values
	const avgRed = redChannel.reduce((a, b) => a + b, 0) / redChannel.length;
	const avgGreen =
		greenChannel.reduce((a, b) => a + b, 0) / greenChannel.length;
	const avgBlue = blueChannel.reduce((a, b) => a + b, 0) / blueChannel.length;

	return { red: avgRed, green: avgGreen, blue: avgBlue };
}

// Calculate heart rate from color signals
function calculateHeartRate(signals) {
	// Apply bandpass filter (0.7-4Hz, corresponding to 42-240 BPM)
	const filteredSignal = applyBandpassFilter(signals.green, 0.7, 4.0, 30);

	// Find peaks in the filtered signal
	const peaks = findPeaks(filteredSignal, 0.3);

	// Calculate heart rate from peak intervals
	const heartRate = calculateRateFromPeaks(peaks, 30);

	return heartRate;
}
```

### Emotion Detection

The emotion detection module leverages the pre-trained facial expression recognition model from Face-API.js and enhances it with custom processing.

#### Key Functions:

```javascript
// Detect emotions from face detection results
function detectEmotions(detection) {
	if (!detection || !detection.expressions) return null;

	const expressions = detection.expressions;

	// Find the dominant emotion
	let dominantEmotion = "neutral";
	let maxScore = expressions.neutral;

	for (const [emotion, score] of Object.entries(expressions)) {
		if (score > maxScore) {
			maxScore = score;
			dominantEmotion = emotion;
		}
	}

	return {
		dominant: dominantEmotion,
		confidence: maxScore,
		all: expressions,
	};
}

// Track emotion changes over time
function trackEmotionChanges(emotionHistory, timeWindow = 10) {
	// Calculate emotion stability
	const dominantEmotions = emotionHistory
		.slice(-timeWindow)
		.map((entry) => entry.dominant);

	// Count occurrences of each emotion
	const counts = dominantEmotions.reduce((acc, emotion) => {
		acc[emotion] = (acc[emotion] || 0) + 1;
		return acc;
	}, {});

	// Calculate emotion stability as the ratio of the most frequent emotion
	const mostFrequent = Math.max(...Object.values(counts));
	const stability = mostFrequent / timeWindow;

	return { stability, counts };
}

// Analyze emotional state based on patterns
function analyzeEmotionalState(emotionHistory, heartRateHistory) {
	const recentEmotions = emotionHistory.slice(-20);
	const recentHeartRates = heartRateHistory.slice(-20);

	// Calculate emotional arousal (intensity)
	const arousal = calculateArousal(recentEmotions, recentHeartRates);

	// Calculate emotional valence (positive/negative)
	const valence = calculateValence(recentEmotions);

	return { arousal, valence };
}
```

### Data Visualization

The system uses Chart.js to create interactive, real-time visualizations of biometric data.

#### Key Functions:

```javascript
// Create eye movement chart
function createEyeMovementChart(canvasId) {
	const ctx = document.getElementById(canvasId).getContext("2d");

	return new Chart(ctx, {
		type: "line",
		data: {
			labels: Array(60).fill(""),
			datasets: [
				{
					label: "Eye Movement (X-axis)",
					data: Array(60).fill(0),
					borderColor: "rgba(75, 192, 192, 1)",
					tension: 0.4,
					fill: false,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				y: {
					min: -1,
					max: 1,
					title: {
						display: true,
						text: "Left <-> Right",
					},
				},
			},
			animation: {
				duration: 0,
			},
		},
	});
}

// Create heart rate chart
function createHeartRateChart(canvasId) {
	const ctx = document.getElementById(canvasId).getContext("2d");

	return new Chart(ctx, {
		type: "line",
		data: {
			labels: Array(60).fill(""),
			datasets: [
				{
					label: "Heart Rate (BPM)",
					data: Array(60).fill(0),
					borderColor: "rgba(255, 99, 132, 1)",
					tension: 0.1,
					fill: false,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				y: {
					min: 50,
					max: 120,
					title: {
						display: true,
						text: "BPM",
					},
				},
			},
			animation: {
				duration: 0,
			},
			plugins: {
				annotation: {
					annotations: {
						thresholdHigh: {
							type: "line",
							yMin: 100,
							yMax: 100,
							borderColor: "rgba(255, 0, 0, 0.5)",
							borderWidth: 1,
						},
						thresholdLow: {
							type: "line",
							yMin: 60,
							yMax: 60,
							borderColor: "rgba(0, 0, 255, 0.5)",
							borderWidth: 1,
						},
					},
				},
			},
		},
	});
}

// Create emotion chart
function createEmotionChart(canvasId) {
	const ctx = document.getElementById(canvasId).getContext("2d");

	return new Chart(ctx, {
		type: "radar",
		data: {
			labels: [
				"Happy",
				"Sad",
				"Angry",
				"Surprised",
				"Fearful",
				"Disgusted",
				"Neutral",
			],
			datasets: [
				{
					label: "Emotion Confidence",
					data: [0, 0, 0, 0, 0, 0, 0],
					backgroundColor: "rgba(106, 90, 205, 0.2)",
					borderColor: "rgba(106, 90, 205, 1)",
					pointBackgroundColor: "rgba(106, 90, 205, 1)",
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			scale: {
				ticks: {
					beginAtZero: true,
					max: 1,
				},
			},
		},
	});
}

// Update charts with new data
function updateCharts(data) {
	// Update eye movement chart
	eyeMovementChart.data.datasets[0].data.shift();
	eyeMovementChart.data.datasets[0].data.push(data.eyeMovement.x);
	eyeMovementChart.update();

	// Update heart rate chart
	heartRateChart.data.datasets[0].data.shift();
	heartRateChart.data.datasets[0].data.push(data.heartRate);
	heartRateChart.update();

	// Update emotion chart
	const emotions = data.emotions.all;
	emotionChart.data.datasets[0].data = [
		emotions.happy,
		emotions.sad,
		emotions.angry,
		emotions.surprised,
		emotions.fearful,
		emotions.disgusted,
		emotions.neutral,
	];
	emotionChart.update();
}
```

### Real-time Communication

The system uses Socket.io to handle real-time bidirectional communication between mobile and laptop interfaces.

#### Key Functions:

```javascript
// Initialize web socket connection (mobile)
function initializeWebSocket(deviceType = "mobile") {
	socket = io();

	socket.on("connect", () => {
		console.log("Connected to server with ID:", socket.id);
		updateConnectionStatus(true);

		// Register device type
		socket.emit("registerDevice", {
			type: deviceType,
			id: socket.id,
			name: generateDeviceName(deviceType),
		});
	});

	socket.on("disconnect", () => {
		console.log("Disconnected from server");
		updateConnectionStatus(false);
	});

	// Handle device pairing
	socket.on("availableDevices", (devices) => {
		updateAvailableDevicesList(devices);
	});

	socket.on("pairingRequest", (data) => {
		handlePairingRequest(data);
	});

	socket.on("pairingConfirmed", (data) => {
		handlePairingConfirmed(data);
	});

	// Handle biometric data
	socket.on("biometricData", (data) => {
		processBiometricData(data);
	});

	socket.on("feedback", (data) => {
		displayFeedback(data);
	});

	return socket;
}

// Send biometric data to paired device
function sendBiometricData(data) {
	if (socket && socket.connected && pairedDeviceId) {
		socket.emit("biometricData", {
			targetId: pairedDeviceId,
			data: data,
		});
	}
}

// Send feedback to mobile device
function sendFeedback(message, type) {
	if (socket && socket.connected && pairedDeviceId) {
		socket.emit("feedback", {
			targetId: pairedDeviceId,
			message: message,
			type: type,
		});
	}
}

// Request pairing with device
function requestPairing(targetId) {
	if (socket && socket.connected) {
		socket.emit("pairingRequest", {
			targetId: targetId,
		});
	}
}

// Confirm pairing request
function confirmPairing(requesterId) {
	if (socket && socket.connected) {
		socket.emit("pairingConfirmed", {
			targetId: requesterId,
		});
		pairedDeviceId = requesterId;
	}
}
```

## API Documentation

### Server-side API Endpoints

#### WebSocket Events

| Event              | Direction       | Description                        | Data Format                                             |
| ------------------ | --------------- | ---------------------------------- | ------------------------------------------------------- |
| `registerDevice`   | Client → Server | Register device type and info      | `{ type: 'mobile'/'laptop', id: String, name: String }` |
| `availableDevices` | Server → Client | List of available devices          | `Array<{ id: String, type: String, name: String }>`     |
| `pairingRequest`   | Bidirectional   | Request pairing with target device | `{ targetId: String }`                                  |
| `pairingConfirmed` | Bidirectional   | Confirm pairing request            | `{ targetId: String }`                                  |
| `biometricData`    | Bidirectional   | Send/receive biometric data        | `{ targetId: String, data: Object }`                    |
| `feedback`         | Bidirectional   | Send/receive feedback              | `{ targetId: String, message: String, type: String }`   |

#### HTTP Endpoints

| Endpoint               | Method | Description                 | Parameters | Response                                         |
| ---------------------- | ------ | --------------------------- | ---------- | ------------------------------------------------ |
| `/api/models/status`   | GET    | Check model download status | None       | `{ downloaded: Boolean, models: Array<String> }` |
| `/api/models/download` | POST   | Trigger model download      | None       | `{ success: Boolean, message: String }`          |

### Client-side Utility Functions

#### Face API Loader

```javascript
// Load Face API models
async function loadModels() {
	// Load models from CDN or local storage
	const modelPath = useLocalModels
		? "/models"
		: "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";

	await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
	await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
	await faceapi.nets.faceExpressionNet.loadFromUri(modelPath);

	return true;
}

// Check if models are available locally
async function checkLocalModels() {
	try {
		// Check if the model JSON files exist in local storage
		const response = await fetch(
			"/models/tiny_face_detector_model-weights_manifest.json"
		);
		return response.ok;
	} catch (error) {
		return false;
	}
}

// Download models for offline use
async function downloadModels() {
	const modelNames = [
		"tiny_face_detector_model",
		"face_landmark_68_model",
		"face_expression_model",
	];

	const progress = { current: 0, total: modelNames.length };
	updateDownloadProgress(progress);

	for (const model of modelNames) {
		await downloadModel(model);
		progress.current++;
		updateDownloadProgress(progress);
	}

	return true;
}
```

## Future Enhancements

### Short-term Enhancements

1. **Improved Model Efficiency**

   - Optimize model size and runtime performance
   - Implement progressive loading for faster initial startup

2. **Enhanced Visualization Options**

   - Add more chart types and customization options
   - Implement heatmap visualizations for eye tracking

3. **Expanded Metrics**
   - Add cognitive load estimation
   - Implement attention span measurement

### Long-term Vision

1. **Advanced Biometric Features**

   - Blood pressure estimation
   - Stress level prediction
   - Fatigue detection

2. **Multi-user Support**

   - Simultaneous tracking of multiple faces
   - Comparative analytics between users

3. **Integration Capabilities**
   - API for integration with third-party applications
   - SDK for developers to incorporate BioVision features

## Installation and Setup

### Prerequisites

- Node.js (v14.0.0 or higher)
- NPM (v6.0.0 or higher)
- Modern web browser with WebRTC support

### Installation Steps

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
   - Navigate to `http://localhost:3000` in your web browser
   - Click "Download ML Models" button to download models for offline use

### Mobile Device Setup

1. Ensure your mobile device and laptop are on the same network
2. Open the application URL on your mobile device
3. Select "Phone" mode
4. Grant camera permissions when prompted
5. Click "Pair with Laptop" to establish connection

### Laptop Setup

1. Open the application URL on your laptop
2. Select "Laptop" mode
3. Wait for mobile devices to appear in the "Available Mobile Devices" section
4. Accept pairing request when received

## Conclusion

BioVision represents a significant advancement in non-invasive biometric tracking technology. By leveraging the power of computer vision, machine learning, and web technologies, it provides a comprehensive platform for monitoring and analyzing human physiological and behavioral signals in real-time.

The system's ability to track eye movements, monitor heart rate, and detect emotions without specialized hardware makes it accessible and versatile for a wide range of applications, from UX research and healthcare monitoring to attention analysis and emotional well-being.

Future development will focus on expanding the system's capabilities, improving accuracy and performance, and creating a more robust platform for research and practical applications in the rapidly evolving field of human-computer interaction.

## Project Report

### 1. Project Overview

The BioVision Biometric Tracking System was developed to address the growing need for non-invasive, accessible biometric monitoring solutions. Traditional biometric tracking systems often require specialized hardware, are prohibitively expensive, or provide limited metrics. BioVision aims to overcome these limitations by leveraging standard webcams and mobile device cameras to capture and analyze a comprehensive set of biometric data.

### 2. Development Methodology

The project followed an iterative Agile development approach, with regular sprints and continuous integration. The development process included:

- Requirements gathering and analysis
- Technology stack selection
- Prototype development and testing
- Iterative feature implementation
- Performance optimization
- User testing and feedback incorporation

### 3. Key Challenges and Solutions

#### Challenge 1: Real-time Processing Performance

**Issue**: Processing video frames for multiple biometric signals simultaneously caused performance bottlenecks, especially on mobile devices.

**Solution**: Implemented optimized processing pipelines, selective frame processing, and worker threads to distribute computation load. Additionally, adopted TensorFlow.js's WebGL backend for hardware acceleration where available.

#### Challenge 2: Accuracy of Non-contact Heart Rate Monitoring

**Issue**: Initial heart rate detection algorithms were susceptible to noise, lighting variations, and motion artifacts.

**Solution**: Implemented a multi-region approach that analyzes multiple facial regions simultaneously, combined with temporal filtering and signal processing techniques to improve robustness. Added adaptive region selection based on lighting conditions.

#### Challenge 3: Cross-device Compatibility

**Issue**: Ensuring consistent performance across various browsers, devices, and camera specifications.

**Solution**: Implemented feature detection and graceful degradation, allowing the system to adjust its functionality based on available resources. Created a progressive enhancement approach where core features work on all supported devices, with advanced features enabled when possible.

#### Challenge 4: Privacy Concerns

**Issue**: Processing sensitive biometric data raised privacy concerns.

**Solution**: Implemented client-side processing for all biometric data, ensuring that raw video never leaves the user's device. Added options for local-only mode with no data transmission.

### 4. Impact and Applications

#### Healthcare Monitoring

BioVision's non-contact heart rate monitoring and stress detection capabilities provide valuable tools for remote patient monitoring and telehealth applications. The system can alert users to abnormal heart rate patterns and provide trend analysis over time.

#### UX and Usability Research

The eye tracking and emotion detection features offer researchers insights into user engagement, attention patterns, and emotional responses to digital content. These metrics help optimize user interfaces and content for better engagement.

#### Accessibility

By providing a means to control interfaces through eye movements, BioVision enhances accessibility for users with limited mobility. The system can be adapted to serve as an alternative input method for those unable to use traditional input devices.

#### Wellness and Productivity

The combined analysis of biometric signals provides users with insights into their stress levels, fatigue, and emotional states throughout the day. This information can help users manage their well-being and optimize productivity.

### 5. Future Directions

Based on user feedback and technological trends, several key directions for future development have been identified:

1. **Integration with Wearable Devices**: Combining camera-based tracking with data from wearable sensors for enhanced accuracy and additional metrics.

2. **Expanded ML Models**: Developing more sophisticated machine learning models for improved emotion detection, fatigue estimation, and cognitive load analysis.

3. **Cross-platform Native Applications**: Developing native applications for iOS, Android, and desktop platforms to improve performance and offer deeper hardware integration.

4. **Cloud Analytics Platform**: Creating an optional cloud platform for users who want to store, analyze, and share their biometric data for research or personal tracking.

### 6. Conclusion

The BioVision Biometric Tracking System successfully demonstrates the potential of computer vision and machine learning for non-invasive biometric monitoring. By making sophisticated biometric analysis accessible through everyday devices, BioVision opens new possibilities for health monitoring, human-computer interaction, and user experience research.

The project's technical innovations in real-time processing, multi-signal analysis, and cross-device compatibility provide a solid foundation for future enhancements and applications. As technology continues to evolve, BioVision is well-positioned to incorporate new advancements and expand its capabilities to serve an increasingly diverse range of use cases.
