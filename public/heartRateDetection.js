// Heart rate detection through video processing

// Global variables for heart rate detection
let lastProcessedTime = 0;
const processingInterval = 1000; // Process every 1 second
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
const signalBufferSize = 60; // 30 seconds at 2 samples per second
const signalBuffer = {
	r: Array(signalBufferSize).fill(0),
	g: Array(signalBufferSize).fill(0),
	b: Array(signalBufferSize).fill(0),
	timestamps: Array(signalBufferSize).fill(0),
};

// Buffer for storing BPM values for HRV calculation
const bpmBuffer = [];
const bpmBufferSize = 10; // Store last 10 BPM values

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

	// Ensure face-api is ready
	console.log("Ensuring face-api is ready for heart rate detection");
	const isReady = await ensureHeartRateFaceApiIsReady();
	if (!isReady) {
		console.warn("Face API not ready for heart rate detection");
		return null; // Can't process without face-api
	}

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
				"Invalid video dimensions for heart rate detection:",
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
		console.log(`Video dimensions: ${width}x${height}`);

		// Check image brightness
		const imageData = context.getImageData(0, 0, width, height);
		const brightness = calculateAverageBrightness(imageData.data);
		console.log(`Image brightness: ${brightness.toFixed(2)}`);

		if (brightness < 40) {
			console.warn(
				"Image appears too dark. Try improving lighting conditions."
			);
			return null;
		}

		// Try with different face detection options for better detection
		const options = new faceapi.TinyFaceDetectorOptions({
			inputSize: 320, // Lower input size may be faster and more reliable on mobile
			scoreThreshold: 0.3, // Lower threshold to detect faces more easily
		});

		console.log("Attempting face detection for heart rate analysis...");

		// Face detection to locate the region of interest (ROI)
		const detections = await faceapi
			.detectSingleFace(videoElement, options)
			.withFaceLandmarks();

		if (!detections) {
			console.log("No face detected for heart rate analysis");
			return null;
		}

		console.log("Face detected for heart rate analysis!");

		const {
			x,
			y,
			width: faceWidth,
			height: faceHeight,
		} = detections.detection.box;

		// Log face detection coordinates for debugging
		console.log(
			`Face detected at: x=${x}, y=${y}, width=${faceWidth}, height=${faceHeight}`
		);

		// Define ROI (forehead region)
		const roi = {
			x: Math.max(0, Math.floor(x + faceWidth * 0.2)),
			y: Math.max(0, Math.floor(y + faceHeight * 0.1)),
			width: Math.floor(faceWidth * 0.6),
			height: Math.floor(faceHeight * 0.15),
		};

		// Ensure ROI is within image boundaries
		roi.width = Math.min(roi.width, width - roi.x);
		roi.height = Math.min(roi.height, height - roi.y);

		if (roi.width <= 0 || roi.height <= 0) {
			console.error("Invalid ROI dimensions:", roi);
			return null;
		}

		console.log("Extracting ROI for heart rate detection:", roi);

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
			console.error("No pixels found in ROI");
			return null;
		}

		const avgR = totalR / pixelCount;
		const avgG = totalG / pixelCount;
		const avgB = totalB / pixelCount;

		// Log average color values for debugging
		console.log(
			`ROI average RGB: R=${avgR.toFixed(2)}, G=${avgG.toFixed(
				2
			)}, B=${avgB.toFixed(2)}`
		);

		// Store the signal values
		rgbSignals.r.push(avgR);
		rgbSignals.g.push(avgG);
		rgbSignals.b.push(avgB);
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
		console.log(`Heart rate signal points collected: ${rgbSignals.g.length}`);

		// If we have enough data points, calculate heart rate
		if (rgbSignals.g.length >= 4) {
			// Need at least 4 data points for analysis
			console.log("Calculating heart rate from collected signal...");
			const heartRate = calculateHeartRate(rgbSignals.g, timestamps);

			if (heartRate) {
				console.log(`Calculated heart rate: ${heartRate.toFixed(1)} BPM`);
				lastHeartRates.push(heartRate);

				// Keep only the last 5 heart rate values
				if (lastHeartRates.length > 5) {
					lastHeartRates.shift();
				}

				// Return the average of the last heart rates to smooth results
				const avgHeartRate =
					lastHeartRates.reduce((sum, rate) => sum + rate, 0) /
					lastHeartRates.length;

				const confidence = calculateConfidence(lastHeartRates);
				console.log(
					`Average heart rate: ${avgHeartRate.toFixed(
						1
					)} BPM, confidence: ${confidence.toFixed(2)}`
				);

				return {
					bpm: avgHeartRate,
					confidence: confidence,
				};
			} else {
				console.log("Failed to calculate heart rate from the collected signal");
			}
		} else {
			console.log(
				`Not enough data points yet: ${rgbSignals.g.length}/4 minimum required`
			);
		}

		return null;
	} catch (error) {
		console.error("Error in heart rate detection:", error);
		return null;
	}
}

// Calculate heart rate from the green channel signal
function calculateHeartRate(signal, times) {
	if (signal.length < 4 || times.length < 4) return null;

	try {
		// Normalize the signal by subtracting the mean
		const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
		const normalizedSignal = signal.map((val) => val - mean);

		// Apply a simple moving average filter to smooth the signal
		const smoothedSignal = smoothSignal(normalizedSignal, 3);

		// Find peaks in the signal
		const peaks = findPeaks(smoothedSignal);

		if (peaks.length < 2) {
			return null; // Need at least 2 peaks to calculate heart rate
		}

		// Calculate time intervals between peaks
		const intervals = [];
		for (let i = 1; i < peaks.length; i++) {
			intervals.push(times[peaks[i]] - times[peaks[i - 1]]);
		}

		// Calculate average time interval in seconds
		const avgInterval =
			intervals.reduce((sum, val) => sum + val, 0) / intervals.length / 1000;

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

// Smooth the signal using a moving average filter
function smoothSignal(signal, windowSize) {
	const result = [];

	for (let i = 0; i < signal.length; i++) {
		let sum = 0;
		let count = 0;

		for (
			let j = Math.max(0, i - windowSize);
			j <= Math.min(signal.length - 1, i + windowSize);
			j++
		) {
			sum += signal[j];
			count++;
		}

		result.push(sum / count);
	}

	return result;
}

// Find peaks in the signal
function findPeaks(signal) {
	const peaks = [];

	for (let i = 1; i < signal.length - 1; i++) {
		if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
			peaks.push(i);
		}
	}

	return peaks;
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
	let confidence = Math.max(0, 1 - cv * 4);
	confidence = Math.min(1, confidence); // Clamp to [0, 1]

	return confidence;
}

// Helper function to calculate the average brightness of an image
function calculateAverageBrightness(pixels) {
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
