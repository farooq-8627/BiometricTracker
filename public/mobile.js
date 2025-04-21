// Global variables for mobile interface
let socket; // Socket.io socket
let ws; // WebSocket connection
let cameraStream = null;
let videoElement;
let overlayCanvas;
let overlayContext;
let isTracking = false;
let pairRequestQueue = [];
let pairedLaptopId = null;
let lastHeartRate = null;
let heartRateInterval = null;
let eyeTrackingInterval = null;
let useWebSocket = false; // Flag to determine which connection to use

// Initialize the mobile interface
function initializeMobileInterface() {
	console.log("Initializing mobile interface...");

	// Get DOM elements
	videoElement = document.getElementById("camera-feed");
	overlayCanvas = document.getElementById("overlay-canvas");
	overlayContext = overlayCanvas.getContext("2d");

	// Try to establish WebSocket connection first
	try {
		ws = initializeWebSocket();
		setupMobileWebSocketHandlers(ws, {
			onAvailableLaptops: displayAvailableLaptops,
			onLaptopDisconnected: (laptopId) => {
				removeAvailableLaptop(laptopId);
				if (pairedLaptopId === laptopId) {
					pairedLaptopId = null;
					updateConnectionStatus("Paired laptop disconnected", "not-connected");
					showPairingPanel();
				}
			},
			onPairRequest: (laptopId) => {
				console.log("Received pairing request from laptop:", laptopId);
				pairRequestQueue.push(laptopId);
				processPairRequest();
			},
			onPairConfirmed: (laptopId) => {
				console.log("Pairing confirmed with laptop:", laptopId);
				pairedLaptopId = laptopId;
				updateConnectionStatus("Paired with laptop", "connected");
				hidePairingPanel();
				document.getElementById("biofeedback-panel").classList.remove("hidden");
			},
			onBiofeedbackUpdate: (_, feedback) => {
				console.log("Received biofeedback:", feedback);
				displayBiofeedback(feedback);
			},
		});

		// Register as mobile device via WebSocket
		ws.onopen = () => {
			console.log("WebSocket connection established");
			updateConnectionStatus("Connected to server via WebSocket", "connected");
			registerDevice(ws, "mobile");
			useWebSocket = true;
		};

		ws.onerror = () => {
			console.error("WebSocket connection failed, falling back to Socket.io");
			useWebSocket = false;
			fallbackToSocketIO();
		};
	} catch (error) {
		console.error("Failed to initialize WebSocket:", error);
		fallbackToSocketIO();
	}

	setupUIEventListeners();

	// Load face-api.js models
	loadModels();
}

// Fall back to Socket.io if WebSocket fails
function fallbackToSocketIO() {
	// Initialize Socket.io connection
	const socketUrl = `${window.location.protocol}//${window.location.host}`;
	socket = io(socketUrl);
	setupSocketListeners();
}

// Load ML models required for eye tracking and heart rate detection
async function loadModels() {
	try {
		// Update UI to show loading status
		updateConnectionStatus("Loading models...", "connecting");

		// Check if face-api is defined
		if (typeof faceapi === "undefined") {
			console.error("Face API library not found. Will retry in 2 seconds...");
			// Retry after a delay instead of trying to load dynamically
			setTimeout(loadModels, 2000);
			return;
		}

		console.log("Face API found, loading models...");

		// Create models directory if loading from server
		try {
			// Log out which models are already loaded
			console.log("Model loading status before loading attempt:");
			console.log(
				"- TinyFaceDetector loaded:",
				faceapi.nets.tinyFaceDetector.isLoaded
			);
			console.log(
				"- FaceLandmark68Net loaded:",
				faceapi.nets.faceLandmark68Net.isLoaded
			);

			// Try loading from CDN with more explicit options
			const modelPath =
				"https://justadudewhohacks.github.io/face-api.js/models";
			console.log("Attempting to load models from CDN:", modelPath);

			// Use more robust loading approach with explicit model paths
			await Promise.all([
				faceapi.nets.tinyFaceDetector.load(modelPath),
				faceapi.nets.faceLandmark68Net.load(modelPath),
			]);

			// Verify models loaded successfully
			if (
				faceapi.nets.tinyFaceDetector.isLoaded &&
				faceapi.nets.faceLandmark68Net.isLoaded
			) {
				console.log("Models loaded successfully from CDN");
			} else {
				throw new Error("Models not properly loaded from CDN");
			}
		} catch (modelError) {
			console.warn(
				"Failed to load models from CDN, trying local path:",
				modelError
			);

			// Fall back to local models
			const modelPath = "/models";
			console.log("Attempting to load models from local path:", modelPath);

			try {
				await Promise.all([
					faceapi.nets.tinyFaceDetector.load(modelPath),
					faceapi.nets.faceLandmark68Net.load(modelPath),
				]);

				// Verify models loaded successfully
				if (
					faceapi.nets.tinyFaceDetector.isLoaded &&
					faceapi.nets.faceLandmark68Net.isLoaded
				) {
					console.log("Models loaded successfully from local path");
				} else {
					throw new Error("Models not properly loaded from local path");
				}
			} catch (localModelError) {
				console.error(
					"Failed to load models from local path:",
					localModelError
				);
				throw localModelError; // Re-throw to be caught by outer catch
			}
		}

		updateConnectionStatus("Models loaded", "connected");

		// Enable camera button after models are loaded
		document.getElementById("toggle-camera").disabled = false;
	} catch (error) {
		console.error("Error loading models:", error);
		updateConnectionStatus(
			"Failed to load models, retrying...",
			"not-connected"
		);

		// Retry after a delay
		setTimeout(loadModels, 5000);
	}
}

// Set up Socket.io event listeners
function setupSocketListeners() {
	socket.on("connect", () => {
		console.log("Connected to server with ID:", socket.id);
		updateConnectionStatus("Connected to server", "connected");

		// Register as a mobile device
		socket.emit("register", "mobile");
	});

	socket.on("disconnect", () => {
		console.log("Disconnected from server");
		updateConnectionStatus("Disconnected", "not-connected");
		pairedLaptopId = null;
	});

	// Handle laptop connection events
	socket.on("available_laptops", (laptops) => {
		console.log("Available laptops:", laptops);
		displayAvailableLaptops(laptops);
	});

	socket.on("laptop_connected", (laptopId) => {
		console.log("New laptop connected:", laptopId);
		addAvailableLaptop(laptopId);
	});

	socket.on("laptop_disconnected", (laptopId) => {
		console.log("Laptop disconnected:", laptopId);
		removeAvailableLaptop(laptopId);

		if (pairedLaptopId === laptopId) {
			pairedLaptopId = null;
			updateConnectionStatus("Paired laptop disconnected", "not-connected");
			showPairingPanel();
		}
	});

	// Handle pairing events
	socket.on("pair_request", (laptopId) => {
		console.log("Received pairing request from laptop:", laptopId);
		pairRequestQueue.push(laptopId);
		processPairRequest();
	});

	socket.on("pair_confirmed", (laptopId) => {
		console.log("Pairing confirmed with laptop:", laptopId);
		pairedLaptopId = laptopId;
		updateConnectionStatus("Paired with laptop", "connected");
		hidePairingPanel();

		// Show biofeedback panel when paired
		document.getElementById("biofeedback-panel").classList.remove("hidden");
	});

	// Handle biofeedback
	socket.on("biofeedback_update", (data) => {
		console.log("Received biofeedback:", data);
		displayBiofeedback(data.feedback);
	});
}

// Set up UI event listeners
function setupUIEventListeners() {
	// Camera toggle button
	document
		.getElementById("toggle-camera")
		.addEventListener("click", async () => {
			if (!cameraStream) {
				await startCamera();
			} else {
				stopCamera();
			}
		});

	// Tracking toggle button
	document.getElementById("toggle-tracking").addEventListener("click", () => {
		if (!isTracking) {
			startTracking();
		} else {
			stopTracking();
		}
	});

	// Pair device button
	document.getElementById("pair-device").addEventListener("click", () => {
		if (document.getElementById("pairing-panel").classList.contains("hidden")) {
			showPairingPanel();
		} else {
			hidePairingPanel();
		}
	});
}

// Start the camera
async function startCamera() {
	try {
		const constraints = {
			video: {
				facingMode: "user",
				width: { ideal: 640 },
				height: { ideal: 480 },
			},
		};

		cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
		videoElement.srcObject = cameraStream;

		// Wait for video to be ready
		await new Promise((resolve) => {
			videoElement.onloadedmetadata = () => {
				resolve();
			};
		});

		// Start playing video
		await videoElement.play();

		// Set canvas dimensions to match video
		overlayCanvas.width = videoElement.videoWidth;
		overlayCanvas.height = videoElement.videoHeight;

		// Update UI
		document.getElementById("toggle-camera").innerHTML =
			'<i data-feather="video-off"></i> Stop Camera';
		feather.replace();
		document.getElementById("toggle-tracking").disabled = false;

		console.log("Camera started successfully");
	} catch (error) {
		console.error("Error starting camera:", error);
		alert(`Could not access camera: ${error.message}`);
	}
}

// Stop the camera
function stopCamera() {
	if (cameraStream) {
		// Stop tracking if it's running
		if (isTracking) {
			stopTracking();
		}

		// Stop all tracks
		cameraStream.getTracks().forEach((track) => track.stop());
		cameraStream = null;
		videoElement.srcObject = null;

		// Clear the canvas
		overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

		// Update UI
		document.getElementById("toggle-camera").innerHTML =
			'<i data-feather="video"></i> Start Camera';
		feather.replace();
		document.getElementById("toggle-tracking").disabled = true;

		console.log("Camera stopped");
	}
}

// Start tracking eye movement and heart rate
function startTracking() {
	if (!cameraStream || isTracking) return;

	isTracking = true;

	// Update UI
	document.getElementById("toggle-tracking").innerHTML =
		'<i data-feather="eye-off"></i> Stop Tracking';
	feather.replace();
	document.getElementById("eye-status").innerText = "Tracking";

	// Track combined biometric data
	let latestEyeData = null;
	let latestHeartRate = null;

	// Function to send combined data
	const sendCombinedData = () => {
		if (!pairedLaptopId) return;

		// Only send if we have data to send
		if (!latestEyeData) return;

		// Create combined data packet
		const combinedData = {
			...latestEyeData,
			timestamp: Date.now(),
			heartRate: latestHeartRate ? latestHeartRate.bpm : null,
			heartRateConfidence: latestHeartRate ? latestHeartRate.confidence : null,
		};

		// Send the combined data to the paired laptop
		if (useWebSocket && ws && ws.readyState === WebSocket.OPEN) {
			// Use a specific message type for combined data
			const data = {
				type: "combined_biometric_data",
				targetId: pairedLaptopId,
				data: combinedData,
			};
			ws.send(JSON.stringify(data));
		} else if (socket && socket.connected) {
			socket.emit("combined_biometric_data", {
				targetId: pairedLaptopId,
				data: combinedData,
			});
		}

		console.log("Sent combined biometric data to laptop");
	};

	// Start eye tracking interval (30fps)
	eyeTrackingInterval = setInterval(async () => {
		if (videoElement.readyState === 4) {
			try {
				const eyeData = await processEyeTracking(
					videoElement,
					overlayCanvas,
					overlayContext
				);

				// Update eye tracking metrics display
				if (eyeData) {
					updateEyeTrackingMetrics(eyeData);
					latestEyeData = eyeData;

					// Also send individual eye tracking data for compatibility
					if (pairedLaptopId) {
						if (useWebSocket && ws && ws.readyState === WebSocket.OPEN) {
							sendEyeTrackingData(ws, pairedLaptopId, eyeData);
						} else if (socket && socket.connected) {
							socket.emit("eye_tracking_data", {
								targetId: pairedLaptopId,
								trackingData: eyeData,
							});
						}
					}
				} else {
					console.log("No face detected for eye tracking");
				}
			} catch (error) {
				console.error("Error during eye tracking processing:", error);
			}
		}
	}, 33); // ~30fps

	// Start heart rate detection interval (once every 2 seconds)
	heartRateInterval = setInterval(async () => {
		if (videoElement.readyState === 4) {
			try {
				const heartRateData = await detectHeartRate(videoElement);

				if (heartRateData) {
					latestHeartRate = heartRateData;
					lastHeartRate = heartRateData.bpm;
					document.getElementById("heart-rate-value").innerText = `${Math.round(
						lastHeartRate
					)} BPM`;

					// Also send individual heart rate data for compatibility
					if (pairedLaptopId) {
						if (useWebSocket && ws && ws.readyState === WebSocket.OPEN) {
							sendHeartRateData(ws, pairedLaptopId, heartRateData);
						} else if (socket && socket.connected) {
							socket.emit("heart_rate_data", {
								targetId: pairedLaptopId,
								heartRateData: heartRateData,
							});
						}
					}
				}
			} catch (error) {
				console.error("Error during heart rate detection:", error);
			}
		}
	}, 2000);

	// Send combined data at regular intervals (5 times per second)
	const combinedDataInterval = setInterval(sendCombinedData, 200);

	// Store the interval for cleanup
	window.combinedDataInterval = combinedDataInterval;
}

// Stop tracking
function stopTracking() {
	if (!isTracking) return;

	isTracking = false;

	// Clear intervals
	if (eyeTrackingInterval) {
		clearInterval(eyeTrackingInterval);
		eyeTrackingInterval = null;
	}

	if (heartRateInterval) {
		clearInterval(heartRateInterval);
		heartRateInterval = null;
	}

	// Clear combined data interval
	if (window.combinedDataInterval) {
		clearInterval(window.combinedDataInterval);
		window.combinedDataInterval = null;
	}

	// Update UI
	document.getElementById("toggle-tracking").innerHTML =
		'<i data-feather="eye"></i> Start Tracking';
	feather.replace();
	document.getElementById("eye-status").innerText = "Not tracking";
	document.getElementById("heart-rate-value").innerText = "-- BPM";

	// Clear the canvas
	overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

// Display available laptops for pairing
function displayAvailableLaptops(laptops) {
	const laptopsList = document.getElementById("available-laptops");
	laptopsList.innerHTML = "";

	if (laptops.length === 0) {
		laptopsList.innerHTML = "<li>No laptops available for pairing</li>";
		return;
	}

	laptops.forEach((laptopId) => {
		const listItem = document.createElement("li");
		listItem.textContent = `Laptop (${laptopId.substring(0, 8)}...)`;

		const pairButton = document.createElement("button");
		pairButton.className = "control-btn";
		pairButton.textContent = "Pair";
		pairButton.addEventListener("click", () => {
			requestPairing(laptopId);
		});

		listItem.appendChild(pairButton);
		laptopsList.appendChild(listItem);
	});
}

// Add a new available laptop to the list
function addAvailableLaptop(laptopId) {
	const laptopsList = document.getElementById("available-laptops");

	// Check if it's the first laptop
	if (
		laptopsList
			.querySelector("li")
			?.textContent.includes("No laptops available")
	) {
		laptopsList.innerHTML = "";
	}

	const listItem = document.createElement("li");
	listItem.dataset.id = laptopId;
	listItem.textContent = `Laptop (${laptopId.substring(0, 8)}...)`;

	const pairButton = document.createElement("button");
	pairButton.className = "control-btn";
	pairButton.textContent = "Pair";
	pairButton.addEventListener("click", () => {
		requestPairing(laptopId);
	});

	listItem.appendChild(pairButton);
	laptopsList.appendChild(listItem);
}

// Remove a laptop from the available list
function removeAvailableLaptop(laptopId) {
	const laptopsList = document.getElementById("available-laptops");
	const listItem = Array.from(laptopsList.querySelectorAll("li")).find(
		(li) => li.dataset.id === laptopId
	);

	if (listItem) {
		laptopsList.removeChild(listItem);
	}

	// Check if the list is now empty
	if (laptopsList.children.length === 0) {
		laptopsList.innerHTML = "<li>No laptops available for pairing</li>";
	}
}

// Request pairing with a laptop
function requestPairing(laptopId) {
	console.log("Requesting pairing with laptop:", laptopId);
	if (useWebSocket && ws && ws.readyState === WebSocket.OPEN) {
		sendPairRequest(ws, laptopId);
	} else if (socket && socket.connected) {
		socket.emit("pair_request", laptopId);
	}
	updateConnectionStatus("Pairing request sent...", "connecting");
}

// Process a pairing request
function processPairRequest() {
	if (pairRequestQueue.length === 0) return;

	const laptopId = pairRequestQueue[0];

	if (
		confirm(
			`Laptop (${laptopId.substring(
				0,
				8
			)}...) wants to pair with your device. Accept?`
		)
	) {
		if (useWebSocket && ws && ws.readyState === WebSocket.OPEN) {
			acceptPairRequest(ws, laptopId);
		} else if (socket && socket.connected) {
			socket.emit("pair_accept", laptopId);
		}
		pairedLaptopId = laptopId;
		updateConnectionStatus("Paired with laptop", "connected");
		hidePairingPanel();

		// Show biofeedback panel when paired
		document.getElementById("biofeedback-panel").classList.remove("hidden");
	}

	pairRequestQueue.shift();

	// Process the next request if any
	if (pairRequestQueue.length > 0) {
		setTimeout(processPairRequest, 500);
	}
}

// Show the pairing panel
function showPairingPanel() {
	document.getElementById("pairing-panel").classList.remove("hidden");
}

// Hide the pairing panel
function hidePairingPanel() {
	document.getElementById("pairing-panel").classList.add("hidden");
}

// Display biofeedback from the laptop
function displayBiofeedback(feedback) {
	const feedbackMessages = document.getElementById("feedback-messages");
	const messageElement = document.createElement("div");

	messageElement.className = `feedback-message feedback-${feedback.type}`;
	messageElement.textContent = feedback.message;

	feedbackMessages.appendChild(messageElement);

	// Scroll to the bottom
	feedbackMessages.scrollTop = feedbackMessages.scrollHeight;

	// Remove old messages if there are too many
	while (feedbackMessages.children.length > 20) {
		feedbackMessages.removeChild(feedbackMessages.firstChild);
	}
}

// Update the connection status display
function updateConnectionStatus(message, status) {
	const statusElement = document.getElementById("connection-status");
	statusElement.textContent = message;
	statusElement.className = `status ${status}`;
}

// Clean up resources when leaving the page
window.addEventListener("beforeunload", () => {
	if (cameraStream) {
		stopCamera();
	}

	if (socket) {
		socket.disconnect();
	}

	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.close();
	}
});

// Update the eye tracking metrics display with new data
function updateEyeTrackingMetrics(eyeData) {
	// Skip if eyeData is null or undefined
	if (!eyeData) {
		console.log("No eye tracking data available to display");
		return;
	}

	// Create or get container for extended metrics
	let metricsContainer = document.getElementById("extended-eye-metrics");
	if (!metricsContainer) {
		// If container doesn't exist yet, create it
		const mobileInterface = document.getElementById("mobile-interface");
		const metricsSection = mobileInterface.querySelector(".metrics");

		if (metricsSection) {
			// Create a new section for extended metrics
			metricsContainer = document.createElement("div");
			metricsContainer.id = "extended-eye-metrics";
			metricsContainer.className = "extended-metrics";
			metricsSection.appendChild(metricsContainer);

			// Add CSS for the extended metrics
			const style = document.createElement("style");
			style.textContent = `
				.extended-metrics {
					display: grid;
					grid-template-columns: 1fr 1fr;
					gap: 10px;
					margin-top: 15px;
					padding: 10px;
					background: rgba(0, 0, 0, 0.2);
					border-radius: 8px;
				}
				.metric-item {
					font-size: 12px;
					display: flex;
					flex-direction: column;
				}
				.metric-item .label {
					font-weight: bold;
					color: #aaa;
				}
				.metric-item .value {
					color: #fff;
				}
			`;
			document.head.appendChild(style);
		}
	}

	// Update or create the metrics display
	if (metricsContainer) {
		// Define metrics to display, checking that properties exist before accessing
		const gazeDirection = eyeData.gazeDirection || { x: 0, y: 0 };
		const headDirection = eyeData.headDirection || {
			pitch: 0,
			yaw: 0,
			roll: 0,
		};
		const headPosition = eyeData.headPosition || { x: 0, y: 0, z: 0 };
		const pupilDiameter = eyeData.pupilDiameter || 0;
		const pupilDilationPercent = eyeData.pupilDilationPercent || 0;

		const metrics = [
			{
				id: "gaze-direction",
				label: "Gaze Direction",
				value: `x: ${gazeDirection.x.toFixed(2)}, y: ${gazeDirection.y.toFixed(
					2
				)}`,
			},
			{
				id: "pupil-size",
				label: "Pupil Diameter",
				value: `${pupilDiameter.toFixed(1)}px (${pupilDilationPercent.toFixed(
					0
				)}%)`,
			},
			{
				id: "head-rotation",
				label: "Head Rotation",
				value: `P: ${headDirection.pitch.toFixed(
					1
				)}° Y: ${headDirection.yaw.toFixed(1)}° R: ${headDirection.roll.toFixed(
					1
				)}°`,
			},
			{
				id: "head-position",
				label: "Head Movement",
				value: `x: ${headPosition.x.toFixed(1)}, y: ${headPosition.y.toFixed(
					1
				)}, z: ${headPosition.z.toFixed(1)}`,
			},
		];

		// Update or create each metric
		metrics.forEach((metric) => {
			let metricElement = document.getElementById(metric.id);

			if (!metricElement) {
				// Create new metric element if it doesn't exist
				metricElement = document.createElement("div");
				metricElement.id = metric.id;
				metricElement.className = "metric-item";

				const labelElement = document.createElement("span");
				labelElement.className = "label";
				labelElement.textContent = metric.label;

				const valueElement = document.createElement("span");
				valueElement.className = "value";

				metricElement.appendChild(labelElement);
				metricElement.appendChild(valueElement);
				metricsContainer.appendChild(metricElement);
			}

			// Update the value
			const valueElement = metricElement.querySelector(".value");
			if (valueElement) {
				valueElement.textContent = metric.value;
			}
		});
	}

	// Update the main eye status with brief summary
	const eyeStatus = document.getElementById("eye-status");
	if (eyeStatus) {
		// Safely access gaze direction properties
		const gazeDirection = eyeData.gazeDirection || { x: 0, y: 0 };
		const gazeX = gazeDirection.x;
		const gazeY = gazeDirection.y;

		// Create a text description of where the user is looking
		let gazeDescription = "Looking ";
		if (Math.abs(gazeX) < 0.2 && Math.abs(gazeY) < 0.2) {
			gazeDescription += "center";
		} else {
			if (gazeY < -0.3) gazeDescription += "up";
			else if (gazeY > 0.3) gazeDescription += "down";

			if (gazeX < -0.3)
				gazeDescription += gazeY < -0.3 || gazeY > 0.3 ? " and left" : " left";
			else if (gazeX > 0.3)
				gazeDescription +=
					gazeY < -0.3 || gazeY > 0.3 ? " and right" : " right";
		}

		eyeStatus.textContent = gazeDescription;
	}
}

// Update webSocketUtils.js sendEyeTrackingData function to include new data
function sendEyeTrackingData(ws, targetId, trackingData) {
	const data = {
		type: "eye_tracking_data",
		targetId: targetId,
		trackingData: {
			blinkRate: trackingData.blinkRate,
			saccadeVelocity: trackingData.saccadeVelocity,
			gazeDuration: trackingData.gazeDuration,
			pupilDilation: trackingData.pupilDilation,
			gazeDirection: trackingData.gazeDirection,
			headDirection: trackingData.headDirection,
			headPosition: trackingData.headPosition,
			pupilDiameter: trackingData.pupilDiameter,
			pupilDilationPercent: trackingData.pupilDilationPercent,
		},
	};

	if (ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(data));
	}
}
