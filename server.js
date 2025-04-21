const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const WebSocket = require("ws");

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
	cors: {
		origin: "*",
		methods: ["GET", "POST"],
	},
});

// Initialize WebSocket server on the same HTTP server but with a different path
const wss = new WebSocket.Server({
	server: server,
	path: "/ws",
});

// Store WebSocket clients
const wsClients = {
	mobile: new Map(),
	laptop: new Map(),
};

// WebSocket connection handling
wss.on("connection", (ws) => {
	console.log("New WebSocket client connected");

	// Generate a unique ID for this connection
	const wsId = generateUniqueId();
	ws.id = wsId;

	// Listen for messages from the client
	ws.on("message", (message) => {
		try {
			const data = JSON.parse(message);

			// Handle message types
			switch (data.type) {
				case "register":
					handleRegister(ws, data.deviceType);
					break;
				case "pair_request":
					handlePairRequest(ws, data.targetId);
					break;
				case "pair_accept":
					handlePairAccept(ws, data.targetId);
					break;
				case "eye_tracking_data":
					handleEyeTrackingData(ws, data);
					break;
				case "heart_rate_data":
					handleHeartRateData(ws, data);
					break;
				case "biofeedback":
					handleBiofeedback(ws, data);
					break;
				default:
					console.log("Unknown message type:", data.type);
			}
		} catch (error) {
			console.error("Error parsing WebSocket message:", error);
		}
	});

	// Handle client disconnect
	ws.on("close", () => {
		handleDisconnect(ws);
	});
});

// WebSocket utility functions
function generateUniqueId() {
	return (
		Math.random().toString(36).substring(2, 15) +
		Math.random().toString(36).substring(2, 15)
	);
}

function sendToWebSocket(ws, data) {
	if (ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(data));
	}
}

// WebSocket message handlers
function handleRegister(ws, deviceType) {
	console.log(`WebSocket client ${ws.id} registered as ${deviceType}`);

	if (deviceType === "mobile") {
		wsClients.mobile.set(ws.id, ws);

		// Send available laptops to the mobile client
		const availableLaptops = Array.from(wsClients.laptop.keys());
		sendToWebSocket(ws, {
			type: "available_laptops",
			laptops: availableLaptops,
		});

		// Notify laptop clients about the new mobile
		wsClients.laptop.forEach((laptopWs) => {
			sendToWebSocket(laptopWs, {
				type: "mobile_connected",
				mobileId: ws.id,
			});
		});
	} else if (deviceType === "laptop") {
		wsClients.laptop.set(ws.id, ws);

		// Send available mobiles to the laptop client
		const availableMobiles = Array.from(wsClients.mobile.keys());
		sendToWebSocket(ws, {
			type: "available_mobiles",
			mobiles: availableMobiles,
		});
	}
}

function handlePairRequest(ws, targetId) {
	console.log(`Pairing request from ${ws.id} to ${targetId}`);

	// Find the target WebSocket client
	const targetWs =
		wsClients.mobile.get(targetId) || wsClients.laptop.get(targetId);

	if (targetWs) {
		sendToWebSocket(targetWs, {
			type: "pair_request",
			sourceId: ws.id,
		});
	}
}

function handlePairAccept(ws, targetId) {
	console.log(`Pairing accepted between ${ws.id} and ${targetId}`);

	// Find the target WebSocket client
	const targetWs =
		wsClients.mobile.get(targetId) || wsClients.laptop.get(targetId);

	if (targetWs) {
		sendToWebSocket(targetWs, {
			type: "pair_confirmed",
			sourceId: ws.id,
		});

		sendToWebSocket(ws, {
			type: "pair_confirmed",
			sourceId: targetId,
		});
	}
}

function handleEyeTrackingData(ws, data) {
	if (data.targetId) {
		const targetWs = wsClients.laptop.get(data.targetId);

		if (targetWs) {
			sendToWebSocket(targetWs, {
				type: "eye_tracking_update",
				sourceId: ws.id,
				data: data.trackingData,
			});
		}
	}
}

function handleHeartRateData(ws, data) {
	if (data.targetId) {
		const targetWs = wsClients.laptop.get(data.targetId);

		if (targetWs) {
			sendToWebSocket(targetWs, {
				type: "heart_rate_update",
				sourceId: ws.id,
				data: data.heartRateData,
			});
		}
	}
}

function handleBiofeedback(ws, data) {
	if (data.targetId) {
		const targetWs = wsClients.mobile.get(data.targetId);

		if (targetWs) {
			sendToWebSocket(targetWs, {
				type: "biofeedback_update",
				sourceId: ws.id,
				feedback: data.feedback,
			});
		}
	}
}

function handleDisconnect(ws) {
	console.log("WebSocket client disconnected:", ws.id);

	// Check if it was a mobile device
	if (wsClients.mobile.has(ws.id)) {
		wsClients.mobile.delete(ws.id);

		// Notify laptops about disconnection
		wsClients.laptop.forEach((laptopWs) => {
			sendToWebSocket(laptopWs, {
				type: "mobile_disconnected",
				mobileId: ws.id,
			});
		});
	}
	// Check if it was a laptop
	else if (wsClients.laptop.has(ws.id)) {
		wsClients.laptop.delete(ws.id);

		// Notify mobiles about disconnection
		wsClients.mobile.forEach((mobileWs) => {
			sendToWebSocket(mobileWs, {
				type: "laptop_disconnected",
				laptopId: ws.id,
			});
		});
	}
}

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Root route
app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Store connected clients
const clients = {
	mobile: new Set(),
	laptop: new Set(),
};

// Socket.io connection handling
io.on("connection", (socket) => {
	console.log("New client connected:", socket.id);

	// Handle client type identification
	socket.on("register", (deviceType) => {
		console.log(`Client ${socket.id} registered as ${deviceType}`);

		if (deviceType === "mobile") {
			clients.mobile.add(socket.id);

			// Let the mobile device know about available laptop connections
			socket.emit("available_laptops", Array.from(clients.laptop));

			// Inform laptops about the new mobile device
			io.to(Array.from(clients.laptop)).emit("mobile_connected", socket.id);
		} else if (deviceType === "laptop") {
			clients.laptop.add(socket.id);

			// Let the laptop know about available mobile connections
			socket.emit("available_mobiles", Array.from(clients.mobile));
		}
	});

	// Handle pairing between devices
	socket.on("pair_request", (targetId) => {
		console.log(`Pairing request from ${socket.id} to ${targetId}`);
		io.to(targetId).emit("pair_request", socket.id);
	});

	socket.on("pair_accept", (targetId) => {
		console.log(`Pairing accepted between ${socket.id} and ${targetId}`);
		io.to(targetId).emit("pair_confirmed", socket.id);
		socket.emit("pair_confirmed", targetId);
	});

	// Handle eye tracking data
	socket.on("eye_tracking_data", (data) => {
		// Forward eye tracking data to paired laptop
		if (data.targetId) {
			io.to(data.targetId).emit("eye_tracking_update", {
				sourceId: socket.id,
				data: data.trackingData,
			});
		}
	});

	// Handle heart rate data
	socket.on("heart_rate_data", (data) => {
		// Forward heart rate data to paired laptop
		if (data.targetId) {
			io.to(data.targetId).emit("heart_rate_update", {
				sourceId: socket.id,
				data: data.heartRateData,
			});
		}
	});

	// Handle feedback from laptop to phone
	socket.on("biofeedback", (data) => {
		if (data.targetId) {
			io.to(data.targetId).emit("biofeedback_update", {
				sourceId: socket.id,
				feedback: data.feedback,
			});
		}
	});

	// Handle disconnect
	socket.on("disconnect", () => {
		console.log("Client disconnected:", socket.id);

		// Check if it was a mobile device
		if (clients.mobile.has(socket.id)) {
			clients.mobile.delete(socket.id);
			// Notify laptops about disconnection
			io.to(Array.from(clients.laptop)).emit("mobile_disconnected", socket.id);
		}
		// Check if it was a laptop
		else if (clients.laptop.has(socket.id)) {
			clients.laptop.delete(socket.id);
			// Notify mobiles about disconnection
			io.to(Array.from(clients.mobile)).emit("laptop_disconnected", socket.id);
		}
	});
});

// Start the server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "localhost";

// Check if we're running in a serverless environment like Vercel
const isServerlessEnvironment = !!process.env.VERCEL;

if (isServerlessEnvironment) {
	// In serverless environments, don't explicitly listen as Vercel handles this
	console.log("Running in serverless environment");
	// Export the Express app for Vercel
	module.exports = app;
} else {
	// For local development, listen on the specified port and host
	server.listen(PORT, HOST, () => {
		console.log(`Server running on http://${HOST}:${PORT}`);
	});
}
