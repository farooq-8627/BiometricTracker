// Eye tracking detection and processing

// Global variables for eye tracking
let blinkCount = 0;
let lastBlinkTime = 0;
let lastEyePositions = [];
let blinkThreshold = 0.25; // Adjusted threshold for detecting eye closure - more sensitive to catch more blinks
let isEyeClosed = false; // Track if eyes are currently closed
let blinkHistory = []; // Store blink timestamps for more accurate blink rate
const MAX_BLINK_HISTORY = 20; // Maximum number of blinks to store
const MAX_EYE_POSITIONS = 10; // Number of eye positions to keep for velocity calculations
let faceApiReady = false; // Flag to track if face-api is ready
let lastFacePosition = null; // To track head movement

// Function to check and initialize face-api if needed
async function ensureFaceApiIsReady() {
	if (faceApiReady) return true;

	// Check if face-api is loaded
	if (typeof faceapi === "undefined") {
		console.log("Face API not yet loaded, waiting...");
		return false;
	}

	try {
		// Try to use models that might already be loaded by mobile.js
		if (
			faceapi.nets.tinyFaceDetector.isLoaded &&
			faceapi.nets.faceLandmark68Net.isLoaded
		) {
			console.log("Face API models already loaded for eye tracking");
			faceApiReady = true;
			return true;
		}

		// Fall back to CDN models if not loaded
		const modelPath = "https://justadudewhohacks.github.io/face-api.js/models";

		// Load models if not already loaded
		await Promise.all([
			faceapi.nets.tinyFaceDetector.load(modelPath),
			faceapi.nets.faceLandmark68Net.load(modelPath),
		]);

		console.log("Face API models loaded successfully for eye tracking");
		faceApiReady = true;
		return true;
	} catch (error) {
		console.error("Failed to load Face API models for eye tracking:", error);
		return false;
	}
}

// Process video frame for eye tracking
async function processEyeTracking(videoElement, canvas, context) {
	// Skip if video isn't ready
	if (videoElement.readyState !== 4) return null;

	// Ensure face-api is ready
	const isReady = await ensureFaceApiIsReady();
	if (!isReady) {
		console.log("Face API not ready for eye tracking");
		return createDefaultEyeData(); // Return default data structure
	}

	try {
		// Log video dimensions for debugging
		console.log(
			`Eye tracking video dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`
		);

		// Try with different face detection options for better detection
		const options = new faceapi.TinyFaceDetectorOptions({
			inputSize: 320, // Lower input size may be faster and more reliable on mobile
			scoreThreshold: 0.3, // Lower threshold to detect faces more easily
		});

		console.log("Attempting face detection for eye tracking...");

		// Detect faces in the video frame
		const detections = await faceapi
			.detectSingleFace(videoElement, options)
			.withFaceLandmarks();

		// Clear the canvas
		context.clearRect(0, 0, canvas.width, canvas.height);

		// No faces detected
		if (!detections) {
			console.log("No face detected for eye tracking");

			// Check image brightness for debugging
			const tempCanvas = document.createElement("canvas");
			const tempContext = tempCanvas.getContext("2d");
			tempCanvas.width = videoElement.videoWidth;
			tempCanvas.height = videoElement.videoHeight;
			tempContext.drawImage(
				videoElement,
				0,
				0,
				tempCanvas.width,
				tempCanvas.height
			);

			const imageData = tempContext.getImageData(
				0,
				0,
				tempCanvas.width,
				tempCanvas.height
			);
			const brightness = calculateImageBrightness(imageData.data);
			console.log(
				`Image brightness for eye tracking: ${brightness.toFixed(2)}`
			);

			if (brightness < 40) {
				console.warn(
					"Image appears too dark for eye tracking. Try improving lighting conditions."
				);
			}

			return createDefaultEyeData(); // Return default data structure
		}

		console.log("Face detected for eye tracking!");

		// Log face location for debugging
		const { x, y, width, height } = detections.detection.box;
		console.log(
			`Face for eye tracking found at: x=${x}, y=${y}, width=${width}, height=${height}`
		);

		// Get landmarks
		const landmarks = detections.landmarks;
		const leftEye = landmarks.getLeftEye();
		const rightEye = landmarks.getRightEye();

		// Draw face landmarks
		drawFaceLandmarks(context, detections);

		// Calculate head position and orientation
		const headData = calculateHeadPose(detections);

		// Draw head pose indicators
		drawHeadPoseIndicators(context, detections, headData);

		// Process eye data
		const eyeData = processEyeData(leftEye, rightEye);

		// Calculate and draw gaze direction
		const gazeData = calculateGazeDirection(leftEye, rightEye, headData);
		drawGazeDirection(context, gazeData, leftEye, rightEye);

		// Draw blink indicator
		if (eyeData.isBlinking) {
			drawBlinkIndicator(context, canvas.width, canvas.height);
		}

		// Estimate pupil diameter
		const pupilData = estimatePupilDiameter(leftEye, rightEye);

		// Log key eye tracking metrics
		console.log(
			`Eye tracking metrics: blink rate=${eyeData.blinkRate.toFixed(
				2
			)}, gaze x=${gazeData.x.toFixed(2)}, y=${gazeData.y.toFixed(2)}`
		);

		// Return combined tracking data
		return {
			...eyeData,
			gazeDirection: gazeData,
			headDirection: headData.rotation,
			headPosition: headData.position,
			pupilDiameter: pupilData.diameter,
			pupilDilationPercent: pupilData.dilationPercent,
			faceDetection: {
				// Include face detection data for emotion analysis
				video: videoElement,
				detection: detections.detection,
				landmarks: detections.landmarks,
				descriptor: detections.descriptor,
			},
		};
	} catch (error) {
		console.error("Error in eye tracking:", error);
		return createDefaultEyeData(); // Return default data structure in case of error
	}
}

// Draw face landmarks on the canvas
function drawFaceLandmarks(context, face) {
	// Draw face outline
	context.strokeStyle = "#4a6fa5";
	context.lineWidth = 2;

	// Draw jaw line
	context.beginPath();
	face.landmarks.getJawOutline().forEach((point, index) => {
		if (index === 0) {
			context.moveTo(point.x, point.y);
		} else {
			context.lineTo(point.x, point.y);
		}
	});
	context.stroke();

	// Draw left eye
	context.beginPath();
	face.landmarks.getLeftEye().forEach((point, index) => {
		if (index === 0) {
			context.moveTo(point.x, point.y);
		} else {
			context.lineTo(point.x, point.y);
		}
	});
	context.closePath();
	context.stroke();

	// Draw right eye
	context.beginPath();
	face.landmarks.getRightEye().forEach((point, index) => {
		if (index === 0) {
			context.moveTo(point.x, point.y);
		} else {
			context.lineTo(point.x, point.y);
		}
	});
	context.closePath();
	context.stroke();

	// Draw nose
	context.beginPath();
	face.landmarks.getNose().forEach((point, index) => {
		if (index === 0) {
			context.moveTo(point.x, point.y);
		} else {
			context.lineTo(point.x, point.y);
		}
	});
	context.stroke();

	// Draw mouth
	context.beginPath();
	face.landmarks.getMouth().forEach((point, index) => {
		if (index === 0) {
			context.moveTo(point.x, point.y);
		} else {
			context.lineTo(point.x, point.y);
		}
	});
	context.closePath();
	context.stroke();

	// Draw face detection box
	const { x, y, width, height } = face.detection.box;
	context.strokeStyle = "#4fc3f7";
	context.lineWidth = 1;
	context.strokeRect(x, y, width, height);
}

// Process eye data from the landmarks
function processEyeData(leftEye, rightEye) {
	// Calculate eye aspect ratio (EAR) to detect blinks
	const leftEAR = calculateEyeAspectRatio(leftEye);
	const rightEAR = calculateEyeAspectRatio(rightEye);
	const avgEAR = (leftEAR + rightEAR) / 2;

	// Check if current EAR indicates blinking
	const isBlinking = avgEAR < blinkThreshold;

	// Debug log for EAR values and threshold
	console.log(
		`Eye Aspect Ratio: ${avgEAR.toFixed(
			4
		)}, Threshold: ${blinkThreshold}, Is Blinking: ${isBlinking}`
	);

	// Detect blinks based on EAR threshold and state transition
	const now = Date.now();
	let blinkJustDetected = false;

	// Detect a new blink when eyes transition from open to closed
	if (isBlinking && !isEyeClosed) {
		// A new blink is detected
		blinkCount++;
		blinkJustDetected = true;

		// Add to blink history for accurate rate calculation
		blinkHistory.push(now);

		// Limit history size
		if (blinkHistory.length > MAX_BLINK_HISTORY) {
			blinkHistory.shift();
		}

		console.log("Blink detected! Total blinks:", blinkCount);
	} else if (isBlinking) {
		console.log("Eyes still closed");
	} else {
		console.log("Eyes open");
	}

	// Update eye state
	isEyeClosed = isBlinking;

	// Calculate blink rate (blinks per minute) from history
	// Using actual blink times provides a more accurate measurement
	let blinkRate = 0;
	if (blinkHistory.length > 1) {
		// Calculate time window in milliseconds
		const timeWindow = now - blinkHistory[0];
		// Calculate rate if we have enough history (at least 1 second of data)
		if (timeWindow > 1000) {
			// Convert to blinks per minute
			blinkRate = (blinkHistory.length / timeWindow) * 60000;
		}
	}

	// Clean up old blink history (older than 60 seconds)
	const cutoffTime = now - 60000;
	while (blinkHistory.length > 0 && blinkHistory[0] < cutoffTime) {
		blinkHistory.shift();
	}

	// Calculate eye positions (average of left and right eye centers)
	const leftEyeCenter = calculateEyeCenter(leftEye);
	const rightEyeCenter = calculateEyeCenter(rightEye);
	const currentEyePosition = {
		x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
		y: (leftEyeCenter.y + rightEyeCenter.y) / 2,
		timestamp: now,
	};

	// Track eye positions for saccade velocity calculations
	lastEyePositions.push(currentEyePosition);
	if (lastEyePositions.length > MAX_EYE_POSITIONS) {
		lastEyePositions.shift();
	}

	// Calculate saccade velocity (pixels per second)
	let saccadeVelocity = 0;
	if (lastEyePositions.length > 1) {
		saccadeVelocity = calculateSaccadeVelocity(lastEyePositions);
	}

	// Calculate gaze duration (how long the eye stays in relatively the same position)
	const gazeDuration = calculateGazeDuration(lastEyePositions);

	// Calculate pupil dilation (rough approximation)
	const leftPupilSize = calculatePupilSize(leftEye);
	const rightPupilSize = calculatePupilSize(rightEye);
	const avgPupilSize = (leftPupilSize + rightPupilSize) / 2;

	return {
		blinkRate,
		blinkCount,
		isBlinking,
		blinkJustDetected,
		saccadeVelocity,
		gazeDuration,
		pupilDilation: avgPupilSize,
		eyeAspectRatio: avgEAR,
	};
}

// Draw a visual indicator when a blink is detected
function drawBlinkIndicator(context, width, height) {
	// Save current context state
	context.save();

	// Draw a semi-transparent red border to indicate blinking
	context.strokeStyle = "rgba(255, 0, 0, 0.7)";
	context.lineWidth = 10;
	context.strokeRect(0, 0, width, height);

	// Add text indicator
	context.fillStyle = "rgba(255, 0, 0, 0.8)";
	context.font = "24px Arial";
	context.textAlign = "center";
	context.fillText("BLINK DETECTED", width / 2, 40);

	// Restore context
	context.restore();
}

// Calculate Eye Aspect Ratio (EAR)
function calculateEyeAspectRatio(eye) {
	// Calculate the distance between vertical eye landmarks
	const vertical1 = distance(eye[1], eye[5]);
	const vertical2 = distance(eye[2], eye[4]);

	// Calculate the distance between horizontal eye landmarks
	const horizontal = distance(eye[0], eye[3]);

	// EAR = (V1 + V2) / (2 * H)
	return (vertical1 + vertical2) / (2 * horizontal);
}

// Calculate eye center point
function calculateEyeCenter(eye) {
	let sumX = 0;
	let sumY = 0;

	eye.forEach((point) => {
		sumX += point.x;
		sumY += point.y;
	});

	return {
		x: sumX / eye.length,
		y: sumY / eye.length,
	};
}

// Calculate distance between two points
function distance(point1, point2) {
	const dx = point1.x - point2.x;
	const dy = point1.y - point2.y;
	return Math.sqrt(dx * dx + dy * dy);
}

// Calculate saccade velocity from eye positions
function calculateSaccadeVelocity(positions) {
	let totalVelocity = 0;
	let validPairs = 0;

	for (let i = 1; i < positions.length; i++) {
		const prev = positions[i - 1];
		const curr = positions[i];

		const dx = curr.x - prev.x;
		const dy = curr.y - prev.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		const timeDiff = curr.timestamp - prev.timestamp;
		if (timeDiff > 0) {
			// Convert to pixels per second
			const velocity = (dist / timeDiff) * 1000;
			totalVelocity += velocity;
			validPairs++;
		}
	}

	return validPairs > 0 ? totalVelocity / validPairs : 0;
}

// Calculate gaze duration (how long the eye stays in relatively the same position)
function calculateGazeDuration(positions) {
	if (positions.length < 2) return 0;

	// Define threshold for what constitutes "same position" (in pixels)
	const movementThreshold = 10;

	// Start with the most recent position
	let currentPosition = positions[positions.length - 1];
	let gazeStart = currentPosition.timestamp;

	// Go backwards through positions to find when the gaze started
	for (let i = positions.length - 2; i >= 0; i--) {
		const position = positions[i];

		// Calculate distance between current position and this position
		const dx = currentPosition.x - position.x;
		const dy = currentPosition.y - position.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		// If movement is greater than threshold, break - we've found the start of the current gaze
		if (dist > movementThreshold) {
			break;
		}

		// Update gaze start time
		gazeStart = position.timestamp;
	}

	// Calculate gaze duration in seconds
	return (currentPosition.timestamp - gazeStart) / 1000;
}

// Calculate pupil size (rough approximation)
function calculatePupilSize(eye) {
	// Use the area of the eye as a rough approximation of pupil size
	const width = distance(eye[0], eye[3]);
	const height = (distance(eye[1], eye[5]) + distance(eye[2], eye[4])) / 2;

	return width * height;
}

// Calculate head pose (position and orientation)
function calculateHeadPose(face) {
	// Get the face detection box
	const { x, y, width, height } = face.detection.box;
	const faceCenter = { x: x + width / 2, y: y + height / 2 };

	// Track face position for movement detection
	const currentPosition = { x, y, width, height, time: Date.now() };

	// Calculate head movement (position)
	let headMovement = { x: 0, y: 0, z: 0 };
	if (lastFacePosition) {
		// X and Y movement from position change
		headMovement.x = (currentPosition.x - lastFacePosition.x) / 10; // Scale down for better values
		headMovement.y = (currentPosition.y - lastFacePosition.y) / 10;

		// Z movement estimation from size change
		const prevSize = lastFacePosition.width * lastFacePosition.height;
		const currentSize = currentPosition.width * currentPosition.height;
		const sizeRatio = currentSize / prevSize;
		headMovement.z = (sizeRatio - 1) * 5; // Scale for better values
	}

	// Save current position for next frame
	lastFacePosition = currentPosition;

	// Get facial landmarks for orientation
	const jaw = face.landmarks.getJawOutline();
	const nose = face.landmarks.getNose();
	const leftEyeBrow = face.landmarks.getLeftEyeBrow();
	const rightEyeBrow = face.landmarks.getRightEyeBrow();

	// Calculate pitch (up/down), yaw (left/right), and roll (tilt)
	// These are simplified estimations using 2D landmarks

	// Estimate Pitch (up/down) using nose and eyebrows
	const noseTop = nose[0];
	const noseBottom = nose[nose.length - 1];
	const noseBridge = nose[1];
	const browMidpoint = {
		x: (leftEyeBrow[2].x + rightEyeBrow[2].x) / 2,
		y: (leftEyeBrow[2].y + rightEyeBrow[2].y) / 2,
	};

	const noseLength = distance(noseTop, noseBottom);
	const browToNoseRatio = distance(browMidpoint, noseBridge) / noseLength;

	// Calculate pitch based on the relative position of brow to nose
	const pitch = (browToNoseRatio - 0.3) * 90; // Map to reasonable range

	// Estimate Yaw (left/right) using jaw position
	const jawLeft = jaw[0];
	const jawRight = jaw[jaw.length - 1];
	const jawWidth = distance(jawLeft, jawRight);
	const jawCenter = {
		x: (jawLeft.x + jawRight.x) / 2,
		y: (jawLeft.y + jawRight.y) / 2,
	};

	// Measure asymmetry to estimate yaw
	const leftJawWidth = distance(jawLeft, faceCenter);
	const rightJawWidth = distance(jawRight, faceCenter);
	const jawRatio = leftJawWidth / rightJawWidth;
	const yaw = (jawRatio - 1) * 45; // Map to reasonable range

	// Estimate Roll (tilt) using eye positions
	const leftEye = face.landmarks.getLeftEye();
	const rightEye = face.landmarks.getRightEye();
	const leftEyeCenter = calculateEyeCenter(leftEye);
	const rightEyeCenter = calculateEyeCenter(rightEye);

	// Calculate angle between eyes
	const deltaY = rightEyeCenter.y - leftEyeCenter.y;
	const deltaX = rightEyeCenter.x - leftEyeCenter.x;
	const roll = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

	return {
		position: headMovement,
		rotation: {
			pitch: pitch, // Looking up/down (positive is up)
			yaw: yaw, // Looking left/right (positive is right)
			roll: roll, // Head tilt
		},
	};
}

// Draw indicators for head pose
function drawHeadPoseIndicators(context, face, headData) {
	const { x, y, width, height } = face.detection.box;
	const centerX = x + width / 2;
	const centerY = y + height / 2;

	// Draw head position marker
	context.beginPath();
	context.arc(centerX, centerY, 5, 0, 2 * Math.PI);
	context.fillStyle = "#ff0000";
	context.fill();

	// Draw head direction indicators
	const { pitch, yaw, roll } = headData.rotation;

	// Draw pitch indicator (up/down)
	const pitchLength = 30;
	const pitchAngle = pitch * (Math.PI / 180);
	context.beginPath();
	context.moveTo(centerX, centerY);
	context.lineTo(centerX, centerY - pitchLength * Math.sin(pitchAngle));
	context.strokeStyle = "#00ff00";
	context.lineWidth = 2;
	context.stroke();

	// Draw yaw indicator (left/right)
	const yawLength = 30;
	const yawAngle = yaw * (Math.PI / 180);
	context.beginPath();
	context.moveTo(centerX, centerY);
	context.lineTo(centerX + yawLength * Math.sin(yawAngle), centerY);
	context.strokeStyle = "#0000ff";
	context.lineWidth = 2;
	context.stroke();

	// Draw roll indicator
	const rollLength = 40;
	const rollAngle = roll * (Math.PI / 180);
	context.beginPath();
	context.moveTo(centerX, centerY);
	context.lineTo(
		centerX + rollLength * Math.cos(rollAngle),
		centerY + rollLength * Math.sin(rollAngle)
	);
	context.strokeStyle = "#ff00ff";
	context.lineWidth = 2;
	context.stroke();

	// Add labels
	context.fillStyle = "#ffffff";
	context.font = "12px Arial";
	context.fillText(`Pitch: ${pitch.toFixed(1)}°`, x, y - 30);
	context.fillText(`Yaw: ${yaw.toFixed(1)}°`, x, y - 15);
	context.fillText(`Roll: ${roll.toFixed(1)}°`, x, y);
}

// Calculate gaze direction based on iris position and head pose
function calculateGazeDirection(leftEye, rightEye, headData) {
	// Get eye centers
	const leftEyeCenter = calculateEyeCenter(leftEye);
	const rightEyeCenter = calculateEyeCenter(rightEye);

	// Estimate iris positions (this is an approximation)
	const leftIris = estimateIrisPosition(leftEye);
	const rightIris = estimateIrisPosition(rightEye);

	// Calculate normalized gaze direction vectors for each eye
	const leftEyeWidth = distance(leftEye[0], leftEye[3]);
	const rightEyeWidth = distance(rightEye[0], rightEye[3]);

	// Calculate raw gaze directions with corrected left/right mapping
	// Invert the X direction to match natural movement (negative is left, positive is right)
	const leftGazeX = (-1 * (leftIris.x - leftEyeCenter.x)) / (leftEyeWidth / 2);
	const leftGazeY = (leftIris.y - leftEyeCenter.y) / (leftEyeWidth / 2);

	const rightGazeX =
		(-1 * (rightIris.x - rightEyeCenter.x)) / (rightEyeWidth / 2);
	const rightGazeY = (rightIris.y - rightEyeCenter.y) / (rightEyeWidth / 2);

	// Average the gaze directions from both eyes
	let gazeX = (leftGazeX + rightGazeX) / 2;
	let gazeY = (leftGazeY + rightGazeY) / 2;

	// Apply head pose compensation with corrected direction
	// Invert yaw compensation to match the corrected gaze direction
	const headCompensationX = (-1 * headData.rotation.yaw) / 45;
	const headCompensationY = (-1 * headData.rotation.pitch) / 45;

	// Apply head pose compensation
	gazeX += headCompensationX;
	gazeY += headCompensationY;

	// Clamp values to reasonable range
	gazeX = Math.max(-1, Math.min(1, gazeX));
	gazeY = Math.max(-1, Math.min(1, gazeY));

	// Return normalized gaze direction
	return { x: gazeX, y: gazeY };
}

// Draw gaze direction visualization
function drawGazeDirection(context, gazeData, leftEye, rightEye) {
	// Get eye centers
	const leftEyeCenter = calculateEyeCenter(leftEye);
	const rightEyeCenter = calculateEyeCenter(rightEye);

	// Calculate average eye center
	const eyeCenter = {
		x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
		y: (leftEyeCenter.y + rightEyeCenter.y) / 2,
	};

	// Calculate eye width for scaling
	const leftEyeWidth = distance(leftEye[0], leftEye[3]);
	const rightEyeWidth = distance(rightEye[0], rightEye[3]);
	const avgEyeWidth = (leftEyeWidth + rightEyeWidth) / 2;

	// Draw gaze direction line
	const gazeLength = avgEyeWidth * 3; // Scale based on eye size

	context.beginPath();
	context.moveTo(eyeCenter.x, eyeCenter.y);
	context.lineTo(
		eyeCenter.x + gazeData.x * gazeLength,
		eyeCenter.y + gazeData.y * gazeLength
	);
	context.strokeStyle = "#00ffff";
	context.lineWidth = 2;
	context.stroke();

	// Draw endpoint circle
	context.beginPath();
	context.arc(
		eyeCenter.x + gazeData.x * gazeLength,
		eyeCenter.y + gazeData.y * gazeLength,
		3,
		0,
		2 * Math.PI
	);
	context.fillStyle = "#00ffff";
	context.fill();

	// Add gaze direction label
	context.fillStyle = "#ffffff";
	context.font = "12px Arial";
	context.fillText(
		`Gaze: (${gazeData.x.toFixed(2)}, ${gazeData.y.toFixed(2)})`,
		eyeCenter.x + 10,
		eyeCenter.y - 10
	);
}

// Estimate iris position based on eye landmarks
function estimateIrisPosition(eye) {
	// This is a simplified approach - for more accurate results,
	// specific iris detection would be needed

	// Get eye center
	const eyeCenter = calculateEyeCenter(eye);

	// Get upper and lower eyelid midpoints
	const upperEyelid = {
		x: (eye[1].x + eye[2].x) / 2,
		y: (eye[1].y + eye[2].y) / 2,
	};

	const lowerEyelid = {
		x: (eye[4].x + eye[5].x) / 2,
		y: (eye[4].y + eye[5].y) / 2,
	};

	// Estimate iris position (slightly above eye center)
	return {
		x: eyeCenter.x,
		y: eyeCenter.y * 0.95 + upperEyelid.y * 0.05, // Slight adjustment upward
	};
}

// Estimate pupil diameter based on eye landmarks
function estimatePupilDiameter(leftEye, rightEye) {
	// Calculate eye opening heights
	const leftEyeHeight =
		(distance(leftEye[1], leftEye[5]) + distance(leftEye[2], leftEye[4])) / 2;

	const rightEyeHeight =
		(distance(rightEye[1], rightEye[5]) + distance(rightEye[2], rightEye[4])) /
		2;

	// Calculate eye widths
	const leftEyeWidth = distance(leftEye[0], leftEye[3]);
	const rightEyeWidth = distance(rightEye[0], rightEye[3]);

	// Average eye dimensions
	const avgEyeHeight = (leftEyeHeight + rightEyeHeight) / 2;
	const avgEyeWidth = (leftEyeWidth + rightEyeWidth) / 2;

	// Estimate pupil diameter based on eye opening
	// This is a simplified approximation - actual pupil measurement
	// would require more advanced iris detection
	const pupilDiameter = avgEyeHeight * 0.4;

	// Calculate dilation percentage (compared to eye width)
	// This is a relative measure that might be useful
	const maxPossibleDiameter = avgEyeHeight * 0.8;
	const dilationPercent = (pupilDiameter / maxPossibleDiameter) * 100;

	return {
		diameter: pupilDiameter,
		dilationPercent: dilationPercent,
	};
}

// Helper function to create default eye tracking data structure
function createDefaultEyeData() {
	return {
		blinkRate: 0,
		saccadeVelocity: 0,
		gazeDuration: 0,
		pupilDilation: 0,
		gazeDirection: { x: 0, y: 0 },
		headDirection: { pitch: 0, yaw: 0, roll: 0 },
		headPosition: { x: 0, y: 0, z: 0 },
		pupilDiameter: 0,
		pupilDilationPercent: 0,
	};
}

// Helper function to calculate image brightness
function calculateImageBrightness(pixels) {
	let totalBrightness = 0;
	let pixelCount = 0;

	for (let i = 0; i < pixels.length; i += 4) {
		// Calculate brightness as average of RGB
		const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
		totalBrightness += brightness;
		pixelCount++;
	}

	return totalBrightness / pixelCount;
}
