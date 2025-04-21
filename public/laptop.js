// Global variables for laptop interface
let socket; // Socket.io socket
let ws; // WebSocket connection
let pairedMobileId = null;
let eyeMovementChart = null;
let heartRateChart = null;
let combinedChart = null;
let eyeTrackingData = [];
let heartRateData = [];
let feedbackHistory = [];
let useWebSocket = false; // Flag to determine which connection to use

// Initialize the laptop interface
function initializeLaptopInterface() {
	console.log("Initializing laptop interface...");

	// Try to establish WebSocket connection first
	try {
		ws = initializeWebSocket();

		// If WebSocket initialization returned null, fall back to Socket.io immediately
		if (ws === null) {
			console.log("WebSocket not available, falling back to Socket.io");
			useWebSocket = false;
			fallbackToSocketIO();
			setupUIEventListeners();
			setupCharts();
			return;
		}

		setupLaptopWebSocketHandlers(ws, {
			onAvailableMobiles: displayAvailableMobiles,
			onMobileConnected: addAvailableMobile,
			onMobileDisconnected: (mobileId) => {
				removeAvailableMobile(mobileId);
				if (pairedMobileId === mobileId) {
					pairedMobileId = null;
					updateConnectionStatus(
						"Paired mobile device disconnected",
						"not-connected"
					);
					resetData();
				}
			},
			onPairRequest: (mobileId) => {
				console.log("Received pairing request from mobile device:", mobileId);
				if (
					confirm(
						`Mobile device (${mobileId.substring(
							0,
							8
						)}...) wants to pair with your laptop. Accept?`
					)
				) {
					acceptPairRequest(ws, mobileId);
					pairedMobileId = mobileId;
					updateConnectionStatus("Paired with mobile device", "connected");
					addToConnectedDevices(mobileId);
				}
			},
			onPairConfirmed: (mobileId) => {
				console.log("Pairing confirmed with mobile device:", mobileId);
				pairedMobileId = mobileId;
				updateConnectionStatus("Paired with mobile device", "connected");
				addToConnectedDevices(mobileId);
			},
			onEyeTrackingUpdate: (sourceId, data) => {
				console.log("Received eye tracking data:", { sourceId, data });
				if (sourceId === pairedMobileId) {
					processEyeTrackingData(data);
				}
			},
			onHeartRateUpdate: (sourceId, data) => {
				console.log("Received heart rate data:", { sourceId, data });
				if (sourceId === pairedMobileId) {
					processHeartRateData(data);
				}
			},
		});

		// Register as laptop device via WebSocket
		ws.onopen = () => {
			console.log("WebSocket connection established");
			updateConnectionStatus("Connected to server via WebSocket", "connected");
			registerDevice(ws, "laptop");
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
	setupCharts();
}

// Fall back to Socket.io if WebSocket fails
function fallbackToSocketIO() {
	// Initialize Socket.io connection
	const socketUrl = `${window.location.protocol}//${window.location.host}`;
	socket = io(socketUrl);
	setupSocketListeners();
}

// Set up Socket.io event listeners
function setupSocketListeners() {
	socket.on("connect", () => {
		console.log("Connected to server with ID:", socket.id);
		updateConnectionStatus("Connected to server", "connected");

		// Register as a laptop device
		socket.emit("register", "laptop");
	});

	socket.on("disconnect", () => {
		console.log("Disconnected from server");
		updateConnectionStatus("Disconnected", "not-connected");
		pairedMobileId = null;
	});

	// Handle mobile connection events
	socket.on("available_mobiles", (mobiles) => {
		console.log("Available mobile devices:", mobiles);
		displayAvailableMobiles(mobiles);
	});

	socket.on("mobile_connected", (mobileId) => {
		console.log("New mobile device connected:", mobileId);
		addAvailableMobile(mobileId);
	});

	socket.on("mobile_disconnected", (mobileId) => {
		console.log("Mobile device disconnected:", mobileId);
		removeAvailableMobile(mobileId);

		if (pairedMobileId === mobileId) {
			pairedMobileId = null;
			updateConnectionStatus(
				"Paired mobile device disconnected",
				"not-connected"
			);
			resetData();
		}
	});

	// Handle pairing events
	socket.on("pair_request", (mobileId) => {
		console.log("Received pairing request from mobile device:", mobileId);

		if (
			confirm(
				`Mobile device (${mobileId.substring(
					0,
					8
				)}...) wants to pair with your laptop. Accept?`
			)
		) {
			socket.emit("pair_accept", mobileId);
			pairedMobileId = mobileId;
			updateConnectionStatus("Paired with mobile device", "connected");
			addToConnectedDevices(mobileId);
		}
	});

	socket.on("pair_confirmed", (mobileId) => {
		console.log("Pairing confirmed with mobile device:", mobileId);
		pairedMobileId = mobileId;
		updateConnectionStatus("Paired with mobile device", "connected");
		addToConnectedDevices(mobileId);
	});

	// Handle data updates
	socket.on("eye_tracking_update", (data) => {
		console.log("Received eye tracking data:", data);

		// Process and display eye tracking data
		if (data.sourceId === pairedMobileId) {
			processEyeTrackingData(data.data);
		}
	});

	socket.on("heart_rate_update", (data) => {
		console.log("Received heart rate data:", data);

		// Process and display heart rate data
		if (data.sourceId === pairedMobileId) {
			processHeartRateData(data.data);
		}
	});
}

// Set up UI event listeners
function setupUIEventListeners() {
	// Send feedback button
	document.getElementById("send-feedback").addEventListener("click", () => {
		const feedbackType = document.getElementById("feedback-type").value;
		const feedbackMessage = document.getElementById("feedback-message").value;

		if (!feedbackMessage.trim()) {
			alert("Please enter a feedback message");
			return;
		}

		if (!pairedMobileId) {
			alert("No mobile device paired");
			return;
		}

		sendBiofeedback(feedbackType, feedbackMessage);
		document.getElementById("feedback-message").value = "";
	});
}

// Set up the charts
function setupCharts() {
	// Eye Movement Chart
	const eyeMovementCtx = document
		.getElementById("eye-movement-chart")
		.getContext("2d");
	eyeMovementChart = new Chart(eyeMovementCtx, {
		type: "line",
		data: {
			labels: [],
			datasets: [
				{
					label: "Blink Rate",
					data: [],
					borderColor: "#4a6fa5",
					backgroundColor: "rgba(74, 111, 165, 0.2)",
					tension: 0.4,
					fill: true,
				},
				{
					label: "Saccade Velocity",
					data: [],
					borderColor: "#f44336",
					backgroundColor: "rgba(244, 67, 54, 0.2)",
					tension: 0.4,
					fill: true,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				x: {
					display: true,
					title: {
						display: true,
						text: "Time",
					},
				},
				y: {
					display: true,
					title: {
						display: true,
						text: "Value",
					},
				},
			},
		},
	});

	// Heart Rate Chart
	const heartRateCtx = document
		.getElementById("heart-rate-chart")
		.getContext("2d");
	heartRateChart = new Chart(heartRateCtx, {
		type: "line",
		data: {
			labels: [],
			datasets: [
				{
					label: "Heart Rate (BPM)",
					data: [],
					borderColor: "#f44336",
					backgroundColor: "rgba(244, 67, 54, 0.2)",
					tension: 0.4,
					fill: true,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				x: {
					display: true,
					title: {
						display: true,
						text: "Time",
					},
				},
				y: {
					display: true,
					title: {
						display: true,
						text: "BPM",
					},
					min: 40,
					max: 140,
				},
			},
		},
	});

	// Combined Chart
	const combinedCtx = document
		.getElementById("combined-chart")
		.getContext("2d");
	combinedChart = new Chart(combinedCtx, {
		type: "line",
		data: {
			labels: [],
			datasets: [
				{
					label: "Stress Level",
					data: [],
					borderColor: "#ff9800",
					backgroundColor: "rgba(255, 152, 0, 0.2)",
					tension: 0.4,
					fill: true,
					yAxisID: "y",
				},
				{
					label: "Attention Score",
					data: [],
					borderColor: "#4caf50",
					backgroundColor: "rgba(76, 175, 80, 0.2)",
					tension: 0.4,
					fill: true,
					yAxisID: "y1",
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				x: {
					display: true,
					title: {
						display: true,
						text: "Time",
					},
				},
				y: {
					display: true,
					position: "left",
					title: {
						display: true,
						text: "Stress Level",
					},
					min: 0,
					max: 100,
				},
				y1: {
					display: true,
					position: "right",
					title: {
						display: true,
						text: "Attention Score",
					},
					min: 0,
					max: 100,
					grid: {
						drawOnChartArea: false,
					},
				},
			},
		},
	});
}

// Display available mobile devices for pairing
function displayAvailableMobiles(mobiles) {
	const mobilesList = document.getElementById("available-mobiles");
	mobilesList.innerHTML = "";

	if (mobiles.length === 0) {
		mobilesList.innerHTML = "<li>No mobile devices available for pairing</li>";
		return;
	}

	mobiles.forEach((mobileId) => {
		const listItem = document.createElement("li");
		listItem.dataset.id = mobileId;
		listItem.textContent = `Mobile Device (${mobileId.substring(0, 8)}...)`;

		const pairButton = document.createElement("button");
		pairButton.className = "control-btn";
		pairButton.textContent = "Pair";
		pairButton.addEventListener("click", () => {
			requestPairing(mobileId);
		});

		listItem.appendChild(pairButton);
		mobilesList.appendChild(listItem);
	});
}

// Add a new available mobile device to the list
function addAvailableMobile(mobileId) {
	const mobilesList = document.getElementById("available-mobiles");

	// Check if it's the first mobile device
	if (
		mobilesList
			.querySelector("li")
			?.textContent.includes("No mobile devices available")
	) {
		mobilesList.innerHTML = "";
	}

	const listItem = document.createElement("li");
	listItem.dataset.id = mobileId;
	listItem.textContent = `Mobile Device (${mobileId.substring(0, 8)}...)`;

	const pairButton = document.createElement("button");
	pairButton.className = "control-btn";
	pairButton.textContent = "Pair";
	pairButton.addEventListener("click", () => {
		requestPairing(mobileId);
	});

	listItem.appendChild(pairButton);
	mobilesList.appendChild(listItem);
}

// Remove a mobile device from the available list
function removeAvailableMobile(mobileId) {
	const mobilesList = document.getElementById("available-mobiles");
	const listItem = Array.from(mobilesList.querySelectorAll("li")).find(
		(li) => li.dataset.id === mobileId
	);

	if (listItem) {
		mobilesList.removeChild(listItem);
	}

	// Check if the list is now empty
	if (mobilesList.children.length === 0) {
		mobilesList.innerHTML = "<li>No mobile devices available for pairing</li>";
	}
}

// Add a device to the connected devices list
function addToConnectedDevices(deviceId) {
	const connectedDevicesList = document.getElementById("connected-devices");

	// Clear the "no devices" message if it exists
	if (
		connectedDevicesList
			.querySelector("li")
			?.textContent.includes("No devices connected")
	) {
		connectedDevicesList.innerHTML = "";
	}

	// Check if device is already in the list
	if (
		Array.from(connectedDevicesList.querySelectorAll("li")).some(
			(li) => li.dataset.id === deviceId
		)
	) {
		return;
	}

	const listItem = document.createElement("li");
	listItem.dataset.id = deviceId;
	listItem.textContent = `Mobile Device (${deviceId.substring(0, 8)}...)`;

	const disconnectButton = document.createElement("button");
	disconnectButton.className = "control-btn";
	disconnectButton.textContent = "Disconnect";
	disconnectButton.addEventListener("click", () => {
		disconnectDevice(deviceId);
	});

	listItem.appendChild(disconnectButton);
	connectedDevicesList.appendChild(listItem);
}

// Remove a device from the connected devices list
function removeFromConnectedDevices(deviceId) {
	const connectedDevicesList = document.getElementById("connected-devices");
	const listItem = Array.from(connectedDevicesList.querySelectorAll("li")).find(
		(li) => li.dataset.id === deviceId
	);

	if (listItem) {
		connectedDevicesList.removeChild(listItem);
	}

	// Check if the list is now empty
	if (connectedDevicesList.children.length === 0) {
		connectedDevicesList.innerHTML = "<li>No devices connected</li>";
	}
}

// Request pairing with a mobile device
function requestPairing(mobileId) {
	console.log("Requesting pairing with mobile device:", mobileId);
	if (useWebSocket && ws && ws.readyState === WebSocket.OPEN) {
		sendPairRequest(ws, mobileId);
	} else if (socket && socket.connected) {
		socket.emit("pair_request", mobileId);
	}
	updateConnectionStatus("Pairing request sent...", "connecting");
}

// Disconnect from a paired device
function disconnectDevice(deviceId) {
	if (pairedMobileId === deviceId) {
		pairedMobileId = null;
		updateConnectionStatus("Disconnected from mobile device", "not-connected");
		removeFromConnectedDevices(deviceId);
		resetData();
	}
}

// Process eye tracking data from the mobile device
function processEyeTrackingData(data) {
	eyeTrackingData.push(data);

	// Limit the data array size
	if (eyeTrackingData.length > 60) {
		// Last 60 data points (1 minute at 1 Hz)
		eyeTrackingData.shift();
	}

	// Update eye movement chart
	if (eyeMovementChart) {
		const timestamps = eyeTrackingData.map((_, index) => {
			const time = new Date();
			time.setSeconds(time.getSeconds() - (eyeTrackingData.length - index - 1));
			return time.toLocaleTimeString("en-US", {
				hour12: false,
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			});
		});

		eyeMovementChart.data.labels = timestamps;
		eyeMovementChart.data.datasets[0].data = eyeTrackingData.map(
			(d) => d.blinkRate
		);
		eyeMovementChart.data.datasets[1].data = eyeTrackingData.map(
			(d) => d.saccadeVelocity
		);
		eyeMovementChart.update();
	}

	// Update eye tracking metrics
	updateEyeTrackingMetrics(data);

	// Update combined metrics
	updateCombinedMetrics();
}

// Process heart rate data from the mobile device
function processHeartRateData(data) {
	heartRateData.push(data);

	// Limit the data array size
	if (heartRateData.length > 30) {
		// Last 30 data points (1 minute at 0.5 Hz)
		heartRateData.shift();
	}

	// Update heart rate chart
	if (heartRateChart) {
		const timestamps = heartRateData.map((_, index) => {
			const time = new Date();
			time.setSeconds(
				time.getSeconds() - (heartRateData.length - index - 1) * 2
			);
			return time.toLocaleTimeString("en-US", {
				hour12: false,
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			});
		});

		heartRateChart.data.labels = timestamps;
		heartRateChart.data.datasets[0].data = heartRateData.map((d) => d.bpm);
		heartRateChart.update();
	}

	// Update heart rate metrics
	updateHeartRateMetrics();

	// Update combined metrics
	updateCombinedMetrics();
}

// Update eye tracking metrics display
function updateEyeTrackingMetrics(latestData) {
	if (eyeTrackingData.length === 0) return;

	// Calculate metrics
	const blinkRateElement = document.getElementById("blink-rate");
	const gazeDurationElement = document.getElementById("gaze-duration");
	const fatigueIndexElement = document.getElementById("fatigue-index");

	// Use the latest data for current metrics
	blinkRateElement.textContent = `${latestData.blinkRate.toFixed(
		1
	)} blinks/min`;
	gazeDurationElement.textContent = `${latestData.gazeDuration.toFixed(
		1
	)} seconds`;

	// Calculate fatigue index based on blink rate and gaze duration
	// Higher blink rate and shorter gaze duration indicate higher fatigue
	const blinkFactor = Math.min(latestData.blinkRate / 20, 1); // Normalize to 0-1 (20 blinks/min is high)
	const gazeFactor = Math.max(1 - latestData.gazeDuration / 5, 0); // Normalize to 0-1 (5+ seconds is good concentration)
	const fatigueIndex = Math.round((blinkFactor * 0.6 + gazeFactor * 0.4) * 100);

	fatigueIndexElement.textContent = fatigueIndex.toString();

	// Set color based on fatigue level
	if (fatigueIndex < 30) {
		fatigueIndexElement.style.color = "#4caf50"; // Green - low fatigue
	} else if (fatigueIndex < 70) {
		fatigueIndexElement.style.color = "#ff9800"; // Orange - moderate fatigue
	} else {
		fatigueIndexElement.style.color = "#f44336"; // Red - high fatigue
	}
}

// Update heart rate metrics display
function updateHeartRateMetrics() {
	if (heartRateData.length === 0) return;

	// Calculate metrics
	const currentHRElement = document.getElementById("current-hr");
	const averageHRElement = document.getElementById("average-hr");
	const hrVariabilityElement = document.getElementById("hr-variability");

	// Current heart rate (latest data point)
	const currentHR = heartRateData[heartRateData.length - 1].bpm;
	currentHRElement.textContent = `${Math.round(currentHR)} BPM`;

	// Average heart rate
	const avgHR =
		heartRateData.reduce((sum, data) => sum + data.bpm, 0) /
		heartRateData.length;
	averageHRElement.textContent = `${Math.round(avgHR)} BPM`;

	// Heart rate variability (standard deviation)
	if (heartRateData.length > 1) {
		const hrValues = heartRateData.map((d) => d.bpm);
		const hrVariability = calculateStandardDeviation(hrValues);
		hrVariabilityElement.textContent = hrVariability.toFixed(1);

		// Set color based on HRV level (higher is generally better in a resting state)
		if (hrVariability > 10) {
			hrVariabilityElement.style.color = "#4caf50"; // Green - good HRV
		} else if (hrVariability > 5) {
			hrVariabilityElement.style.color = "#ff9800"; // Orange - moderate HRV
		} else {
			hrVariabilityElement.style.color = "#f44336"; // Red - low HRV
		}
	} else {
		hrVariabilityElement.textContent = "--";
	}
}

// Update combined metrics display
function updateCombinedMetrics() {
	if (eyeTrackingData.length === 0 || heartRateData.length === 0) return;

	const stressLevelElement = document.getElementById("stress-level");
	const attentionScoreElement = document.getElementById("attention-score");

	// Get the latest data
	const latestEyeData = eyeTrackingData[eyeTrackingData.length - 1];
	const latestHeartData = heartRateData[heartRateData.length - 1];

	// Calculate stress level (0-100)
	// Higher heart rate and blink rate indicate higher stress
	const hrStressFactor = Math.max(
		0,
		Math.min(1, (latestHeartData.bpm - 60) / 40)
	); // Normalize HR from 60-100 to 0-1
	const blinkStressFactor = Math.min(latestEyeData.blinkRate / 20, 1); // Normalize to 0-1
	const stressLevel = Math.round(
		(hrStressFactor * 0.7 + blinkStressFactor * 0.3) * 100
	);

	stressLevelElement.textContent = stressLevel.toString();

	// Set color based on stress level
	if (stressLevel < 30) {
		stressLevelElement.style.color = "#4caf50"; // Green - low stress
	} else if (stressLevel < 70) {
		stressLevelElement.style.color = "#ff9800"; // Orange - moderate stress
	} else {
		stressLevelElement.style.color = "#f44336"; // Red - high stress
	}

	// Calculate attention score (0-100)
	// Longer gaze duration and lower saccade velocity indicate higher attention
	const gazeFactor = Math.min(latestEyeData.gazeDuration / 5, 1); // Normalize to 0-1
	const saccadeFactor = Math.max(0, 1 - latestEyeData.saccadeVelocity / 100); // Normalize to 0-1
	const attentionScore = Math.round(
		(gazeFactor * 0.6 + saccadeFactor * 0.4) * 100
	);

	attentionScoreElement.textContent = attentionScore.toString();

	// Set color based on attention score
	if (attentionScore > 70) {
		attentionScoreElement.style.color = "#4caf50"; // Green - high attention
	} else if (attentionScore > 30) {
		attentionScoreElement.style.color = "#ff9800"; // Orange - moderate attention
	} else {
		attentionScoreElement.style.color = "#f44336"; // Red - low attention
	}

	// Update combined chart
	if (combinedChart) {
		const timestamps = [];
		const stressData = [];
		const attentionData = [];

		// Use the minimum length of both arrays to ensure data alignment
		const dataPoints = Math.min(eyeTrackingData.length, heartRateData.length);

		for (let i = 0; i < dataPoints; i++) {
			const eyeIndex = eyeTrackingData.length - dataPoints + i;
			const heartIndex = heartRateData.length - dataPoints + i;

			const eyeData = eyeTrackingData[eyeIndex];
			const heartData = heartRateData[heartIndex];

			// Calculate metrics for each point
			const hrFactor = Math.max(0, Math.min(1, (heartData.bpm - 60) / 40));
			const blinkFactor = Math.min(eyeData.blinkRate / 20, 1);
			const stressValue = Math.round(
				(hrFactor * 0.7 + blinkFactor * 0.3) * 100
			);

			const gazeFactor = Math.min(eyeData.gazeDuration / 5, 1);
			const saccadeFactor = Math.max(0, 1 - eyeData.saccadeVelocity / 100);
			const attentionValue = Math.round(
				(gazeFactor * 0.6 + saccadeFactor * 0.4) * 100
			);

			// Create timestamp
			const time = new Date();
			time.setSeconds(time.getSeconds() - (dataPoints - i - 1) * 2);
			timestamps.push(
				time.toLocaleTimeString("en-US", {
					hour12: false,
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
				})
			);

			stressData.push(stressValue);
			attentionData.push(attentionValue);
		}

		combinedChart.data.labels = timestamps;
		combinedChart.data.datasets[0].data = stressData;
		combinedChart.data.datasets[1].data = attentionData;
		combinedChart.update();
	}
}

// Send biofeedback to the mobile device
function sendBiofeedback(type, message) {
	if (!pairedMobileId) {
		console.error("Cannot send feedback: no paired mobile device");
		return;
	}

	const feedback = {
		type,
		message,
		timestamp: new Date().toISOString(),
	};

	// Send feedback to paired mobile device
	if (useWebSocket && ws && ws.readyState === WebSocket.OPEN) {
		// Use the utility function from webSocketUtils.js with correct parameters
		sendBiofeedbackData(ws, pairedMobileId, feedback);
	} else if (socket && socket.connected) {
		socket.emit("biofeedback", {
			targetId: pairedMobileId,
			feedback,
		});
	}

	// Add to feedback history
	addToFeedbackHistory(feedback);
}

// Add feedback to the history display
function addToFeedbackHistory(feedback) {
	const historyList = document.getElementById("feedback-history-list");

	// Add to data array
	feedbackHistory.push(feedback);

	// Limit array size
	if (feedbackHistory.length > 50) {
		feedbackHistory.shift();
	}

	// Create list item
	const listItem = document.createElement("li");
	const time = new Date(feedback.timestamp).toLocaleTimeString();
	listItem.textContent = `[${time}] ${feedback.type}: ${feedback.message}`;

	// Style based on type
	if (feedback.type === "alert") {
		listItem.style.color = "#f44336";
	} else if (feedback.type === "instruction") {
		listItem.style.color = "#ff9800";
	} else {
		listItem.style.color = "#4caf50";
	}

	// Add to the list
	historyList.appendChild(listItem);

	// Limit list size
	while (historyList.children.length > 10) {
		historyList.removeChild(historyList.firstChild);
	}

	// Scroll to bottom
	historyList.scrollTop = historyList.scrollHeight;
}

// Reset all data when disconnecting
function resetData() {
	// Clear data arrays
	eyeTrackingData = [];
	heartRateData = [];

	// Reset charts
	if (eyeMovementChart) {
		eyeMovementChart.data.labels = [];
		eyeMovementChart.data.datasets.forEach((dataset) => {
			dataset.data = [];
		});
		eyeMovementChart.update();
	}

	if (heartRateChart) {
		heartRateChart.data.labels = [];
		heartRateChart.data.datasets.forEach((dataset) => {
			dataset.data = [];
		});
		heartRateChart.update();
	}

	if (combinedChart) {
		combinedChart.data.labels = [];
		combinedChart.data.datasets.forEach((dataset) => {
			dataset.data = [];
		});
		combinedChart.update();
	}

	// Reset metrics displays
	document.getElementById("blink-rate").textContent = "-- blinks/min";
	document.getElementById("gaze-duration").textContent = "-- seconds";
	document.getElementById("fatigue-index").textContent = "--";
	document.getElementById("current-hr").textContent = "-- BPM";
	document.getElementById("average-hr").textContent = "-- BPM";
	document.getElementById("hr-variability").textContent = "--";
	document.getElementById("stress-level").textContent = "--";
	document.getElementById("attention-score").textContent = "--";
}

// Update the connection status display
function updateConnectionStatus(message, status) {
	const statusElement = document.getElementById("laptop-connection-status");
	statusElement.textContent = message;
	statusElement.className = `status ${status}`;
}

// Helper function to calculate standard deviation
function calculateStandardDeviation(values) {
	const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
	const squareDiffs = values.map((value) => Math.pow(value - avg, 2));
	const avgSquareDiff =
		squareDiffs.reduce((sum, val) => sum + val, 0) / squareDiffs.length;
	return Math.sqrt(avgSquareDiff);
}

// Clean up resources when leaving the page
window.addEventListener("beforeunload", () => {
	if (socket) {
		socket.disconnect();
	}

	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.close();
	}
});
