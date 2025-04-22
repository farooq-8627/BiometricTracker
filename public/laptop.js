// Global variables for laptop interface
let socket; // Socket.io socket
let ws; // WebSocket connection
let pairedMobileId = null;
let eyeMovementChart = null;
let heartRateChart = null;
let combinedChart = null;
let emotionChart = null; // New chart for emotions
let eyeTrackingData = [];
let heartRateData = [];
let emotionData = []; // New array for emotion data
let feedbackHistory = [];
let useWebSocket = false; // Flag to determine which connection to use

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
				console.log("Received heart rate data:", { sourceId, data });
				if (sourceId === pairedMobileId) {
					processHeartRateData(data);
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
	ctx.ellipse(
		centerX,
		centerY,
		faceRadius,
		faceRadius * 1.3,
		0,
		0,
		Math.PI * 2
	);
	ctx.strokeStyle = "#ccc";
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
		console.log("Received heart rate data:", data);

		// Process and display heart rate data
		if (data.sourceId === pairedMobileId) {
			processHeartRateData(data.data);
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
					label: "Emotion Levels",
					data: [0, 0, 0, 0, 0, 0, 0],
					backgroundColor: "rgba(153, 102, 255, 0.2)",
					borderColor: "rgba(153, 102, 255, 1)",
					borderWidth: 2,
					pointBackgroundColor: "rgba(153, 102, 255, 1)",
					pointBorderColor: "#fff",
					pointHoverBackgroundColor: "#fff",
					pointHoverBorderColor: "rgba(153, 102, 255, 1)",
				},
			],
		},
		options: {
			scales: {
				r: {
					beginAtZero: true,
					max: 1,
				},
			},
			plugins: {
				title: {
					display: true,
					text: "Emotion Analysis",
					font: {
						size: 16,
					},
				},
				legend: {
					display: false,
				},
			},
			responsive: true,
			maintainAspectRatio: false,
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
	// Add data to tracking array
	eyeTrackingData.push({
		timestamp: Date.now(),
		blinkRate: data.blinkRate || 0,
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

	// Update metrics display
	updateEyeTrackingMetrics(data);

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

	// Face outline
	ctx.beginPath();
	ctx.ellipse(0, 0, faceRadius, faceRadius * 1.3, 0, 0, Math.PI * 2);
	ctx.strokeStyle = "#333";
	ctx.lineWidth = 2;
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
	ctx.fillStyle = "#000";
	ctx.beginPath();
	ctx.arc(leftPupilX, pupilY, pupilSize, 0, Math.PI * 2);
	ctx.fill();

	ctx.beginPath();
	ctx.arc(rightPupilX, pupilY, pupilSize, 0, Math.PI * 2);
	ctx.fill();

	// Draw mouth based on head position (simple visual feedback)
	const mouthWidth = faceRadius * 0.5;
	const mouthHeight = faceRadius * 0.1;
	const mouthY = faceRadius * 0.4;

	ctx.beginPath();
	ctx.moveTo(-mouthWidth / 2, mouthY);
	ctx.quadraticCurveTo(0, mouthY + mouthHeight, mouthWidth / 2, mouthY);
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
	ctx.beginPath();
	ctx.moveTo(centerX, centerY);
	ctx.lineTo(centerX + gazeX * gazeLength, centerY + gazeY * gazeLength);
	ctx.strokeStyle = "#4a6fa5";
	ctx.lineWidth = 2;
	ctx.stroke();

	// Draw arrow head
	const arrowSize = 10;
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
	ctx.fillStyle = "#4a6fa5";
	ctx.fill();

	// Draw reference coordinate system
	drawCoordinateSystem(ctx, width, height);

	// Draw gaze direction labels
	drawGazeDirectionLabels(ctx, width, height);

	// Update text metrics
	updateEyeTrackingTextMetrics(data);
}

// Draw background grid
function drawBackgroundGrid(ctx, width, height) {
	ctx.strokeStyle = "#e0e0e0";
	ctx.lineWidth = 0.5;

	// Draw vertical grid lines
	for (let x = 0; x <= width; x += 20) {
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, height);
		ctx.stroke();
	}

	// Draw horizontal grid lines
	for (let y = 0; y <= height; y += 20) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(width, y);
		ctx.stroke();
	}

	// Draw center lines with different color
	ctx.strokeStyle = "#ccc";
	ctx.lineWidth = 1;

	// Vertical center line
	ctx.beginPath();
	ctx.moveTo(width / 2, 0);
	ctx.lineTo(width / 2, height);
	ctx.stroke();

	// Horizontal center line
	ctx.beginPath();
	ctx.moveTo(0, height / 2);
	ctx.lineTo(width, height / 2);
	ctx.stroke();
}

// Draw coordinate system for reference
function drawCoordinateSystem(ctx, width, height) {
	const centerX = width / 2;
	const centerY = height / 2;
	const axisLength = 30;

	// X-axis (red)
	ctx.beginPath();
	ctx.moveTo(centerX, centerY);
	ctx.lineTo(centerX + axisLength, centerY);
	ctx.strokeStyle = "#f44336";
	ctx.lineWidth = 2;
	ctx.stroke();

	// X-axis arrow
	ctx.beginPath();
	ctx.moveTo(centerX + axisLength, centerY);
	ctx.lineTo(centerX + axisLength - 5, centerY - 3);
	ctx.lineTo(centerX + axisLength - 5, centerY + 3);
	ctx.closePath();
	ctx.fillStyle = "#f44336";
	ctx.fill();

	// X-axis label
	ctx.fillStyle = "#f44336";
	ctx.font = "10px Arial";
	ctx.fillText("X", centerX + axisLength + 2, centerY + 10);

	// Y-axis (green)
	ctx.beginPath();
	ctx.moveTo(centerX, centerY);
	ctx.lineTo(centerX, centerY - axisLength);
	ctx.strokeStyle = "#4caf50";
	ctx.lineWidth = 2;
	ctx.stroke();

	// Y-axis arrow
	ctx.beginPath();
	ctx.moveTo(centerX, centerY - axisLength);
	ctx.lineTo(centerX - 3, centerY - axisLength + 5);
	ctx.lineTo(centerX + 3, centerY - axisLength + 5);
	ctx.closePath();
	ctx.fillStyle = "#4caf50";
	ctx.fill();

	// Y-axis label
	ctx.fillStyle = "#4caf50";
	ctx.font = "10px Arial";
	ctx.fillText("Y", centerX + 5, centerY - axisLength - 2);
}

// Draw gaze direction labels around the edge
function drawGazeDirectionLabels(ctx, width, height) {
	const centerX = width / 2;
	const centerY = height / 2;

	ctx.font = "12px Arial";
	ctx.fillStyle = "#555";
	ctx.textAlign = "center";

	// Top - "Up"
	ctx.fillText("Up", centerX, 15);

	// Bottom - "Down"
	ctx.fillText("Down", centerX, height - 5);

	// Left - "Left"
	ctx.textAlign = "left";
	ctx.fillText("Left", 5, centerY);

	// Right - "Right"
	ctx.textAlign = "right";
	ctx.fillText("Right", width - 5, centerY);

	// Reset text alignment
	ctx.textAlign = "left";
}

// Update text metrics for eye tracking
function updateEyeTrackingTextMetrics(data) {
	// Update gaze direction text
	const gazeDirectionEl = document.getElementById("gaze-direction");
	if (gazeDirectionEl) {
		const gazeX = data.gazeDirection?.x || 0;
		const gazeY = data.gazeDirection?.y || 0;
		gazeDirectionEl.textContent = `x: ${gazeX.toFixed(2)}, y: ${gazeY.toFixed(
			2
		)}`;
	}

	// Update gaze text description
	const gazeTextEl = document.getElementById("gaze-text");
	if (gazeTextEl) {
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
		const diameter = data.pupilDiameter || 0;
		const dilationPercent = data.pupilDilationPercent || 0;
		pupilDiameterEl.textContent = `${diameter.toFixed(
			1
		)}px (${dilationPercent.toFixed(0)}%)`;
	}

	// Update head rotation
	const headRotationEl = document.getElementById("head-rotation");
	if (headRotationEl) {
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

// Reset all data including emotion data
function resetData() {
	eyeTrackingData = [];
	heartRateData = [];
	emotionData = []; // Reset emotion data

	// Reset charts and visualizations
	if (eyeMovementChart) {
		eyeMovementChart.data.labels = [];
		eyeMovementChart.data.datasets[0].data = [];
		eyeMovementChart.data.datasets[1].data = [];
		eyeMovementChart.update();
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

// Process emotion data received from mobile device
function processEmotionData(data) {
	if (!data) return;

	// Add timestamp if not present
	const timestamp = data.timestamp || Date.now();
	const emotionWithTimestamp = {
		...data,
		timestamp,
	};

	// Add to emotion data array and limit size
	emotionData.push(emotionWithTimestamp);
	if (emotionData.length > 100) {
		emotionData.shift();
	}

	// Update the emotion chart
	updateEmotionChart(emotionWithTimestamp);

	// Update the emotion metrics display
	updateEmotionMetrics(emotionWithTimestamp);

	// Also update combined metrics with emotional data
	updateCombinedMetrics();
}

// Update the emotion chart with new data
function updateEmotionChart(latestData) {
	if (!emotionChart) return;

	// Update radar chart with emotion values
	emotionChart.data.datasets[0].data = [
		latestData.happy || 0,
		latestData.sad || 0,
		latestData.angry || 0,
		latestData.fearful || 0,
		latestData.disgusted || 0,
		latestData.surprised || 0,
		latestData.neutral || 0,
	];

	// Update chart title to show dominant emotion
	if (latestData.dominant) {
		const dominantEmotion =
			latestData.dominant.charAt(0).toUpperCase() +
			latestData.dominant.slice(1);

		const confidencePercent = Math.round((latestData.dominantScore || 0) * 100);

		emotionChart.options.plugins.title.text = `Emotion Analysis: ${dominantEmotion} (${confidencePercent}%)`;
	}

	emotionChart.update();
}

// Update displayed emotion metrics
function updateEmotionMetrics(latestData) {
	if (!latestData) return;

	// Update current emotion display
	const currentEmotionElement = document.getElementById("current-emotion");
	if (currentEmotionElement && latestData.dominant) {
		// Capitalize first letter of emotion
		const formattedEmotion =
			latestData.dominant.charAt(0).toUpperCase() +
			latestData.dominant.slice(1);

		currentEmotionElement.textContent = formattedEmotion;

		// Add color coding for emotions
		currentEmotionElement.className = ""; // Reset classes
		currentEmotionElement.classList.add("emotion-" + latestData.dominant);
	}

	// Update confidence display
	const confidenceElement = document.getElementById("emotion-confidence");
	if (confidenceElement) {
		const confidencePercent = Math.round((latestData.dominantScore || 0) * 100);
		confidenceElement.textContent = `${confidencePercent}%`;
	}
}

// Update combined metrics to include emotion data
function updateCombinedMetrics() {
	// ... existing code ...

	// Add stress level calculation based on emotions
	const stressLevelElement = document.getElementById("stress-level");
	if (stressLevelElement && emotionData.length > 0) {
		// Get latest emotion data
		const latestEmotion = emotionData[emotionData.length - 1];

		// Calculate stress based on negative emotions and heart rate
		let emotionalStress = 0;
		if (latestEmotion) {
			// Weight negative emotions more heavily
			emotionalStress =
				(latestEmotion.angry || 0) * 1.5 +
				(latestEmotion.fearful || 0) * 1.2 +
				(latestEmotion.sad || 0) * 0.8 +
				(latestEmotion.disgusted || 0) * 0.7;

			// Reduce stress if happy/neutral
			emotionalStress -= (latestEmotion.happy || 0) * 0.5;
			emotionalStress = Math.max(0, Math.min(10, emotionalStress * 5));
		}

		// Combine with physical stress from heart rate and eye movement
		const heartRateStress = calculateHeartRateStress();
		const eyeStress = calculateEyeStress();

		const overallStress =
			emotionalStress * 0.4 + heartRateStress * 0.3 + eyeStress * 0.3;
		const stressLevel = Math.min(10, Math.max(0, overallStress)).toFixed(1);

		stressLevelElement.textContent = stressLevel;

		// Color code stress level
		if (overallStress < 3) {
			stressLevelElement.style.color = "#32CD32"; // Green
		} else if (overallStress < 7) {
			stressLevelElement.style.color = "#FFA500"; // Orange
		} else {
			stressLevelElement.style.color = "#FF4500"; // Red
		}
	}

	// ... existing code ...
}

// Calculate heart rate contribution to stress
function calculateHeartRateStress() {
	if (heartRateData.length === 0) return 0;

	// Get average heart rate
	const heartRates = heartRateData.map((hr) => hr.bpm);
	const avgHeartRate =
		heartRates.reduce((a, b) => a + b, 0) / heartRates.length;

	// Calculate stress based on heart rate - higher rates indicate more stress
	// Normal resting is ~60-80, so normalize around that
	return Math.max(0, Math.min(10, (avgHeartRate - 60) / 10));
}

// Calculate eye tracking contribution to stress
function calculateEyeStress() {
	if (eyeTrackingData.length < 10) return 0;

	// Rapid eye movement and frequent blinking can indicate stress
	const recentData = eyeTrackingData.slice(-10);

	// Calculate average blink rate
	const blinkRates = recentData
		.map((et) => et.blinkRate)
		.filter((br) => !isNaN(br));
	const avgBlinkRate =
		blinkRates.length > 0
			? blinkRates.reduce((a, b) => a + b, 0) / blinkRates.length
			: 0;

	// Calculate saccade velocity - rapid eye movements indicate stress
	const saccadeVelocities = recentData
		.map((et) => et.saccadeVelocity)
		.filter((sv) => !isNaN(sv));
	const avgSaccadeVelocity =
		saccadeVelocities.length > 0
			? saccadeVelocities.reduce((a, b) => a + b, 0) / saccadeVelocities.length
			: 0;

	// Combine metrics into stress indicator
	const stressFromBlinks = Math.min(5, avgBlinkRate / 5); // Normalize to 0-5 range
	const stressFromSaccades = Math.min(5, avgSaccadeVelocity / 100); // Normalize to 0-5 range

	return Math.min(10, stressFromBlinks + stressFromSaccades);
}
