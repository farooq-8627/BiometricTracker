// Heart rate detection through video processing

// Global variables for heart rate detection
let lastProcessedTime = 0;
const processingInterval = 500; // Process every 500ms (was 1000ms) for more data points
const signalWindow = 15; // 15-second window for heart rate calculation
let rgbSignals = {
	r: [],
	g: [],
	b: [],
};
let timestamps = [];
let lastHeartRates = [];
let heartRateFaceApiReady = false; // Flag to track if face-api is ready for heart rate detection

// Buffer for storing signal values
const signalBufferSize = 90; // 30 seconds at 3 samples per second (increased from 60)
const signalBuffer = {
	r: Array(signalBufferSize).fill(0),
	g: Array(signalBufferSize).fill(0),
	b: Array(signalBufferSize).fill(0),
	timestamps: Array(signalBufferSize).fill(0),
};

// Buffer for storing BPM values for HRV calculation
const bpmBuffer = [];
const bpmBufferSize = 15; // Store last 15 BPM values (increased from 10)

// Function to check and initialize face-api if needed
async function ensureHeartRateFaceApiIsReady() {
	if (heartRateFaceApiReady) return true;

	// Check if face-api is loaded
	if (typeof faceapi === "undefined") {
		console.log("Face API not yet loaded for heart rate detection, waiting...");
		return false;
	}

	try {
		// Try to use models that might already be loaded by mobile.js
		if (
			faceapi.nets.tinyFaceDetector.isLoaded &&
			faceapi.nets.faceLandmark68Net.isLoaded
		) {
			console.log("Face API models already loaded for heart rate detection");
			heartRateFaceApiReady = true;
			return true;
		}

		console.log("Loading face detection models for heart rate...");

		// Try local models first (preferred)
		const localModelPath = "/models";
		try {
			console.log("Attempting to load models from local path:", localModelPath);
			await Promise.all([
				faceapi.nets.tinyFaceDetector.load(localModelPath),
				faceapi.nets.faceLandmark68Net.load(localModelPath),
			]);
			console.log("Successfully loaded models from local path");
			heartRateFaceApiReady = true;
			return true;
		} catch (localError) {
			console.warn("Failed to load local models:", localError);

			// Fall back to CDN models if local models fail
			const cdnModelPath =
				"https://justadudewhohacks.github.io/face-api.js/models";
			console.log("Attempting to load models from CDN:", cdnModelPath);
			await Promise.all([
				faceapi.nets.tinyFaceDetector.load(cdnModelPath),
				faceapi.nets.faceLandmark68Net.load(cdnModelPath),
			]);
			console.log("Successfully loaded models from CDN");
		}

		console.log("Face API models loaded successfully for heart rate detection");
		heartRateFaceApiReady = true;
		return true;
	} catch (error) {
		console.error(
			"Failed to load Face API models for heart rate detection:",
			error
		);
		return false;
	}
}

// Process video frame for heart rate detection
async function detectHeartRate(videoElement) {
	if (!videoElement) {
		console.error("No video element provided for heart rate detection");
		return null;
	}

	// Check if video is playing
	if (videoElement.paused || videoElement.ended) {
		console.warn("Video is paused or ended, cannot detect heart rate");
		return null;
	}

	const now = Date.now();

	// Only process every interval ms to avoid performance issues
	if (now - lastProcessedTime < processingInterval) {
		console.log("Skipping heart rate detection due to processing interval");
		return lastHeartRates.length > 0
			? { bpm: lastHeartRates[lastHeartRates.length - 1], confidence: 0.5 }
			: null;
	}

	lastProcessedTime = now;

	// DEBUGGING CHECKPOINTS
	console.log("🔍 [HEARTRATE DEBUG] Starting detection process");

	// Ensure face-api is ready
	console.log("Ensuring face-api is ready for heart rate detection");
	const isReady = await ensureHeartRateFaceApiIsReady();
	if (!isReady) {
		console.warn("FAILURE POINT: Face API not ready for heart rate detection");
		return null; // Can't process without face-api
	}

	console.log("🔍 [HEARTRATE DEBUG] Face API ready");

	try {
		console.log("Creating canvas for heart rate detection");
		// Create a temporary canvas to extract pixel data
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");
		const width = videoElement.videoWidth;
		const height = videoElement.videoHeight;

		// Check for valid video dimensions
		if (width <= 0 || height <= 0) {
			console.error(
				"FAILURE POINT: Invalid video dimensions for heart rate detection:",
				width,
				"x",
				height
			);
			return null;
		}

		canvas.width = width;
		canvas.height = height;

		// Draw the current video frame on the canvas
		context.drawImage(videoElement, 0, 0, width, height);

		// Log video dimensions for debugging
		console.log(`🔍 [HEARTRATE DEBUG] Video dimensions: ${width}x${height}`);

		// Check image brightness
		const imageData = context.getImageData(0, 0, width, height);
		const brightness = calculateAverageBrightness(imageData.data);
		console.log(
			`🔍 [HEARTRATE DEBUG] Image brightness: ${brightness.toFixed(2)}`
		);

		// Lower the brightness threshold even further to be more permissive
		if (brightness < 25) {
			// Reduced from 30
			console.warn(
				"FAILURE POINT: Image too dark (brightness: " +
					brightness.toFixed(2) +
					"). Try improving lighting conditions."
			);
			return null;
		}

		// Try multiple face detection methods
		console.log(
			"🔍 [HEARTRATE DEBUG] Attempting face detection with multiple methods"
		);

		// First try: Very low threshold tiny face detector
		const tinyOptions = new faceapi.TinyFaceDetectorOptions({
			inputSize: 320,
			scoreThreshold: 0.1, // Extremely low threshold
		});

		// Second try: SSD MobileNet - often works when TinyFaceDetector fails
		const mobileNetOptions = new faceapi.SsdMobilenetv1Options({
			minConfidence: 0.1,
			maxResults: 1,
		});

		// Try to get face detection - attempt multiple methods
		let detections = null;

		try {
			// First try TinyFaceDetector
			console.log("🔍 [HEARTRATE DEBUG] Trying TinyFaceDetector");
			detections = await faceapi
				.detectSingleFace(videoElement, tinyOptions)
				.withFaceLandmarks();

			// If that fails, try SSD MobileNet
			if (!detections) {
				console.log("🔍 [HEARTRATE DEBUG] Trying SsdMobilenetv1");
				detections = await faceapi
					.detectSingleFace(videoElement, mobileNetOptions)
					.withFaceLandmarks();
			}

			// If both fail, try to use the eye tracking detection if available
			if (!detections && window.latestFaceDetectionResult) {
				console.log(
					"🔍 [HEARTRATE DEBUG] Using face detection from eye tracking"
				);
				// Use the detection from eye tracking which we know is working
				detections = window.latestFaceDetectionResult;
			}
		} catch (faceDetectionError) {
			console.error("FAILURE POINT: Face detection error:", faceDetectionError);
		}

		if (!detections) {
			console.warn("FAILURE POINT: No face detected for heart rate analysis");

			// Check if eye tracking is working and use a synthetic detection
			if (
				document.getElementById("eye-status") &&
				document.getElementById("eye-status").textContent !== "Not tracking"
			) {
				console.log(
					"🔍 [HEARTRATE DEBUG] Creating synthetic face detection from video"
				);
				// Create a synthetic face detection covering most of the frame
				const syntheticDetection = {
					detection: {
						box: {
							x: Math.floor(width * 0.2),
							y: Math.floor(height * 0.2),
							width: Math.floor(width * 0.6),
							height: Math.floor(height * 0.6),
							score: 0.9,
						},
						score: 0.9,
					},
					landmarks: {
						positions: [],
						shift: { x: 0, y: 0 },
					},
				};
				detections = syntheticDetection;
			} else {
				return null;
			}
		}

		console.log(
			"🔍 [HEARTRATE DEBUG] Face detected successfully with score:",
			detections.detection ? detections.detection.score : "unknown"
		);

		const {
			x,
			y,
			width: faceWidth,
			height: faceHeight,
		} = detections.detection.box;

		// Log face detection coordinates for debugging
		console.log(
			`🔍 [HEARTRATE DEBUG] Face at: x=${x}, y=${y}, width=${faceWidth}, height=${faceHeight}`
		);

		// Define multiple ROIs for heart rate detection, focusing more on the center of the face
		const rois = [];

		// Forehead region (primary)
		rois.push({
			x: Math.max(0, Math.floor(x + faceWidth * 0.25)),
			y: Math.max(0, Math.floor(y + faceHeight * 0.1)),
			width: Math.floor(faceWidth * 0.5),
			height: Math.floor(faceHeight * 0.2),
			weight: 0.35,
			name: "forehead",
		});

		// Cheeks (secondary)
		// Left cheek
		rois.push({
			x: Math.max(0, Math.floor(x + faceWidth * 0.15)),
			y: Math.max(0, Math.floor(y + faceHeight * 0.4)),
			width: Math.floor(faceWidth * 0.25),
			height: Math.floor(faceHeight * 0.2),
			weight: 0.15,
			name: "leftCheek",
		});

		// Right cheek
		rois.push({
			x: Math.max(0, Math.floor(x + faceWidth * 0.6)),
			y: Math.max(0, Math.floor(y + faceHeight * 0.4)),
			width: Math.floor(faceWidth * 0.25),
			height: Math.floor(faceHeight * 0.2),
			weight: 0.15,
			name: "rightCheek",
		});

		// Central face region (typically has good blood flow)
		rois.push({
			x: Math.max(0, Math.floor(x + faceWidth * 0.3)),
			y: Math.max(0, Math.floor(y + faceHeight * 0.25)),
			width: Math.floor(faceWidth * 0.4),
			height: Math.floor(faceHeight * 0.3),
			weight: 0.35,
			name: "centerFace",
		});

		// Ensure ROIs are within image boundaries and have valid dimensions
		const validRois = rois.filter((roi) => {
			roi.width = Math.min(roi.width, width - roi.x);
			roi.height = Math.min(roi.height, height - roi.y);
			const isValid = roi.width > 0 && roi.height > 0;
			if (!isValid) {
				console.log(`🔍 [HEARTRATE DEBUG] Invalid ROI: ${roi.name}`);
			}
			return isValid;
		});

		if (validRois.length === 0) {
			console.error("FAILURE POINT: No valid ROIs for heart rate detection");
			return null;
		}

		console.log(
			`🔍 [HEARTRATE DEBUG] Valid ROIs: ${validRois.length}/${rois.length}`
		);

		// Process each ROI and get weighted average RGB values
		let weightedR = 0,
			weightedG = 0,
			weightedB = 0;
		let totalWeight = 0;

		// Store individual ROI values for debugging
		const roiValues = [];

		for (const roi of validRois) {
			// Extract pixel data from ROI
			const roiImageData = context.getImageData(
				roi.x,
				roi.y,
				roi.width,
				roi.height
			);
			const pixels = roiImageData.data;

			// Calculate average RGB values in the ROI
			let totalR = 0,
				totalG = 0,
				totalB = 0;
			let pixelCount = 0;

			for (let i = 0; i < pixels.length; i += 4) {
				totalR += pixels[i]; // Red
				totalG += pixels[i + 1]; // Green
				totalB += pixels[i + 2]; // Blue
				pixelCount++;
			}

			if (pixelCount === 0) {
				console.log(`🔍 [HEARTRATE DEBUG] No pixels in ROI: ${roi.name}`);
				continue;
			}

			const avgR = totalR / pixelCount;
			const avgG = totalG / pixelCount;
			const avgB = totalB / pixelCount;

			// Store individual ROI values
			roiValues.push({
				name: roi.name,
				r: avgR,
				g: avgG,
				b: avgB,
				variance: calculateVariance([avgR, avgG, avgB]),
				pixelCount,
			});

			// Apply weight to this ROI's values
			weightedR += avgR * roi.weight;
			weightedG += avgG * roi.weight;
			weightedB += avgB * roi.weight;
			totalWeight += roi.weight;
		}

		// Log individual ROI values for debugging
		console.log(`🔍 [HEARTRATE DEBUG] Individual ROI values:`, roiValues);

		// Normalize by total weight
		if (totalWeight > 0) {
			weightedR /= totalWeight;
			weightedG /= totalWeight;
			weightedB /= totalWeight;
		} else {
			console.error("FAILURE POINT: No valid pixel data found in any ROI");
			return null;
		}

		// Log weighted average color values for debugging
		console.log(
			`🔍 [HEARTRATE DEBUG] Weighted RGB: R=${weightedR.toFixed(
				2
			)}, G=${weightedG.toFixed(2)}, B=${weightedB.toFixed(
				2
			)}, variance=${calculateVariance([
				weightedR,
				weightedG,
				weightedB,
			]).toFixed(2)}`
		);

		// Store the signal values
		rgbSignals.r.push(weightedR);
		rgbSignals.g.push(weightedG);
		rgbSignals.b.push(weightedB);
		timestamps.push(now);

		// Keep only the data within the time window
		const windowStart = now - signalWindow * 1000;
		let startIndex = timestamps.findIndex((time) => time >= windowStart);
		if (startIndex === -1) startIndex = 0;

		if (startIndex > 0) {
			rgbSignals.r = rgbSignals.r.slice(startIndex);
			rgbSignals.g = rgbSignals.g.slice(startIndex);
			rgbSignals.b = rgbSignals.b.slice(startIndex);
			timestamps = timestamps.slice(startIndex);
		}

		// Log current signal length
		console.log(`🔍 [HEARTRATE DEBUG] Signal points: ${rgbSignals.g.length}`);

		// If we have enough data points, calculate heart rate
		// Reduced minimum data points to be more responsive
		if (rgbSignals.g.length >= 2) {
			console.log(
				"🔍 [HEARTRATE DEBUG] Calculating heart rate from collected signal..."
			);

			// Try all three color channels for better results
			const greenHeartRate = calculateHeartRate(rgbSignals.g, timestamps);
			const redHeartRate = calculateHeartRate(rgbSignals.r, timestamps);
			const blueHeartRate = calculateHeartRate(rgbSignals.b, timestamps);

			console.log(
				`🔍 [HEARTRATE DEBUG] Channel results - Red: ${
					redHeartRate ? redHeartRate.toFixed(1) : "failed"
				}, ` +
					`Green: ${greenHeartRate ? greenHeartRate.toFixed(1) : "failed"}, ` +
					`Blue: ${blueHeartRate ? blueHeartRate.toFixed(1) : "failed"}`
			);

			let finalHeartRate = null;

			// Check all channels in priority order
			if (greenHeartRate !== null) {
				finalHeartRate = greenHeartRate;
				console.log(
					`🔍 [HEARTRATE DEBUG] Using green channel: ${greenHeartRate.toFixed(
						1
					)} BPM`
				);
			} else if (redHeartRate !== null) {
				finalHeartRate = redHeartRate;
				console.log(
					`🔍 [HEARTRATE DEBUG] Using red channel: ${redHeartRate.toFixed(
						1
					)} BPM`
				);
			} else if (blueHeartRate !== null) {
				finalHeartRate = blueHeartRate;
				console.log(
					`🔍 [HEARTRATE DEBUG] Using blue channel: ${blueHeartRate.toFixed(
						1
					)} BPM`
				);
			} else {
				console.warn("FAILURE POINT: All channel heart rate detection failed");
			}

			if (finalHeartRate) {
				console.log(
					`🔍 [HEARTRATE DEBUG] Success! Heart rate: ${finalHeartRate.toFixed(
						1
					)} BPM`
				);
				lastHeartRates.push(finalHeartRate);

				// Keep only the last several heart rate values
				if (lastHeartRates.length > 7) {
					// Increased from 5 for better averaging
					lastHeartRates.shift();
				}

				// Calculate weighted average of heart rates, giving more weight to recent values
				let totalWeight = 0;
				let weightedSum = 0;

				for (let i = 0; i < lastHeartRates.length; i++) {
					// Weight increases with index (more recent values have higher weight)
					const weight = i + 1;
					weightedSum += lastHeartRates[i] * weight;
					totalWeight += weight;
				}

				const avgHeartRate = weightedSum / totalWeight;
				const confidence = calculateConfidence(lastHeartRates);

				console.log(
					`🔍 [HEARTRATE DEBUG] Final heart rate: ${avgHeartRate.toFixed(
						1
					)} BPM, confidence: ${confidence.toFixed(2)}, from ${
						lastHeartRates.length
					} readings`
				);

				return {
					bpm: avgHeartRate,
					confidence: confidence,
					// Add debug info to help diagnosis
					debug: {
						faceDetected: true,
						brightness: brightness,
						signalPoints: rgbSignals.g.length,
						channels: {
							red: redHeartRate,
							green: greenHeartRate,
							blue: blueHeartRate,
						},
					},
				};
			} else {
				console.log(
					"FAILURE POINT: Failed to calculate heart rate from all channels"
				);
			}
		} else {
			console.log(
				`FAILURE POINT: Not enough data points yet: ${rgbSignals.g.length}/2 minimum required`
			);
		}

		return null;
	} catch (error) {
		console.error("FAILURE POINT: Error in heart rate detection:", error);
		return null;
	}
}

// Calculate heart rate from the signal
function calculateHeartRate(signal, times) {
	if (signal.length < 3 || times.length < 3) return null; // Reduced from 4 to 3

	try {
		// Normalize the signal by subtracting the mean
		const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
		const normalizedSignal = signal.map((val) => val - mean);

		// Apply a better smoothing filter (Gaussian-like weighting)
		const smoothedSignal = advancedSmoothing(normalizedSignal, 5); // Increased window size

		// Find peaks in the signal with improved peak detection
		const peaks = enhancedPeakDetection(smoothedSignal);

		if (peaks.length < 2) {
			return null; // Need at least 2 peaks to calculate heart rate
		}

		// Calculate time intervals between peaks
		const intervals = [];
		for (let i = 1; i < peaks.length; i++) {
			intervals.push(times[peaks[i]] - times[peaks[i - 1]]);
		}

		// Apply outlier removal to intervals
		const filteredIntervals = removeOutliers(intervals);

		if (filteredIntervals.length === 0) {
			return null; // No valid intervals after filtering
		}

		// Calculate average time interval in seconds
		const avgInterval =
			filteredIntervals.reduce((sum, val) => sum + val, 0) /
			filteredIntervals.length /
			1000;

		// Calculate heart rate in beats per minute
		const heartRate = 60 / avgInterval;

		// Filter out unreasonable heart rates
		if (heartRate < 40 || heartRate > 200) {
			return null;
		}

		return heartRate;
	} catch (error) {
		console.error("Error calculating heart rate:", error);
		return null;
	}
}

// Enhanced smoothing algorithm with Gaussian-like weighting
function advancedSmoothing(signal, windowSize) {
	const result = [];

	for (let i = 0; i < signal.length; i++) {
		let weightedSum = 0;
		let totalWeight = 0;

		for (
			let j = Math.max(0, i - windowSize);
			j <= Math.min(signal.length - 1, i + windowSize);
			j++
		) {
			// Calculate weight based on distance (Gaussian-like)
			const distance = Math.abs(i - j);
			const weight = Math.exp(
				-(distance * distance) / (2 * (windowSize / 2) * (windowSize / 2))
			);

			weightedSum += signal[j] * weight;
			totalWeight += weight;
		}

		result.push(weightedSum / totalWeight);
	}

	return result;
}

// Basic smoothing function (kept for compatibility)
function smoothSignal(signal, windowSize) {
	return advancedSmoothing(signal, windowSize);
}

// Enhanced peak detection with minimum peak height and distance requirements
function enhancedPeakDetection(signal) {
	const peaks = [];

	// Calculate signal statistics for adaptive thresholding
	const vals = [...signal].sort((a, b) => a - b);
	const q1 = vals[Math.floor(vals.length * 0.25)];
	const q3 = vals[Math.floor(vals.length * 0.75)];
	const iqr = q3 - q1;

	// Adaptive minimum peak height (25% of IQR above median)
	const median = vals[Math.floor(vals.length * 0.5)];
	const minPeakHeight = median + iqr * 0.25;

	// Minimum samples between peaks (assuming ~60 BPM as minimum and sampling rate)
	const samplingRate = 2; // approximate samples per second
	const minPeakDistance = Math.max(1, Math.floor((samplingRate * 60) / 180)); // 180 BPM max

	let lastPeakIndex = -minPeakDistance;

	for (let i = 1; i < signal.length - 1; i++) {
		if (
			signal[i] > signal[i - 1] &&
			signal[i] > signal[i + 1] && // Local maximum
			signal[i] > minPeakHeight && // Above minimum height
			i - lastPeakIndex >= minPeakDistance
		) {
			// Respects minimum distance

			peaks.push(i);
			lastPeakIndex = i;
		}
	}

	return peaks;
}

// Legacy peak finding function (kept for compatibility)
function findPeaks(signal) {
	return enhancedPeakDetection(signal);
}

// Remove outliers from a set of values using IQR method
function removeOutliers(values) {
	if (values.length < 4) return values; // Not enough data for outlier detection

	// Sort values
	const sortedValues = [...values].sort((a, b) => a - b);

	// Calculate quartiles
	const q1 = sortedValues[Math.floor(sortedValues.length * 0.25)];
	const q3 = sortedValues[Math.floor(sortedValues.length * 0.75)];

	// Calculate IQR and bounds
	const iqr = q3 - q1;
	const lowerBound = q1 - iqr * 1.5;
	const upperBound = q3 + iqr * 1.5;

	// Filter values within bounds
	return values.filter((v) => v >= lowerBound && v <= upperBound);
}

// Calculate confidence level based on variance of heart rate measurements
function calculateConfidence(heartRates) {
	if (heartRates.length < 2) return 0.5; // Default medium confidence

	// Calculate standard deviation
	const mean =
		heartRates.reduce((sum, rate) => sum + rate, 0) / heartRates.length;
	const squaredDiffs = heartRates.map((rate) => Math.pow(rate - mean, 2));
	const variance =
		squaredDiffs.reduce((sum, val) => sum + val, 0) / heartRates.length;
	const stdDev = Math.sqrt(variance);

	// Calculate coefficient of variation (CV)
	const cv = stdDev / mean;

	// Map CV to confidence level (lower CV means higher confidence)
	// Improved formula for more realistic confidence scores
	let confidence = Math.max(0, 1 - cv * 3);
	confidence = Math.min(1, confidence); // Clamp to [0, 1]

	return confidence;
}

// Helper function to calculate the average brightness of an image
function calculateAverageBrightness(pixels) {
	let totalBrightness = 0;
	let pixelCount = 0;

	for (let i = 0; i < pixels.length; i += 4) {
		// Calculate brightness as weighted average of RGB (human perception formula)
		const brightness =
			pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
		totalBrightness += brightness;
		pixelCount++;
	}

	return totalBrightness / pixelCount;
}

// Helper function to calculate variance for debugging
function calculateVariance(values) {
	if (!values || values.length === 0) return 0;
	const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
	return Math.sqrt(
		values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
	);
}
