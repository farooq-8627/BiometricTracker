// Handle incoming eye tracking data from mobile device
function handleEyeTrackingData(data) {
	const container = document.getElementById("tracking-data");
	if (!container) return;

	// Clear previous data
	container.innerHTML = "";

	// Create a styled container for the data
	const dataDisplay = document.createElement("div");
	dataDisplay.className = "data-display";

	// Create a live visualization panel
	const visualizationPanel = document.createElement("div");
	visualizationPanel.className = "visualization-panel";

	// Add real-time eye tracking visualization
	const eyeTrackingCanvas = document.createElement("canvas");
	eyeTrackingCanvas.id = "eye-tracking-canvas";
	eyeTrackingCanvas.width = 400;
	eyeTrackingCanvas.height = 300;
	visualizationPanel.appendChild(eyeTrackingCanvas);

	// Add heading for visualization
	const vizTitle = document.createElement("h3");
	vizTitle.textContent = "Real-time Eye Tracking";
	vizTitle.className = "section-title";
	visualizationPanel.insertBefore(vizTitle, eyeTrackingCanvas);

	dataDisplay.appendChild(visualizationPanel);

	// Add eye tracking metrics
	const eyeMetrics = [
		{ label: "Blink Rate", value: `${data.blinkRate.toFixed(2)} blinks/min` },
		{
			label: "Saccade Velocity",
			value: `${data.saccadeVelocity.toFixed(2)} px/s`,
		},
		{ label: "Gaze Duration", value: `${data.gazeDuration.toFixed(2)} s` },
		{
			label: "Pupil Diameter",
			value: `${
				data.pupilDiameter ? data.pupilDiameter.toFixed(1) : "0.0"
			}px (${
				data.pupilDilationPercent ? data.pupilDilationPercent.toFixed(0) : "0"
			}%)`,
		},
		{
			label: "Gaze Direction",
			value: `x: ${data.gazeDirection.x.toFixed(
				2
			)}, y: ${data.gazeDirection.y.toFixed(2)}`,
		},
		{
			label: "Head Rotation",
			value: `Pitch: ${data.headDirection.pitch.toFixed(
				1
			)}°, Yaw: ${data.headDirection.yaw.toFixed(
				1
			)}°, Roll: ${data.headDirection.roll.toFixed(1)}°`,
		},
		{
			label: "Head Position",
			value: `x: ${data.headPosition.x.toFixed(
				1
			)}, y: ${data.headPosition.y.toFixed(
				1
			)}, z: ${data.headPosition.z.toFixed(1)}`,
		},
	];

	// Create a card for Eye Tracking data
	const eyeTrackingCard = createDataCard("Eye Tracking Metrics", eyeMetrics);
	dataDisplay.appendChild(eyeTrackingCard);

	// Add heart rate card if heart rate data is available
	if (data.heartRate) {
		const heartRateCard = createDataCard("Heart Rate", [
			{ label: "BPM", value: `${data.heartRate.toFixed(1)}` },
			{
				label: "HRV",
				value: `${
					data.heartRateVariability
						? data.heartRateVariability.toFixed(2)
						: "N/A"
				} ms`,
			},
		]);
		dataDisplay.appendChild(heartRateCard);
	}

	// Add trend visualization section for time-series data
	const trendsSection = document.createElement("div");
	trendsSection.className = "trends-section";

	// Create canvas for historical data visualization
	const trendsCanvas = document.createElement("canvas");
	trendsCanvas.id = "trends-visualization";
	trendsCanvas.width = 600;
	trendsCanvas.height = 200;
	trendsSection.appendChild(trendsCanvas);

	// Add title for trends visualization
	const trendsTitle = document.createElement("h3");
	trendsTitle.textContent = "Biometric Trends";
	trendsTitle.className = "section-title";
	trendsSection.insertBefore(trendsTitle, trendsCanvas);

	dataDisplay.appendChild(trendsSection);

	// Append the data display to the container
	container.appendChild(dataDisplay);

	// Draw visualizations
	drawEyeTrackingVisualization(eyeTrackingCanvas, data);
	updateTrendsVisualization(trendsCanvas, data);

	// Add or update CSS if it doesn't exist
	if (!document.getElementById("tracking-data-styles")) {
		const style = document.createElement("style");
		style.id = "tracking-data-styles";
		style.textContent = `
      .data-display {
        display: flex;
        flex-direction: column;
        gap: 20px;
        max-width: 1200px;
        margin: 0 auto;
      }
      .data-card {
        background-color: #f5f5f5;
        border-radius: 8px;
        padding: 15px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .data-card h3 {
        margin-top: 0;
        color: #333;
        font-size: 16px;
        border-bottom: 1px solid #eee;
        padding-bottom: 8px;
        margin-bottom: 12px;
      }
      .metric-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 14px;
      }
      .metric-label {
        font-weight: 500;
        color: #555;
      }
      .metric-value {
        font-weight: 600;
        color: #333;
      }
      .visualization-panel {
        background-color: #f5f5f5;
        border-radius: 8px;
        padding: 15px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin-bottom: 20px;
      }
      .trends-section {
        background-color: #f5f5f5;
        border-radius: 8px;
        padding: 15px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .section-title {
        margin-top: 0;
        color: #333;
        font-size: 16px;
        margin-bottom: 12px;
      }
      #eye-tracking-canvas {
        background-color: #fff;
        border-radius: 4px;
        box-shadow: inset 0 0 3px rgba(0,0,0,0.1);
        display: block;
        margin: 0 auto;
      }
      #trends-visualization {
        background-color: #fff;
        border-radius: 4px;
        box-shadow: inset 0 0 3px rgba(0,0,0,0.1);
        width: 100%;
        height: 200px;
      }
    `;
		document.head.appendChild(style);
	}
}

// Create a card for displaying data
function createDataCard(title, metrics) {
	const card = document.createElement("div");
	card.className = "data-card";

	const cardTitle = document.createElement("h3");
	cardTitle.textContent = title;
	card.appendChild(cardTitle);

	metrics.forEach((metric) => {
		const row = document.createElement("div");
		row.className = "metric-row";

		const label = document.createElement("div");
		label.className = "metric-label";
		label.textContent = metric.label;

		const value = document.createElement("div");
		value.className = "metric-value";
		value.textContent = metric.value;

		row.appendChild(label);
		row.appendChild(value);
		card.appendChild(row);
	});

	return card;
}

// Keep historical data for trend visualization
const historicalData = {
	timestamps: [],
	gazeX: [],
	gazeY: [],
	pupilDiameter: [],
	blinkRate: [],
	maxDataPoints: 100,
};

// Add new data point to historical data
function addDataPoint(data) {
	const timestamp = Date.now();

	historicalData.timestamps.push(timestamp);
	historicalData.gazeX.push(data.gazeDirection.x);
	historicalData.gazeY.push(data.gazeDirection.y);
	historicalData.pupilDiameter.push(data.pupilDiameter || 0);
	historicalData.blinkRate.push(data.blinkRate);

	// Trim arrays if they exceed max length
	if (historicalData.timestamps.length > historicalData.maxDataPoints) {
		historicalData.timestamps.shift();
		historicalData.gazeX.shift();
		historicalData.gazeY.shift();
		historicalData.pupilDiameter.shift();
		historicalData.blinkRate.shift();
	}
}

// Draw visualization of gaze and head direction
function drawEyeTrackingVisualization(canvas, data) {
	const ctx = canvas.getContext("2d");
	const width = canvas.width;
	const height = canvas.height;

	// Clear canvas
	ctx.clearRect(0, 0, width, height);

	// Add new data point for trend visualization
	addDataPoint(data);

	// Draw face outline
	const centerX = width / 2;
	const centerY = height / 2;
	const faceRadius = width * 0.2;

	// Calculate head position with more visible displacement
	const headX = centerX + data.headPosition.x * 30;
	const headY = centerY + data.headPosition.y * 30;

	// Apply head rotation transformation
	ctx.save();
	ctx.translate(headX, headY);
	ctx.rotate((data.headDirection.roll * Math.PI) / 180);

	// Draw face oval
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
	ctx.strokeStyle = "#333";
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
	ctx.strokeStyle = "#333";
	ctx.stroke();

	// Draw pupils with correct diameter
	const maxPupilSize = eyeRadius * 0.8;
	const minPupilSize = eyeRadius * 0.3;
	const pupilDilationPercent = data.pupilDilationPercent || 50;
	const dilationFactor = pupilDilationPercent / 100;
	const pupilRadius =
		minPupilSize + (maxPupilSize - minPupilSize) * dilationFactor;

	// Calculate pupil position based on gaze direction
	const maxPupilOffset = eyeRadius * 0.4;
	const leftPupilX = -eyeOffsetX + data.gazeDirection.x * maxPupilOffset;
	const rightPupilX = eyeOffsetX + data.gazeDirection.x * maxPupilOffset;
	const pupilY = eyeOffsetY + data.gazeDirection.y * maxPupilOffset;

	// Draw left pupil
	ctx.beginPath();
	ctx.arc(leftPupilX, pupilY, pupilRadius, 0, Math.PI * 2);
	ctx.fillStyle = "#000";
	ctx.fill();

	// Draw right pupil
	ctx.beginPath();
	ctx.arc(rightPupilX, pupilY, pupilRadius, 0, Math.PI * 2);
	ctx.fillStyle = "#000";
	ctx.fill();

	// Draw nose
	ctx.beginPath();
	ctx.moveTo(0, eyeOffsetY + eyeRadius * 2);
	ctx.lineTo(-faceRadius * 0.1, faceRadius * 0.3);
	ctx.lineTo(faceRadius * 0.1, faceRadius * 0.3);
	ctx.closePath();
	ctx.stroke();

	// Draw mouth
	ctx.beginPath();
	ctx.moveTo(-faceRadius * 0.3, faceRadius * 0.5);
	ctx.quadraticCurveTo(0, faceRadius * 0.7, faceRadius * 0.3, faceRadius * 0.5);
	ctx.stroke();

	ctx.restore();

	// Draw gaze direction vector
	const gazeLength = 80;
	const gazeStartX = headX;
	const gazeStartY = headY;
	const gazeEndX = gazeStartX + data.gazeDirection.x * gazeLength;
	const gazeEndY = gazeStartY + data.gazeDirection.y * gazeLength;

	// Draw gaze line
	ctx.beginPath();
	ctx.moveTo(gazeStartX, gazeStartY);
	ctx.lineTo(gazeEndX, gazeEndY);
	ctx.strokeStyle = "#00a0ff";
	ctx.lineWidth = 2;
	ctx.stroke();

	// Draw arrowhead
	const arrowHeadSize = 10;
	const angle = Math.atan2(gazeEndY - gazeStartY, gazeEndX - gazeStartX);
	ctx.beginPath();
	ctx.moveTo(gazeEndX, gazeEndY);
	ctx.lineTo(
		gazeEndX - arrowHeadSize * Math.cos(angle - Math.PI / 6),
		gazeEndY - arrowHeadSize * Math.sin(angle - Math.PI / 6)
	);
	ctx.lineTo(
		gazeEndX - arrowHeadSize * Math.cos(angle + Math.PI / 6),
		gazeEndY - arrowHeadSize * Math.sin(angle + Math.PI / 6)
	);
	ctx.closePath();
	ctx.fillStyle = "#00a0ff";
	ctx.fill();

	// Add head position indicator
	ctx.fillStyle = "#333";
	ctx.font = "12px Arial";
	ctx.fillText(
		`Head Position: x: ${data.headPosition.x.toFixed(
			1
		)}, y: ${data.headPosition.y.toFixed(1)}, z: ${data.headPosition.z.toFixed(
			1
		)}`,
		10,
		20
	);

	// Add gaze direction indicator
	ctx.fillStyle = "#00a0ff";
	ctx.fillText(
		`Gaze: (${data.gazeDirection.x.toFixed(2)}, ${data.gazeDirection.y.toFixed(
			2
		)})`,
		10,
		40
	);

	// Add pupil info
	ctx.fillStyle = "#333";
	ctx.fillText(
		`Pupil Diameter: ${(data.pupilDiameter || 0).toFixed(1)}px (${(
			data.pupilDilationPercent || 0
		).toFixed(0)}%)`,
		10,
		60
	);
}

// Draw trend visualization of historical data
function updateTrendsVisualization(canvas, currentData) {
	const ctx = canvas.getContext("2d");
	const width = canvas.width;
	const height = canvas.height;

	// Clear canvas
	ctx.clearRect(0, 0, width, height);

	// Draw background grid
	ctx.strokeStyle = "#f0f0f0";
	ctx.lineWidth = 1;

	// Vertical grid lines
	for (let x = 0; x <= width; x += 50) {
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, height);
		ctx.stroke();
	}

	// Horizontal grid lines
	for (let y = 0; y <= height; y += 25) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(width, y);
		ctx.stroke();
	}

	// Don't draw if no data yet
	if (historicalData.timestamps.length < 2) return;

	// Calculate time scale
	const startTime = historicalData.timestamps[0];
	const endTime =
		historicalData.timestamps[historicalData.timestamps.length - 1];
	const timeRange = endTime - startTime;

	// Helper function to map value to canvas coordinates
	const mapToX = (timestamp) => {
		return (width * (timestamp - startTime)) / timeRange;
	};

	// Draw pupil diameter trend - RED
	ctx.strokeStyle = "#ff4444";
	ctx.lineWidth = 2;
	ctx.beginPath();

	// Find min and max pupil diameter for scaling
	const maxPupilDiameter = Math.max(...historicalData.pupilDiameter) || 10;

	historicalData.timestamps.forEach((timestamp, i) => {
		const x = mapToX(timestamp);
		const y =
			height -
			(historicalData.pupilDiameter[i] / maxPupilDiameter) * height * 0.8;

		if (i === 0) {
			ctx.moveTo(x, y);
		} else {
			ctx.lineTo(x, y);
		}
	});
	ctx.stroke();

	// Draw gaze X trend - BLUE
	ctx.strokeStyle = "#4444ff";
	ctx.lineWidth = 2;
	ctx.beginPath();

	historicalData.timestamps.forEach((timestamp, i) => {
		const x = mapToX(timestamp);
		// Map -1 to 1 to canvas height
		const y = height * 0.5 - historicalData.gazeX[i] * height * 0.3;

		if (i === 0) {
			ctx.moveTo(x, y);
		} else {
			ctx.lineTo(x, y);
		}
	});
	ctx.stroke();

	// Draw gaze Y trend - GREEN
	ctx.strokeStyle = "#44aa44";
	ctx.lineWidth = 2;
	ctx.beginPath();

	historicalData.timestamps.forEach((timestamp, i) => {
		const x = mapToX(timestamp);
		// Map -1 to 1 to canvas height
		const y = height * 0.5 - historicalData.gazeY[i] * height * 0.3;

		if (i === 0) {
			ctx.moveTo(x, y);
		} else {
			ctx.lineTo(x, y);
		}
	});
	ctx.stroke();

	// Add legend
	ctx.font = "12px Arial";

	ctx.fillStyle = "#ff4444";
	ctx.fillRect(10, 10, 12, 12);
	ctx.fillText("Pupil Diameter", 28, 20);

	ctx.fillStyle = "#4444ff";
	ctx.fillRect(10, 30, 12, 12);
	ctx.fillText("Gaze X", 28, 40);

	ctx.fillStyle = "#44aa44";
	ctx.fillRect(10, 50, 12, 12);
	ctx.fillText("Gaze Y", 28, 60);
}

// Update the WebSocket event handler to process the new data
function setupWebSocketListeners(socket) {
	socket.addEventListener("message", (event) => {
		try {
			const message = JSON.parse(event.data);

			switch (message.type) {
				case "paired":
					handlePairingUpdate(message.pairedId, true);
					break;
				case "unpaired":
					handlePairingUpdate(null, false);
					break;
				case "eye_tracking_data":
					handleEyeTrackingData(message.trackingData);
					break;
				case "heart_rate_data":
					updateHeartRateDisplay(
						message.heartRate,
						message.heartRateVariability
					);
					break;
			}
		} catch (error) {
			console.error("Error processing WebSocket message:", error);
		}
	});

	// Handle socket connection events
	socket.addEventListener("open", () => {
		console.log("WebSocket connection established");
		// Register as laptop
		socket.send(JSON.stringify({ type: "register", deviceType: "laptop" }));
	});

	socket.addEventListener("close", () => {
		console.log("WebSocket connection closed");
		handleConnectionStatus(false);
	});

	socket.addEventListener("error", (error) => {
		console.error("WebSocket error:", error);
		handleConnectionStatus(false);
	});
}
