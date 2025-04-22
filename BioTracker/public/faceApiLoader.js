// Face API Loader - Centralized utility for managing face-api.js initialization
window.faceApiLoader = (function () {
	// Track initialization status
	let isInitialized = false;
	let isInitializing = false;
	let initPromise = null;
	let useLocalModels = true;
	let localLoadAttempted = false;

	// Default models path
	const DEFAULT_MODELS_PATH = "/models";
	const CDN_MODELS_PATH =
		"https://justadudewhohacks.github.io/face-api.js/models";

	// Determine if we're in a mobile or desktop environment
	const isMobile =
		/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
			navigator.userAgent
		);

	// Suppress TensorFlow warnings to avoid console clutter
	function suppressTensorflowWarnings() {
		if (window.tf) {
			window.tf.env().set("DEBUG", false);
			window.tf.env().set("WEBGL_CPU_FORWARD", false);
		}
	}

	// Load a single model with error handling
	async function loadModelSafely(net, modelPath) {
		try {
			console.log(`Loading model from ${modelPath}...`);
			await net.load(modelPath);
			return true;
		} catch (error) {
			console.error(`Error loading model from ${modelPath}:`, error);
			return false;
		}
	}

	// Initialize face-api with required models
	async function initializeFaceApi(forceCdn = false) {
		// If already initialized, return immediately
		if (isInitialized) {
			console.log("Face API already initialized");
			return true;
		}

		// If initialization is in progress, wait for it to complete
		if (isInitializing && initPromise) {
			return initPromise;
		}

		// Start initialization
		isInitializing = true;

		// Set model path based on forceCdn flag
		if (forceCdn) {
			useLocalModels = false;
		}

		// Create a promise to track initialization
		initPromise = new Promise(async (resolve) => {
			try {
				// Check if face-api is available
				if (typeof faceapi === "undefined") {
					console.error("Face API not found. Make sure face-api.js is loaded");
					isInitializing = false;
					resolve(false);
					return;
				}

				console.log("Starting Face API initialization");
				let successfulLoad = true;

				// Determine model path to use
				let modelPath = useLocalModels ? DEFAULT_MODELS_PATH : CDN_MODELS_PATH;
				console.log(`Using model path: ${modelPath}`);

				// Try to load SsdMobilenetv1 from CDN as fallback
				// This is needed because some functions default to this model
				if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
					try {
						console.log("Loading SsdMobilenetv1 model from CDN (fallback)...");
						await faceapi.nets.ssdMobilenetv1.load(CDN_MODELS_PATH);
						console.log("SsdMobilenetv1 loaded from CDN successfully");
					} catch (error) {
						console.warn(
							"Could not load SsdMobilenetv1 from CDN, will use TinyFaceDetector only",
							error
						);
					}
				}

				// Load TinyFaceDetector - lighter and faster than SSD
				if (!faceapi.nets.tinyFaceDetector.isLoaded) {
					const success = await loadModelSafely(
						faceapi.nets.tinyFaceDetector,
						modelPath
					);
					if (!success) successfulLoad = false;
				}

				// Load face landmark detection - required for eye tracking
				if (!faceapi.nets.faceLandmark68Net.isLoaded) {
					const success = await loadModelSafely(
						faceapi.nets.faceLandmark68Net,
						modelPath
					);
					if (!success) successfulLoad = false;
				}

				// Load face expression recognition - required for emotion detection
				if (!faceapi.nets.faceExpressionNet.isLoaded) {
					const success = await loadModelSafely(
						faceapi.nets.faceExpressionNet,
						modelPath
					);
					if (!success) successfulLoad = false;
				}

				// If local models failed and we haven't tried CDN yet, try CDN
				if (!successfulLoad && useLocalModels && !localLoadAttempted) {
					console.log("Local models failed to load. Trying CDN models...");
					localLoadAttempted = true;
					useLocalModels = false;
					isInitializing = false;
					// Retry with CDN
					const cdnSuccess = await initializeFaceApi(true);
					resolve(cdnSuccess);
					return;
				}

				// If at least some models loaded, we can proceed
				if (
					faceapi.nets.tinyFaceDetector.isLoaded &&
					faceapi.nets.faceLandmark68Net.isLoaded &&
					faceapi.nets.faceExpressionNet.isLoaded
				) {
					console.log("Face API initialization complete");
					isInitialized = true;
					isInitializing = false;
					resolve(true);
				} else {
					console.error("Failed to load all required models");
					isInitializing = false;
					resolve(false);
				}
			} catch (error) {
				console.error("Error initializing Face API:", error);

				// If we failed with local models, try CDN
				if (useLocalModels && !localLoadAttempted) {
					console.log("Error with local models, trying CDN...");
					localLoadAttempted = true;
					useLocalModels = false;
					isInitializing = false;
					// Retry with CDN
					const cdnSuccess = await initializeFaceApi(true);
					resolve(cdnSuccess);
					return;
				}

				isInitializing = false;
				resolve(false);
			}
		});

		return initPromise;
	}

	// Check if models are loaded
	function isReady() {
		return isInitialized;
	}

	// Public API
	return {
		suppressTensorflowWarnings,
		initializeFaceApi,
		isReady,
	};
})();

// If the page already has face-api loaded, initialize immediately
if (typeof faceapi !== "undefined") {
	console.log("Face API detected, initializing...");
	window.faceApiLoader.initializeFaceApi().then((success) => {
		console.log(
			"Automatic Face API initialization " + (success ? "successful" : "failed")
		);
	});
} else {
	console.log("Face API not yet loaded, will initialize when available");

	// Set up a listener to check for face-api loading
	const checkInterval = setInterval(() => {
		if (typeof faceapi !== "undefined") {
			console.log("Face API detected by interval check, initializing...");
			window.faceApiLoader.initializeFaceApi().then((success) => {
				console.log(
					"Delayed Face API initialization " +
						(success ? "successful" : "failed")
				);
				clearInterval(checkInterval);
			});
		}
	}, 1000);

	// Clear interval after 30 seconds if face-api never loads
	setTimeout(() => {
		clearInterval(checkInterval);
	}, 30000);
}
