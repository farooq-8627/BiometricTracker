// Utility for downloading face-api.js models to IndexedDB for offline use

// Base model URL and model filenames to download
const MODEL_URL = "/models";
const CDN_MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";
const MODELS = [
	"tiny_face_detector_model-weights_manifest.json",
	"tiny_face_detector_model-shard1",
	"face_landmark_68_model-weights_manifest.json",
	"face_landmark_68_model-shard1",
	"face_expression_model-weights_manifest.json",
	"face_expression_model-shard1",
];

// Function to check if models need to be downloaded
async function checkModelsDownloadNeeded() {
	try {
		// Check if models are already available in browser cache
		if (!window.faceapi) {
			console.log("Face API not loaded yet, deferring model check");
			return;
		}

		const modelPath = MODEL_URL;
		let modelsLoaded = false;

		try {
			// Try to load the tiny face detector model as a test
			modelsLoaded =
				faceapi.nets.tinyFaceDetector.isLoaded &&
				faceapi.nets.faceLandmark68Net.isLoaded &&
				faceapi.nets.faceExpressionNet.isLoaded;
		} catch (e) {
			modelsLoaded = false;
		}

		if (!modelsLoaded) {
			console.log("Models not loaded, showing download prompt");
			// Make the download button more noticeable
			const downloadBtn = document.getElementById("download-models-btn");
			if (downloadBtn) {
				downloadBtn.style.animation = "pulse 2s infinite";

				// Add the pulse animation if it doesn't exist
				if (!document.getElementById("pulse-animation")) {
					const style = document.createElement("style");
					style.id = "pulse-animation";
					style.textContent = `
						@keyframes pulse {
							0% { transform: scale(1); }
							50% { transform: scale(1.05); background-color: #4cc9f0; }
							100% { transform: scale(1); }
						}
					`;
					document.head.appendChild(style);
				}
			}
		}
	} catch (error) {
		console.error("Error checking for models:", error);
	}
}

// Function to download models from a specific URL
async function downloadModelsFrom(modelPath) {
	console.log(`Attempting to download models from: ${modelPath}`);

	let totalModels = 3; // We're loading 3 model types
	let loadedModels = 0;
	let success = true;

	// Load TinyFaceDetector
	if (!faceapi.nets.tinyFaceDetector.isLoaded) {
		try {
			await faceapi.nets.tinyFaceDetector.load(modelPath);
			loadedModels++;
		} catch (error) {
			console.error("Failed to load TinyFaceDetector:", error);
			success = false;
		}
	} else {
		loadedModels++;
	}

	// Load FaceLandmark68Net
	if (!faceapi.nets.faceLandmark68Net.isLoaded) {
		try {
			await faceapi.nets.faceLandmark68Net.load(modelPath);
			loadedModels++;
		} catch (error) {
			console.error("Failed to load FaceLandmark68Net:", error);
			success = false;
		}
	} else {
		loadedModels++;
	}

	// Load FaceExpressionNet
	if (!faceapi.nets.faceExpressionNet.isLoaded) {
		try {
			await faceapi.nets.faceExpressionNet.load(modelPath);
			loadedModels++;
		} catch (error) {
			console.error("Failed to load FaceExpressionNet:", error);
			success = false;
		}
	} else {
		loadedModels++;
	}

	return {
		success: loadedModels === totalModels && success,
		loadedCount: loadedModels,
	};
}

// Function to download and cache face-api.js models
async function downloadFaceApiModels() {
	try {
		// Update UI to show download in progress
		const downloadBtn = document.getElementById("download-models-btn");
		const mobileDownloadBtn = document.getElementById("mobile-download-models");

		if (downloadBtn) {
			downloadBtn.textContent = "Downloading models...";
			downloadBtn.disabled = true;
		}

		if (mobileDownloadBtn) {
			mobileDownloadBtn.textContent = "Downloading models...";
			mobileDownloadBtn.disabled = true;
		}

		// Create a toast notification
		const toast = document.createElement("div");
		toast.className = "toast-notification";
		toast.textContent = "Downloading face detection models...";
		document.body.appendChild(toast);

		// Add toast CSS if not already added
		if (!document.getElementById("toast-css")) {
			const style = document.createElement("style");
			style.id = "toast-css";
			style.textContent = `
				.toast-notification {
					position: fixed;
					bottom: 20px;
					left: 50%;
					transform: translateX(-50%);
					background-color: rgba(0, 0, 0, 0.8);
					color: white;
					padding: 10px 20px;
					border-radius: 5px;
					z-index: 1000;
					transition: opacity 0.5s;
				}
				.toast-progress {
					display: block;
					margin-top: 5px;
					width: 100%;
					height: 4px;
					background-color: #666;
					border-radius: 2px;
					overflow: hidden;
				}
				.toast-progress-bar {
					height: 100%;
					background-color: #4cc9f0;
					width: 0%;
					transition: width 0.2s;
				}
			`;
			document.head.appendChild(style);
		}

		// Add progress bar to toast
		const progressContainer = document.createElement("div");
		progressContainer.className = "toast-progress";
		const progressBar = document.createElement("div");
		progressBar.className = "toast-progress-bar";
		progressContainer.appendChild(progressBar);
		toast.appendChild(progressContainer);

		// Make sure face-api is available
		if (typeof faceapi === "undefined") {
			console.error("Face API not loaded. Cannot download models.");
			toast.textContent = "Error: Face API not loaded.";
			setTimeout(() => {
				toast.style.opacity = 0;
				setTimeout(() => toast.remove(), 500);
			}, 3000);
			return false;
		}

		// Try to load from local models first
		const modelPath = MODEL_URL;
		toast.textContent = "Downloading local models...";
		progressBar.style.width = "20%";

		// Try loading from local models first
		let result = await downloadModelsFrom(modelPath);

		// If local models failed, try the CDN
		if (!result.success) {
			toast.textContent = "Local models failed, trying CDN...";
			progressBar.style.width = "50%";
			console.log("Local models failed, trying CDN...");

			// Try to download from CDN
			result = await downloadModelsFrom(CDN_MODEL_URL);
		}

		// Update UI based on success or failure
		if (result.success) {
			// Update UI to show download complete
			toast.textContent = "Models loaded successfully!";
			progressBar.style.width = "100%";
			progressBar.style.backgroundColor = "#4BB543";

			setTimeout(() => {
				toast.style.opacity = 0;
				setTimeout(() => toast.remove(), 500);
			}, 3000);

			if (downloadBtn) {
				downloadBtn.textContent = "Models Downloaded";
				downloadBtn.style.backgroundColor = "#4BB543";
				downloadBtn.disabled = false;
				downloadBtn.style.animation = "none";
			}

			if (mobileDownloadBtn) {
				mobileDownloadBtn.textContent = "Models Downloaded";
				mobileDownloadBtn.style.backgroundColor = "#4BB543";
				mobileDownloadBtn.disabled = false;
			}

			console.log("All models loaded successfully");
			return true;
		} else {
			// Show error UI
			console.error("Error loading models");
			toast.textContent = `Failed to load all models (${result.loadedCount}/3)`;
			toast.style.backgroundColor = "rgba(220, 53, 69, 0.9)";

			setTimeout(() => {
				toast.style.opacity = 0;
				setTimeout(() => toast.remove(), 500);
			}, 5000);

			if (downloadBtn) {
				downloadBtn.textContent = "Download Models";
				downloadBtn.disabled = false;
			}

			if (mobileDownloadBtn) {
				mobileDownloadBtn.textContent = "Download Models";
				mobileDownloadBtn.disabled = false;
			}

			return false;
		}
	} catch (error) {
		console.error("Error in downloadFaceApiModels:", error);
		return false;
	}
}

// Export functions for use in other scripts
window.downloadFaceApiModels = downloadFaceApiModels;
window.checkModelsDownloadNeeded = checkModelsDownloadNeeded;
