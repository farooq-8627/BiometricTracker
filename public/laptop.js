// Global variables for laptop interface
let socket; // Socket.io socket
let ws; // WebSocket connection
let pairedMobileId = null;
let eyeMovementChart = null;
let heartRateChart = null;
let combinedChart = null;
let emotionChart = null; // New chart for emotions
let blinkChart = null; // New chart for blink detection
let eyeTrackingData = [];
let blinkData = []; // Store blink data separately
let heartRateData = [];
let emotionData = []; // New array for emotion data
let feedbackHistory = [];
let useWebSocket = true; // Flag to determine which connection to use
let totalBlinkCount = 0; // Track the cumulative blink count
let lastBlinkCount = 0; // Track the last blink count for change detection

// Initialize the laptop interface
function initializeLaptopInterface() {
	console.log("Initializing laptop interface...");

	// Try to establish WebSocket connection first
	try {
		ws = initializeWebSocket();
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
				console.log(
					"Received heart rate data via WebSocket from",
					sourceId,
					":",
					data
				);
				if (sourceId === pairedMobileId) {
					console.log("Processing heart rate data from paired mobile:", data);
					processHeartRateData(data);
				} else {
					console.warn(
						"Received heart rate data from unpaired device:",
						sourceId
					);
				}
			},
			onEmotionUpdate: (sourceId, data) => {
				console.log("Received emotion data:", { sourceId, data });
				if (sourceId === pairedMobileId) {
					processEmotionData(data);
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
	initializeEyeTrackingVisualization();
}

// Initialize eye tracking visualization with empty state
function initializeEyeTrackingVisualization() {
	const canvas = document.getElementById("eye-tracking-viz");
	if (!canvas) return;

	const ctx = canvas.getContext("2d");
	const width = canvas.width;
	const height = canvas.height;

	// Clear canvas
	ctx.clearRect(0, 0, width, height);

	// Draw empty grid
	drawBackgroundGrid(ctx, width, height);
	drawCoordinateSystem(ctx, width, height);
	drawGazeDirectionLabels(ctx, width, height);

	// Draw placeholder face
	const centerX = width / 2;
	const centerY = height / 2;
	const faceRadius = width * 0.15;

	// Face outline
	ctx.beginPath();
	ctx.ellipse(0, 0, faceRadius, faceRadius * 1.3, 0, 0, Math.PI * 2);
	ctx.strokeStyle = "#9090e0"; // Slightly brighter blue-purple
	ctx.lineWidth = 3; // Thicker outline
	ctx.stroke();

	// Add a subtle glow to the face outline
	ctx.save();
	ctx.beginPath();
	ctx.ellipse(0, 0, faceRadius + 2, faceRadius * 1.3 + 2, 0, 0, Math.PI * 2);
	ctx.strokeStyle = "rgba(144, 144, 224, 0.3)"; // Translucent blue-purple
	ctx.lineWidth = 6; // Wider for glow effect
	ctx.stroke();
	ctx.restore();

	// Draw eyes
	const eyeRadius = faceRadius * 0.2;
	const eyeOffsetX = faceRadius * 0.4;
	const eyeOffsetY = -faceRadius * 0.1;

	// Left eye
	ctx.beginPath();
	ctx.ellipse(
		-eyeOffsetX,
		eyeOffsetY,
		eyeRadius,
		eyeRadius * 0.6,
		0,
		0,
		Math.PI * 2
	);
	ctx.fillStyle = "#e8e8ff"; // Slightly brighter blue-lavender
	ctx.fill();
	ctx.strokeStyle = "#9090e0"; // Match face outline color
	ctx.lineWidth = 2;
	ctx.stroke();

	// Right eye
	ctx.beginPath();
	ctx.ellipse(
		eyeOffsetX,
		eyeOffsetY,
		eyeRadius,
		eyeRadius * 0.6,
		0,
		0,
		Math.PI * 2
	);
	ctx.fillStyle = "#e8e8ff"; // Slightly brighter blue-lavender
	ctx.fill();
	ctx.strokeStyle = "#9090e0"; // Match face outline color
	ctx.lineWidth = 2;
	ctx.stroke();

	// Display instructions
	ctx.font = "16px Arial";
	ctx.fillStyle = "#999";
	ctx.textAlign = "center";
	ctx.fillText(
		"Waiting for eye tracking data...",
		centerX,
		centerY + faceRadius * 2
	);
	ctx.textAlign = "left";

	// Display version info
	ctx.font = "10px Arial";
	ctx.fillStyle = "#999";
	ctx.textAlign = "right";
	ctx.fillText("Eye Tracking v1.0", width - 10, height - 10);
	ctx.textAlign = "left";
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
		console.log("Received heart rate update via Socket.IO:", data);

		// Process and display heart rate data
		if (data.sourceId === pairedMobileId) {
			console.log("Processing heart rate data from paired mobile", data.data);
			processHeartRateData(data.data);
		} else {
			console.warn(
				"Received heart rate data from unpaired device:",
				data.sourceId
			);
		}
	});

	// Add emotion update handler
	socket.on("emotion_update", (data) => {
		console.log("Received emotion data:", data);

		// Process and display emotion data
		if (data.sourceId === pairedMobileId) {
			processEmotionData(data.data);
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
	const commonChartOptions = {
		scales: {
			x: {
				grid: {
					color: "rgba(70, 70, 120, 0.3)", // Light color for grid lines
				},
				ticks: {
					color: "#b0b0d0", // Light blue-purple for ticks
				},
				title: {
					display: true,
					color: "#c0c0e0", // Light blue-purple color
				},
			},
			y: {
				grid: {
					color: "rgba(70, 70, 120, 0.3)", // Light color for grid lines
				},
				ticks: {
					color: "#b0b0d0", // Light blue-purple for ticks
				},
				title: {
					display: true,
					color: "#c0c0e0", // Light blue-purple color
				},
			},
		},
		plugins: {
			legend: {
				labels: {
					color: "#c0c0e0", // Light blue-purple color
				},
			},
		},
	};

	// Heart Rate Chart
	const heartRateChartCanvas = document.getElementById("heart-rate-chart");
	heartRateChart = new Chart(heartRateChartCanvas.getContext("2d"), {
		type: "line",
		data: {
			labels: Array(30).fill(""),
			datasets: [
				{
					label: "Heart Rate (BPM)",
					data: Array(30).fill(null),
					borderColor: "rgb(255, 99, 132)",
					backgroundColor: "rgba(255, 99, 132, 0.2)",
					borderWidth: 2,
					tension: 0.1,
					fill: true,
				},
			],
		},
		options: {
			...commonChartOptions,
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				...commonChartOptions.scales,
				y: {
					...commonChartOptions.scales.y,
					title: {
						...commonChartOptions.scales.y.title,
						text: "BPM",
					},
					min: 40,
					max: 140,
				},
				x: {
					...commonChartOptions.scales.x,
					title: {
						...commonChartOptions.scales.x.title,
						text: "Time",
					},
				},
			},
		},
	});

	// Eye Movement Chart
	const eyeMovementChartCanvas = document.getElementById("eye-movement-chart");
	eyeMovementChart = new Chart(eyeMovementChartCanvas.getContext("2d"), {
		type: "line",
		data: {
			labels: Array(30).fill(""),
			datasets: [
				{
					label: "Blink Rate",
					data: Array(30).fill(null),
					borderColor: "rgb(54, 162, 235)",
					backgroundColor: "rgba(54, 162, 235, 0.2)",
					borderWidth: 2,
					tension: 0.1,
					fill: true,
					yAxisID: "y",
				},
				{
					label: "Saccade Velocity",
					data: Array(30).fill(null),
					borderColor: "rgb(75, 192, 192)",
					backgroundColor: "rgba(75, 192, 192, 0.2)",
					borderWidth: 2,
					tension: 0.1,
					fill: true,
					yAxisID: "y1",
				},
			],
		},
		options: {
			...commonChartOptions,
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				y: {
					...commonChartOptions.scales.y,
					title: {
						...commonChartOptions.scales.y.title,
						text: "Blinks/min",
					},
					min: 0,
					max: 60,
				},
				y1: {
					...commonChartOptions.scales.y,
					position: "right",
					title: {
						...commonChartOptions.scales.y.title,
						text: "Velocity (px/s)",
					},
					min: 0,
					max: 500,
					grid: {
						drawOnChartArea: false, // only show grid for left axis
					},
				},
				x: {
					...commonChartOptions.scales.x,
					title: {
						...commonChartOptions.scales.x.title,
						text: "Time",
					},
				},
			},
		},
	});

	// Blink Chart
	const blinkChartCanvas = document.getElementById("blink-chart");
	blinkChart = new Chart(blinkChartCanvas.getContext("2d"), {
		type: "line",
		data: {
			labels: Array(100).fill(""),
			datasets: [
				{
					label: "Eye Aspect Ratio",
					data: Array(100).fill(null),
					borderColor: "rgb(153, 102, 255)",
					backgroundColor: "rgba(153, 102, 255, 0.2)",
					borderWidth: 2,
					tension: 0.1,
					fill: true,
					yAxisID: "y",
				},
				{
					label: "Blink Detection",
					data: Array(100).fill(null),
					borderColor: "rgb(255, 159, 64)",
					backgroundColor: "rgba(255, 159, 64, 0.2)",
					borderWidth: 2,
					tension: 0,
					fill: true,
					stepped: true,
					yAxisID: "y1",
				},
			],
		},
		options: {
			...commonChartOptions,
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				y: {
					...commonChartOptions.scales.y,
					title: {
						...commonChartOptions.scales.y.title,
						text: "EAR Value",
					},
					min: 0,
					max: 0.4,
				},
				y1: {
					...commonChartOptions.scales.y,
					position: "right",
					title: {
						...commonChartOptions.scales.y.title,
						text: "Blink State",
					},
					min: 0,
					max: 1,
					grid: {
						drawOnChartArea: false, // only show grid for left axis
					},
				},
				x: {
					...commonChartOptions.scales.x,
					title: {
						...commonChartOptions.scales.x.title,
						text: "Time",
					},
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

	// Set up emotion chart
	const emotionChartCtx = document
		.getElementById("emotion-chart")
		.getContext("2d");

	emotionChart = new Chart(emotionChartCtx, {
		type: "radar",
		data: {
			labels: [
				"Happy",
				"Sad",
				"Angry",
				"Fearful",
				"Disgusted",
				"Surprised",
				"Neutral",
			],
			datasets: [
				{
					label: "Confidence (%)",
					data: [0, 0, 0, 0, 0, 0, 0],
					backgroundColor: "rgba(132, 99, 255, 0.3)",
					borderColor: "rgba(132, 99, 255, 1)",
					pointBackgroundColor: "rgba(132, 99, 255, 1)",
					pointBorderColor: "#fff",
					pointHoverBackgroundColor: "#fff",
					pointHoverBorderColor: "rgba(132, 99, 255, 1)",
					pointRadius: 6,
					pointHoverRadius: 8,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				title: {
					display: true,
					text: "Emotion Analysis: neutral",
					font: {
						size: 16,
						weight: "bold",
					},
					padding: {
						top: 10,
						bottom: 10,
					},
				},
				legend: {
					display: false,
				},
				tooltip: {
					callbacks: {
						label: function (context) {
							return `Confidence: ${context.raw}%`;
						},
					},
				},
			},
			scales: {
				r: {
					angleLines: {
						display: true,
					},
					suggestedMin: 0,
					suggestedMax: 100,
					ticks: {
						stepSize: 25,
					},
					pointLabels: {
						font: {
							size: 14,
						},
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

// Process eye tracking data
function processEyeTrackingData(data) {
	// Add timestamp to the data
	const timestamp = Date.now();

	// Check for new blinks
	const newBlinkCount = data.blinkCount || 0;
	const blinkDelta = Math.max(0, newBlinkCount - lastBlinkCount);

	// Update the total blink count if there are new blinks
	if (blinkDelta > 0) {
		totalBlinkCount += blinkDelta;
		// Also update the incoming data to use our cumulative count
		data.blinkCount = totalBlinkCount;
		console.log(
			`Detected ${blinkDelta} new blinks. Total blinks: ${totalBlinkCount}`
		);
	}

	// Remember the last blink count
	lastBlinkCount = newBlinkCount;

	// Add data to tracking array
	eyeTrackingData.push({
		timestamp: timestamp,
		blinkRate: data.blinkRate || 0,
		blinkCount: totalBlinkCount,
		isBlinking: data.isBlinking || false,
		eyeAspectRatio: data.eyeAspectRatio || 0.3,
		saccadeVelocity: data.saccadeVelocity || 0,
		gazeDuration: data.gazeDuration || 0,
		gazeDirection: data.gazeDirection || { x: 0, y: 0 },
		pupilDiameter: data.pupilDiameter || 4.0,
		pupilDilationPercent: data.pupilDilationPercent || 50,
		headDirection: data.headDirection || { pitch: 0, yaw: 0, roll: 0 },
		headPosition: data.headPosition || { x: 0, y: 0, z: 0 },
	});

	// Keep only the last 100 data points
	if (eyeTrackingData.length > 100) {
		eyeTrackingData.shift();
	}

	// Add to blink data for blink chart
	blinkData.push({
		timestamp: timestamp,
		eyeAspectRatio: data.eyeAspectRatio || 0.3,
		isBlinking: data.isBlinking ? 1 : 0, // 1 when blinking, 0 when not
	});

	// Keep only the most recent 50 blink data points
	if (blinkData.length > 50) {
		blinkData.shift();
	}

	// Update metrics display
	updateEyeTrackingMetrics({
		...data,
		blinkCount: totalBlinkCount,
	});

	// Update the real-time visualization
	renderEyeTrackingVisualization(data);

	// Update charts
	if (eyeMovementChart) {
		const labels = eyeTrackingData.map((d) =>
			new Date(d.timestamp).toLocaleTimeString()
		);

		eyeMovementChart.data.labels = labels;
		eyeMovementChart.data.datasets[0].data = eyeTrackingData.map(
			(d) => d.blinkRate
		);
		eyeMovementChart.data.datasets[1].data = eyeTrackingData.map(
			(d) => d.saccadeVelocity
		);

		eyeMovementChart.update();
	}

	// Update blink chart
	if (blinkChart) {
		const labels = blinkData.map((d) =>
			new Date(d.timestamp).toLocaleTimeString()
		);

		blinkChart.data.labels = labels;
		blinkChart.data.datasets[0].data = blinkData.map((d) => d.eyeAspectRatio);
		blinkChart.data.datasets[1].data = blinkData.map((d) => d.isBlinking);

		// Update the threshold line in the background
		blinkChart.options.plugins.annotation = {
			annotations: {
				thresholdLine: {
					type: "line",
					yMin: 0.25, // Match the threshold in eyeTracking.js
					yMax: 0.25,
					borderColor: "rgba(255, 0, 0, 0.5)",
					borderWidth: 2,
					borderDash: [5, 5],
					label: {
						content: "Blink Threshold",
						position: "start",
						backgroundColor: "rgba(255, 0, 0, 0.5)",
						font: {
							size: 10,
						},
					},
				},
			},
		};

		blinkChart.update();
	}

	// Update combined metrics
	updateCombinedMetrics();
}

// Render eye tracking visualization
function renderEyeTrackingVisualization(data) {
	const canvas = document.getElementById("eye-tracking-viz");
	if (!canvas) return;

	const ctx = canvas.getContext("2d");
	const width = canvas.width;
	const height = canvas.height;

	// Clear canvas
	ctx.clearRect(0, 0, width, height);

	// Draw background grid
	drawBackgroundGrid(ctx, width, height);

	// Center coordinates
	const centerX = width / 2;
	const centerY = height / 2;

	// Draw face outline
	const faceRadius = width * 0.15;

	// Apply head position offset
	const headX = centerX + (data.headPosition?.x || 0) * 20;
	const headY = centerY + (data.headPosition?.y || 0) * 20;

	// Draw head with rotation
	ctx.save();
	ctx.translate(headX, headY);
	ctx.rotate(((data.headDirection?.roll || 0) * Math.PI) / 180);

	// Face outline with glow effect
	ctx.beginPath();
	ctx.ellipse(0, 0, faceRadius, faceRadius * 1.3, 0, 0, Math.PI * 2);
	ctx.strokeStyle = "#9090e0"; // Slightly brighter blue-purple
	ctx.lineWidth = 3; // Thicker outline
	ctx.stroke();

	// Add a subtle glow to the face outline
	ctx.beginPath();
	ctx.ellipse(0, 0, faceRadius + 2, faceRadius * 1.3 + 2, 0, 0, Math.PI * 2);
	ctx.strokeStyle = "rgba(144, 144, 224, 0.3)"; // Translucent blue-purple
	ctx.lineWidth = 6; // Wider for glow effect
	ctx.stroke();

	// Draw eyes
	const eyeRadius = faceRadius * 0.2;
	const eyeOffsetX = faceRadius * 0.4;
	const eyeOffsetY = -faceRadius * 0.1;

	// Left eye
	ctx.beginPath();
	ctx.ellipse(
		-eyeOffsetX,
		eyeOffsetY,
		eyeRadius,
		eyeRadius * 0.6,
		0,
		0,
		Math.PI * 2
	);
	ctx.fillStyle = "#e8e8ff"; // Slightly brighter blue-lavender
	ctx.fill();
	ctx.strokeStyle = "#9090e0"; // Match face outline color
	ctx.lineWidth = 2;
	ctx.stroke();

	// Right eye
	ctx.beginPath();
	ctx.ellipse(
		eyeOffsetX,
		eyeOffsetY,
		eyeRadius,
		eyeRadius * 0.6,
		0,
		0,
		Math.PI * 2
	);
	ctx.fillStyle = "#e8e8ff"; // Slightly brighter blue-lavender
	ctx.fill();
	ctx.strokeStyle = "#9090e0"; // Match face outline color
	ctx.lineWidth = 2;
	ctx.stroke();

	// Calculate pupil size based on dilation percentage
	const pupilDilationPercent = data.pupilDilationPercent || 50;
	const minPupilSize = eyeRadius * 0.3;
	const maxPupilSize = eyeRadius * 0.8;
	const pupilSize =
		minPupilSize + (maxPupilSize - minPupilSize) * (pupilDilationPercent / 100);

	// Calculate pupil positions based on gaze direction
	const gazeX = data.gazeDirection?.x || 0;
	const gazeY = data.gazeDirection?.y || 0;
	const maxGazeOffset = eyeRadius * 0.5;

	const leftPupilX = -eyeOffsetX + gazeX * maxGazeOffset;
	const rightPupilX = eyeOffsetX + gazeX * maxGazeOffset;
	const pupilY = eyeOffsetY + gazeY * maxGazeOffset;

	// Draw pupils
	ctx.fillStyle = "#404080"; // Darker blue-purple
	ctx.beginPath();
	ctx.arc(leftPupilX, pupilY, pupilSize, 0, Math.PI * 2);
	ctx.fill();

	ctx.beginPath();
	ctx.arc(rightPupilX, pupilY, pupilSize, 0, Math.PI * 2);
	ctx.fill();

	// Add a highlight to each pupil for more visibility
	const highlightSize = pupilSize * 0.3;
	const highlightOffsetX = pupilSize * 0.2;
	const highlightOffsetY = pupilSize * 0.2;

	ctx.fillStyle = "rgba(255, 255, 255, 0.6)";

	// Left pupil highlight
	ctx.beginPath();
	ctx.arc(
		leftPupilX - highlightOffsetX,
		pupilY - highlightOffsetY,
		highlightSize,
		0,
		Math.PI * 2
	);
	ctx.fill();

	// Right pupil highlight
	ctx.beginPath();
	ctx.arc(
		rightPupilX - highlightOffsetX,
		pupilY - highlightOffsetY,
		highlightSize,
		0,
		Math.PI * 2
	);
	ctx.fill();

	// Draw mouth based on head position (simple visual feedback)
	const mouthWidth = faceRadius * 0.5;
	const mouthHeight = faceRadius * 0.1;
	const mouthY = faceRadius * 0.4;

	ctx.beginPath();
	ctx.moveTo(-mouthWidth / 2, mouthY);
	ctx.quadraticCurveTo(0, mouthY + mouthHeight, mouthWidth / 2, mouthY);
	ctx.strokeStyle = "#9090e0"; // Slightly brighter blue-purple
	ctx.lineWidth = 2;
	ctx.stroke();

	// Draw nose
	ctx.beginPath();
	ctx.moveTo(0, eyeOffsetY + eyeRadius * 2);
	ctx.lineTo(-faceRadius * 0.1, faceRadius * 0.25);
	ctx.lineTo(faceRadius * 0.1, faceRadius * 0.25);
	ctx.closePath();
	ctx.stroke();

	ctx.restore();

	// Draw gaze direction vector
	const gazeLength = Math.min(width, height) * 0.2;

	// Create a glow effect for the gaze vector
	ctx.shadowColor = "rgba(255, 255, 80, 0.6)";
	ctx.shadowBlur = 8;

	ctx.beginPath();
	ctx.moveTo(centerX, centerY);
	ctx.lineTo(centerX + gazeX * gazeLength, centerY + gazeY * gazeLength);
	ctx.strokeStyle = "#ffff80"; // Brighter yellow
	ctx.lineWidth = 3; // Thicker line
	ctx.stroke();

	// Draw arrow head
	const arrowSize = 12; // Slightly larger arrow head
	const angle = Math.atan2(gazeY, gazeX);
	const arrowX = centerX + gazeX * gazeLength;
	const arrowY = centerY + gazeY * gazeLength;

	ctx.beginPath();
	ctx.moveTo(arrowX, arrowY);
	ctx.lineTo(
		arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
		arrowY - arrowSize * Math.sin(angle - Math.PI / 6)
	);
	ctx.lineTo(
		arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
		arrowY - arrowSize * Math.sin(angle + Math.PI / 6)
	);
	ctx.closePath();
	ctx.fillStyle = "#ffff80"; // Brighter yellow
	ctx.fill();

	// Reset shadow
	ctx.shadowColor = "transparent";
	ctx.shadowBlur = 0;

	// Draw reference coordinate system
	drawCoordinateSystem(ctx, width, height);

	// Draw gaze direction labels
	drawGazeDirectionLabels(ctx, width, height);

	// Update text metrics
	updateEyeTrackingTextMetrics(data);
}

// Draw background grid
function drawBackgroundGrid(ctx, canvasWidth, canvasHeight) {
	// Draw grid lines
	ctx.strokeStyle = "#3a3a5a"; // Lighter blue-purple color
	ctx.lineWidth = 1;

	// Grid spacing
	const gridSpacing = 50;

	// Draw horizontal grid lines
	for (let y = 0; y < canvasHeight; y += gridSpacing) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(canvasWidth, y);
		ctx.stroke();
	}

	// Draw vertical grid lines
	for (let x = 0; x < canvasWidth; x += gridSpacing) {
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, canvasHeight);
		ctx.stroke();
	}

	// Draw center lines (x and y axis)
	const centerX = canvasWidth / 2;
	const centerY = canvasHeight / 2;

	// Center lines
	ctx.strokeStyle = "#7070a0"; // Lighter blue-purple color
	ctx.lineWidth = 2;

	// Draw x-axis
	ctx.beginPath();
	ctx.moveTo(0, centerY);
	ctx.lineTo(canvasWidth, centerY);
	ctx.stroke();

	// Draw y-axis
	ctx.beginPath();
	ctx.moveTo(centerX, 0);
	ctx.lineTo(centerX, canvasHeight);
	ctx.stroke();

	// Draw x and y axis with colors
	ctx.lineWidth = 3;

	// X-axis (red)
	ctx.strokeStyle = "#ff6b6b"; // Brighter red
	ctx.beginPath();
	ctx.moveTo(centerX, centerY);
	ctx.lineTo(centerX + 100, centerY);
	ctx.stroke();

	// Y-axis (green)
	ctx.strokeStyle = "#6bff6b"; // Brighter green
	ctx.beginPath();
	ctx.moveTo(centerX, centerY);
	ctx.lineTo(centerX, centerY - 100);
	ctx.stroke();

	// Add axis labels
	ctx.font = "12px Arial";
	ctx.fillStyle = "#ff6b6b"; // Match X-axis color
	ctx.fillText("X", centerX + 105, centerY - 5);

	ctx.fillStyle = "#6bff6b"; // Match Y-axis color
	ctx.fillText("Y", centerX + 5, centerY - 105);

	// Add gaze direction labels
	ctx.fillStyle = "#ccccff"; // Light purple-blue
	ctx.fillText("Left", 20, centerY - 10);
	ctx.fillText("Right", canvasWidth - 50, centerY - 10);
	ctx.fillText("Up", centerX + 10, 20);
	ctx.fillText("Down", centerX + 10, canvasHeight - 10);
}

// Draw coordinate system for reference
function drawCoordinateSystem(ctx, width, height) {
	const centerX = width / 2;
	const centerY = height / 2;
	const axisLength = 40; // Longer axes for better visibility

	// Draw a background circle at the origin for emphasis
	ctx.beginPath();
	ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
	ctx.fillStyle = "rgba(40, 48, 56, 0.7)";
	ctx.fill();

	// X-axis (red)
	ctx.beginPath();
	ctx.moveTo(centerX, centerY);
	ctx.lineTo(centerX + axisLength, centerY);
	ctx.strokeStyle = "#ff6b6b"; // Brighter red
	ctx.lineWidth = 2;
	ctx.stroke();

	// X-axis arrow
	ctx.beginPath();
	ctx.moveTo(centerX + axisLength, centerY);
	ctx.lineTo(centerX + axisLength - 5, centerY - 3);
	ctx.lineTo(centerX + axisLength - 5, centerY + 3);
	ctx.closePath();
	ctx.fillStyle = "#ff6b6b"; // Brighter red
	ctx.fill();

	// X-axis label with background
	ctx.fillStyle = "#283038"; // Dark background
	ctx.beginPath();
	ctx.rect(centerX + axisLength + 1, centerY + 1, 14, 16);
	ctx.fill();

	ctx.fillStyle = "#ff6b6b"; // Brighter red
	ctx.font = "bold 14px Arial"; // Increased font size and made bold
	ctx.fillText("X", centerX + axisLength + 4, centerY + 14);

	// Y-axis (green)
	ctx.beginPath();
	ctx.moveTo(centerX, centerY);
	ctx.lineTo(centerX, centerY - axisLength);
	ctx.strokeStyle = "#6bff6b"; // Brighter green
	ctx.lineWidth = 2;
	ctx.stroke();

	// Y-axis arrow
	ctx.beginPath();
	ctx.moveTo(centerX, centerY - axisLength);
	ctx.lineTo(centerX - 3, centerY - axisLength + 5);
	ctx.lineTo(centerX + 3, centerY - axisLength + 5);
	ctx.closePath();
	ctx.fillStyle = "#6bff6b"; // Brighter green
	ctx.fill();

	// Y-axis label with background
	ctx.fillStyle = "#283038"; // Dark background
	ctx.beginPath();
	ctx.rect(centerX + 1, centerY - axisLength - 17, 14, 16);
	ctx.fill();

	ctx.fillStyle = "#6bff6b"; // Brighter green
	ctx.font = "bold 14px Arial"; // Increased font size and made bold
	ctx.fillText("Y", centerX + 4, centerY - axisLength - 4);
}

// Draw gaze direction labels around the edge
function drawGazeDirectionLabels(ctx, width, height) {
	const centerX = width / 2;
	const centerY = height / 2;

	ctx.font = "bold 14px Arial"; // Increased font size and made bold
	ctx.fillStyle = "#ffffff"; // White for better visibility
	ctx.textAlign = "center";

	// Add background rectangles for better visibility
	const labelPadding = 4;
	const labelHeight = 20;
	const labelWidth = 50;

	// Top background - "Up"
	ctx.fillStyle = "rgba(40, 48, 56, 0.7)"; // Semi-transparent dark background
	ctx.beginPath();
	ctx.rect(centerX - labelWidth / 2, 5, labelWidth, labelHeight);
	ctx.fill();

	// Bottom background - "Down"
	ctx.beginPath();
	ctx.rect(
		centerX - labelWidth / 2,
		height - labelHeight - 5,
		labelWidth,
		labelHeight
	);
	ctx.fill();

	// Left background - "Left"
	ctx.beginPath();
	ctx.rect(5, centerY - labelHeight / 2, labelWidth, labelHeight);
	ctx.fill();

	// Right background - "Right"
	ctx.beginPath();
	ctx.rect(
		width - labelWidth - 5,
		centerY - labelHeight / 2,
		labelWidth,
		labelHeight
	);
	ctx.fill();

	// Draw text in bright color
	ctx.fillStyle = "#92d9ff"; // Bright blue for better visibility

	// Top - "Up"
	ctx.textAlign = "center";
	ctx.fillText("Up", centerX, 20);

	// Bottom - "Down"
	ctx.textAlign = "center";
	ctx.fillText("Down", centerX, height - 10);

	// Left - "Left"
	ctx.textAlign = "left";
	ctx.fillText("Left", 10, centerY + 5);

	// Right - "Right"
	ctx.textAlign = "right";
	ctx.fillText("Right", width - 10, centerY + 5);

	// Reset text alignment
	ctx.textAlign = "left";
}

// Update text metrics for eye tracking
function updateEyeTrackingTextMetrics(data) {
	// Update gaze direction text
	const gazeDirectionEl = document.getElementById("gaze-direction");
	if (gazeDirectionEl) {
		gazeDirectionEl.style.color = "#ffffff"; // Set to white for visibility
		const gazeX = data.gazeDirection?.x || 0;
		const gazeY = data.gazeDirection?.y || 0;
		gazeDirectionEl.textContent = `x: ${gazeX.toFixed(2)}, y: ${gazeY.toFixed(
			2
		)}`;
	}

	// Update gaze text description
	const gazeTextEl = document.getElementById("gaze-text");
	if (gazeTextEl) {
		gazeTextEl.style.color = "#ffffff"; // Set to white for visibility
		const gazeX = data.gazeDirection?.x || 0;
		const gazeY = data.gazeDirection?.y || 0;

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

		gazeTextEl.textContent = gazeDescription;
	}

	// Update pupil diameter
	const pupilDiameterEl = document.getElementById("pupil-diameter");
	if (pupilDiameterEl) {
		pupilDiameterEl.style.color = "#ffffff"; // Set to white for visibility
		const diameter = data.pupilDiameter || 0;
		const dilationPercent = data.pupilDilationPercent || 0;
		pupilDiameterEl.textContent = `${diameter.toFixed(
			1
		)}px (${dilationPercent.toFixed(0)}%)`;
	}

	// Update head rotation
	const headRotationEl = document.getElementById("head-rotation");
	if (headRotationEl) {
		headRotationEl.style.color = "#ffffff"; // Set to white for visibility
		const pitch = data.headDirection?.pitch || 0;
		const yaw = data.headDirection?.yaw || 0;
		const roll = data.headDirection?.roll || 0;
		headRotationEl.textContent = `P: ${pitch.toFixed(1)}° Y: ${yaw.toFixed(
			1
		)}° R: ${roll.toFixed(1)}°`;
	}

	// Update head movement
	const headMovementEl = document.getElementById("head-movement");
	if (headMovementEl) {
		headMovementEl.style.color = "#ffffff"; // Set to white for visibility
		const x = data.headPosition?.x || 0;
		const y = data.headPosition?.y || 0;
		const z = data.headPosition?.z || 0;
		headMovementEl.textContent = `x: ${x.toFixed(2)}, y: ${y.toFixed(
			2
		)}, z: ${z.toFixed(2)}`;
	}
}

// Update eye tracking metrics based on latest data
function updateEyeTrackingMetrics(latestData) {
	if (eyeTrackingData.length === 0) return;

	// Calculate metrics
	const blinkRateElement = document.getElementById("blink-rate");
	const blinkCountElement = document.getElementById("blink-count");
	const gazeDurationElement = document.getElementById("gaze-duration");
	const fatigueIndexElement = document.getElementById("fatigue-index");

	// Set defaults to white for better visibility
	if (blinkRateElement) blinkRateElement.style.color = "#ffffff";
	if (blinkCountElement) blinkCountElement.style.color = "#ffffff";
	if (gazeDurationElement) gazeDurationElement.style.color = "#ffffff";
	if (fatigueIndexElement) fatigueIndexElement.style.color = "#ffffff";

	// Use the latest data for current metrics
	blinkRateElement.textContent = `${latestData.blinkRate.toFixed(
		1
	)} blinks/min`;

	// Update blink count with visual feedback when it changes
	if (blinkCountElement) {
		const currentCount = latestData.blinkCount || 0;
		const prevDisplayedCount = parseInt(
			blinkCountElement.getAttribute("data-count") || "0"
		);

		// Update the displayed count
		blinkCountElement.textContent = `${currentCount} blinks`;
		blinkCountElement.setAttribute("data-count", currentCount);

		// Add visual feedback if the count increased
		if (currentCount > prevDisplayedCount) {
			// Add a class for animation
			blinkCountElement.classList.add("blink-count-updated");

			// Remove the class after the animation completes
			setTimeout(() => {
				blinkCountElement.classList.remove("blink-count-updated");
			}, 1000);
		}
	}

	gazeDurationElement.textContent = `${latestData.gazeDuration.toFixed(
		1
	)} seconds`;

	// Calculate fatigue index based on blink rate and gaze duration
	// Higher blink rate and shorter gaze duration indicate higher fatigue
	const blinkFactor = Math.min(latestData.blinkRate / 20, 1); // Normalize to 0-1 (20 blinks/min is high)
	const gazeFactor = Math.max(1 - latestData.gazeDuration / 5, 0); // Normalize to 0-1 (5+ seconds is good concentration)
	const fatigueIndex = Math.round((blinkFactor * 0.6 + gazeFactor * 0.4) * 100);

	fatigueIndexElement.textContent = fatigueIndex.toString();

	// Color-code the fatigue index based on value
	if (fatigueIndex < 30) {
		fatigueIndexElement.style.color = "#4caf50"; // Green - low fatigue
	} else if (fatigueIndex < 70) {
		fatigueIndexElement.style.color = "#ff9800"; // Orange - moderate fatigue
	} else {
		fatigueIndexElement.style.color = "#f44336"; // Red - high fatigue
	}

	// Add blink indicator animation if a blink was just detected or if currently blinking
	const blinkIndicator = document.getElementById("blink-indicator");
	if (blinkIndicator) {
		// Log blink status for debugging
		console.log(
			`Blink data: isBlinking=${latestData.isBlinking}, blinkJustDetected=${
				latestData.blinkJustDetected
			}, EAR=${latestData.eyeAspectRatio?.toFixed(2)}`
		);

		// Check if the blink was just detected or if currently blinking
		if (latestData.blinkJustDetected || latestData.isBlinking) {
			console.log("BLINK DETECTED - Updating indicator");
			// Add animation class
			blinkIndicator.classList.add("blink-detected");

			// For a continuous effect during blinking, only set timeout if it was a new blink
			if (latestData.blinkJustDetected) {
				// Remove class after animation completes
				setTimeout(() => {
					if (
						!document
							.getElementById("blink-indicator")
							.classList.contains("blink-detected")
					)
						return;
					blinkIndicator.classList.remove("blink-detected");
				}, 1000);
			}
		} else if (!latestData.isBlinking) {
			// If not blinking, ensure the class is removed
			blinkIndicator.classList.remove("blink-detected");
		}
	}
}

// Process heart rate data from the mobile device
function processHeartRateData(data) {
	console.log("Processing heart rate data:", data);

	// Validate data
	if (!data || typeof data.bpm !== "number") {
		console.error("Invalid heart rate data received:", data);
		return;
	}

	// Add timestamp if not provided
	if (!data.timestamp) {
		data.timestamp = Date.now();
	}

	// Add to data array
	heartRateData.push(data);
	console.log(
		`Added heart rate data point: ${data.bpm} BPM, confidence: ${
			data.confidence || "N/A"
		}`
	);

	// Limit the data array size
	if (heartRateData.length > 30) {
		// Last 30 data points (1 minute at 0.5 Hz)
		heartRateData.shift();
	}

	// Debug check if chart exists
	if (!heartRateChart) {
		console.error("Heart rate chart not initialized - attempting to fix");
		setupHeartRateChart();
	}

	// Update heart rate chart with new data point
	updateHeartRateChart();

	// Update heart rate metrics
	updateHeartRateMetrics();

	// Update combined metrics
	updateCombinedMetrics();
}

// Separate function to update the heart rate chart
function updateHeartRateChart() {
	// Check if chart exists
	if (!heartRateChart) {
		console.error("Heart rate chart still not available");
		return;
	}

	try {
		// Create timestamps for x-axis
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

		console.log(
			"Updating heart rate chart with data points:",
			heartRateData.length
		);
		console.log(
			"Latest BPM:",
			heartRateData.length > 0
				? heartRateData[heartRateData.length - 1].bpm
				: "None"
		);

		// Update chart data
		heartRateChart.data.labels = timestamps;
		heartRateChart.data.datasets[0].data = heartRateData.map((d) => d.bpm);

		// Update chart
		heartRateChart.update();
		console.log("Heart rate chart updated successfully");
	} catch (error) {
		console.error("Error updating heart rate chart:", error);
	}
}

// Setup heart rate chart if it wasn't initialized properly
function setupHeartRateChart() {
	try {
		const heartRateCtx = document.getElementById("heart-rate-chart");
		if (!heartRateCtx) {
			console.error("Cannot find heart-rate-chart element");
			return;
		}

		// Check if we can get the 2D context
		const ctx = heartRateCtx.getContext("2d");
		if (!ctx) {
			console.error("Cannot get 2D context for heart rate chart");
			return;
		}

		// Create new chart
		heartRateChart = new Chart(ctx, {
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
		console.log("Heart rate chart re-initialized successfully");
	} catch (error) {
		console.error("Error setting up heart rate chart:", error);
	}
}

// Update heart rate metrics display
function updateHeartRateMetrics() {
	if (heartRateData.length === 0) {
		console.warn("No heart rate data available to update metrics");
		return;
	}

	// Calculate metrics
	const currentHRElement = document.getElementById("current-hr");
	const averageHRElement = document.getElementById("average-hr");
	const hrVariabilityElement = document.getElementById("hr-variability");

	if (!currentHRElement || !averageHRElement || !hrVariabilityElement) {
		console.error("Missing heart rate metric elements in the DOM");
		return;
	}

	// Set default colors to white for better visibility
	currentHRElement.style.color = "#ffffff";
	averageHRElement.style.color = "#ffffff";
	hrVariabilityElement.style.color = "#ffffff";

	// Current heart rate (latest data point)
	const currentHR = heartRateData[heartRateData.length - 1].bpm;
	currentHRElement.textContent = `${Math.round(currentHR)} BPM`;
	console.log(`Updated current heart rate: ${Math.round(currentHR)} BPM`);

	// Average heart rate
	const avgHR =
		heartRateData.reduce((sum, data) => sum + data.bpm, 0) /
		heartRateData.length;
	averageHRElement.textContent = `${Math.round(avgHR)} BPM`;
	console.log(`Updated average heart rate: ${Math.round(avgHR)} BPM`);

	// Heart rate variability (standard deviation)
	if (heartRateData.length > 1) {
		const hrValues = heartRateData.map((d) => d.bpm);
		const hrVariability = calculateStandardDeviation(hrValues);
		hrVariabilityElement.textContent = hrVariability.toFixed(1);
		console.log(`Updated HRV: ${hrVariability.toFixed(1)}`);

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

	// Set default colors to white for better visibility
	stressLevelElement.style.color = "#ffffff";
	attentionScoreElement.style.color = "#ffffff";

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

	// Set color based on stress level - only if we have valid data
	if (stressLevel > 0) {
		if (stressLevel < 30) {
			stressLevelElement.style.color = "#4caf50"; // Green - low stress
		} else if (stressLevel < 70) {
			stressLevelElement.style.color = "#ff9800"; // Orange - moderate stress
		} else {
			stressLevelElement.style.color = "#f44336"; // Red - high stress
		}
	}

	// Calculate attention score (0-100)
	// Longer gaze duration and lower saccade velocity indicate higher attention
	const gazeFactor = Math.min(latestEyeData.gazeDuration / 5, 1); // Normalize to 0-1
	const saccadeFactor = Math.max(0, 1 - latestEyeData.saccadeVelocity / 100); // Normalize to 0-1
	const attentionScore = Math.round(
		(gazeFactor * 0.6 + saccadeFactor * 0.4) * 100
	);

	attentionScoreElement.textContent = attentionScore.toString();

	// Set color based on attention score - only if we have valid data
	if (attentionScore > 0) {
		if (attentionScore > 70) {
			attentionScoreElement.style.color = "#4caf50"; // Green - high attention
		} else if (attentionScore > 30) {
			attentionScoreElement.style.color = "#ff9800"; // Orange - moderate attention
		} else {
			attentionScoreElement.style.color = "#f44336"; // Red - low attention
		}
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

// Reset all data including emotion data
function resetData() {
	eyeTrackingData = [];
	blinkData = []; // Reset blink data
	heartRateData = [];
	emotionData = []; // Reset emotion data
	totalBlinkCount = 0; // Reset total blink count
	lastBlinkCount = 0; // Reset last blink count

	// Reset charts and visualizations
	if (eyeMovementChart) {
		eyeMovementChart.data.labels = [];
		eyeMovementChart.data.datasets[0].data = [];
		eyeMovementChart.data.datasets[1].data = [];
		eyeMovementChart.update();
	}

	if (blinkChart) {
		blinkChart.data.labels = [];
		blinkChart.data.datasets[0].data = [];
		blinkChart.data.datasets[1].data = [];
		blinkChart.update();
	}

	if (heartRateChart) {
		heartRateChart.data.labels = [];
		heartRateChart.data.datasets[0].data = [];
		heartRateChart.update();
	}

	if (emotionChart) {
		emotionChart.data.datasets[0].data = [0, 0, 0, 0, 0, 0, 0];
		emotionChart.options.plugins.title.text = "Emotion Analysis";
		emotionChart.update();
	}

	if (combinedChart) {
		combinedChart.data.labels = [];
		combinedChart.data.datasets[0].data = [];
		combinedChart.data.datasets[1].data = [];
		combinedChart.update();
	}

	// Clear eye tracking visualization
	initializeEyeTrackingVisualization();

	// Reset metrics
	document.getElementById("blink-rate").textContent = "-- blinks/min";
	document.getElementById("blink-count").textContent = "-- blinks";
	// Reset the data-count attribute as well
	document.getElementById("blink-count").setAttribute("data-count", "0");
	document.getElementById("gaze-duration").textContent = "-- seconds";
	document.getElementById("fatigue-index").textContent = "--";
	document.getElementById("current-hr").textContent = "-- BPM";
	document.getElementById("average-hr").textContent = "-- BPM";
	document.getElementById("hr-variability").textContent = "--";
	document.getElementById("current-emotion").textContent = "--";
	document.getElementById("emotion-confidence").textContent = "--%";
	document.getElementById("stress-level").textContent = "--";
	document.getElementById("attention-score").textContent = "--";
	document.getElementById("gaze-direction").textContent = "x: --, y: --";
	document.getElementById("gaze-text").textContent = "Looking --";
	document.getElementById("pupil-diameter").textContent = "-- px (--)";
	document.getElementById("head-rotation").textContent = "P: --° Y: --° R: --°";
	document.getElementById("head-movement").textContent = "x: --, y: --, z: --";
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

// Process emotion data from the mobile device
function processEmotionData(data) {
	console.log("Processing emotion data:", data);

	// Validate data
	if (!data) {
		console.error("Invalid emotion data received:", data);
		return;
	}

	// Add timestamp if not provided
	if (!data.timestamp) {
		data.timestamp = Date.now();
	}

	// Add to data array
	emotionData.push(data);
	console.log(`Added emotion data point. Dominant: ${data.dominant || "None"}`);

	// Limit the data array size
	if (emotionData.length > 30) {
		emotionData.shift();
	}

	// Debug check if chart exists
	if (!emotionChart) {
		console.error("Emotion chart not initialized - attempting to fix");
		setupEmotionChart();
	}

	// Update emotion chart with new data
	updateEmotionChart(data);

	// Update emotion metrics display
	updateEmotionMetrics(data);

	// Check if Combined Metrics need update
	updateCombinedMetrics();
}

// Update the emotion chart with new data
function updateEmotionChart(data) {
	console.log("updateEmotionChart called with data:", JSON.stringify(data));

	if (!emotionChart) {
		console.error("Emotion chart not initialized!");

		// Try to check if the element exists
		const emotionChartElement = document.getElementById("emotion-chart");
		if (!emotionChartElement) {
			console.error("Element with ID 'emotion-chart' not found in DOM!");
		} else {
			console.log("Element exists but chart not initialized");
			setupEmotionChart();
		}
		return;
	}

	try {
		// Ensure we have valid data
		if (!data || !data.dominant) {
			console.error("No valid emotion data available");
			return;
		}

		// Set single dominant emotion instead of using radar chart with multiple values
		const dominantEmotion = data.dominant;
		const dominantScore = data.dominantScore || 0;
		const confidencePercent = Math.round(dominantScore * 100);

		// Clear previous data and set only the dominant emotion
		const emotionsList = [
			"happy",
			"sad",
			"angry",
			"fearful",
			"disgusted",
			"surprised",
			"neutral",
		];
		const newData = emotionsList.map((emotion) => {
			// Set the dominant emotion to its score, zero for others
			return emotion === dominantEmotion.toLowerCase() ? confidencePercent : 0;
		});

		emotionChart.data.datasets[0].data = newData;

		// Make the title more descriptive with the confidence percentage
		emotionChart.options.plugins.title.text = `Emotion Analysis: ${dominantEmotion} (${confidencePercent}%)`;

		// Update the chart
		emotionChart.update();
		console.log(
			`Emotion chart updated to show ${dominantEmotion} (${confidencePercent}%)`
		);
	} catch (error) {
		console.error("Error updating emotion chart:", error);
	}
}

// Setup emotion chart if it wasn't initialized properly
function setupEmotionChart() {
	try {
		const emotionCtx = document.getElementById("emotion-chart");
		if (!emotionCtx) {
			console.error("Cannot find emotion-chart element");
			return;
		}

		// Check if we can get the 2D context
		const ctx = emotionCtx.getContext("2d");
		if (!ctx) {
			console.error("Cannot get 2D context for emotion chart");
			return;
		}

		// Create new chart
		emotionChart = new Chart(ctx, {
			type: "radar",
			data: {
				labels: [
					"Happy",
					"Sad",
					"Angry",
					"Fearful",
					"Disgusted",
					"Surprised",
					"Neutral",
				],
				datasets: [
					{
						label: "Confidence (%)",
						data: [0, 0, 0, 0, 0, 0, 0],
						backgroundColor: "rgba(132, 99, 255, 0.3)",
						borderColor: "rgba(132, 99, 255, 1)",
						pointBackgroundColor: "rgba(132, 99, 255, 1)",
						pointBorderColor: "#fff",
						pointHoverBackgroundColor: "#fff",
						pointHoverBorderColor: "rgba(132, 99, 255, 1)",
						pointRadius: 6,
						pointHoverRadius: 8,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: {
						display: true,
						text: "Emotion Analysis: neutral",
						font: {
							size: 16,
							weight: "bold",
						},
						padding: {
							top: 10,
							bottom: 10,
						},
					},
					legend: {
						display: false,
					},
					tooltip: {
						callbacks: {
							label: function (context) {
								return `Confidence: ${context.raw}%`;
							},
						},
					},
				},
				scales: {
					r: {
						angleLines: {
							display: true,
						},
						suggestedMin: 0,
						suggestedMax: 100,
						ticks: {
							stepSize: 25,
						},
						pointLabels: {
							font: {
								size: 14,
							},
						},
					},
				},
			},
		});
		console.log("Emotion chart initialized successfully");
	} catch (error) {
		console.error("Error setting up emotion chart:", error);
	}
}

// Update emotion metrics display
function updateEmotionMetrics(data) {
	if (!data) {
		console.warn("No emotion data available to update metrics");
		return;
	}

	try {
		// Update current emotion display
		const currentEmotionElement = document.getElementById("current-emotion");
		const emotionConfidenceElement =
			document.getElementById("emotion-confidence");

		if (!currentEmotionElement || !emotionConfidenceElement) {
			console.error("Missing emotion metric elements in the DOM");
			return;
		}

		// Set default color to white for better visibility
		currentEmotionElement.style.color = "#ffffff";
		emotionConfidenceElement.style.color = "#ffffff";

		// Update current emotion with dominant emotion
		const dominantEmotion = data.dominant || "neutral";
		const confidencePercent = Math.round((data.dominantScore || 0) * 100);

		// Set the emotion text and confidence percentage
		currentEmotionElement.textContent = dominantEmotion;
		emotionConfidenceElement.textContent = `${confidencePercent}%`;

		console.log(
			`Updated emotion metrics: ${dominantEmotion} (${confidencePercent}%)`
		);

		// Set color based on emotion type - only if we have valid data
		if (dominantEmotion && confidencePercent > 0) {
			switch (dominantEmotion.toLowerCase()) {
				case "happy":
					currentEmotionElement.style.color = "#4caf50"; // Green
					emotionConfidenceElement.style.color = "#4caf50";
					break;
				case "sad":
					currentEmotionElement.style.color = "#2196f3"; // Blue
					emotionConfidenceElement.style.color = "#2196f3";
					break;
				case "angry":
					currentEmotionElement.style.color = "#f44336"; // Red
					emotionConfidenceElement.style.color = "#f44336";
					break;
				case "fearful":
					currentEmotionElement.style.color = "#9c27b0"; // Purple
					emotionConfidenceElement.style.color = "#9c27b0";
					break;
				case "disgusted":
					currentEmotionElement.style.color = "#795548"; // Brown
					emotionConfidenceElement.style.color = "#795548";
					break;
				case "surprised":
					currentEmotionElement.style.color = "#ff9800"; // Orange
					emotionConfidenceElement.style.color = "#ff9800";
					break;
				case "neutral":
				default:
					// Keep white for neutral when we have actual data
					break;
			}
		}
	} catch (error) {
		console.error("Error updating emotion metrics:", error);
	}
}
