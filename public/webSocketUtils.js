// WebSocket utilities for both mobile and laptop interfaces

/**
 * Initialize a WebSocket connection
 * @returns {WebSocket} The WebSocket connection
 */
function initializeWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  console.log(`Connecting to WebSocket at ${wsUrl}`);
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('WebSocket connection established');
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log('WebSocket connection closed');
  };
  
  return ws;
}

/**
 * Send a message through the WebSocket connection
 * @param {WebSocket} ws - The WebSocket connection
 * @param {Object} data - The data to send
 * @returns {boolean} Whether the message was sent successfully
 */
function sendWebSocketMessage(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    return true;
  }
  console.warn('WebSocket not connected');
  return false;
}

/**
 * Register as a specific device type
 * @param {WebSocket} ws - The WebSocket connection
 * @param {string} deviceType - The device type ('mobile' or 'laptop')
 */
function registerDevice(ws, deviceType) {
  sendWebSocketMessage(ws, {
    type: 'register',
    deviceType: deviceType
  });
}

/**
 * Send a pairing request
 * @param {WebSocket} ws - The WebSocket connection
 * @param {string} targetId - The ID of the target device
 */
function sendPairRequest(ws, targetId) {
  sendWebSocketMessage(ws, {
    type: 'pair_request',
    targetId: targetId
  });
}

/**
 * Accept a pairing request
 * @param {WebSocket} ws - The WebSocket connection
 * @param {string} targetId - The ID of the target device
 */
function acceptPairRequest(ws, targetId) {
  sendWebSocketMessage(ws, {
    type: 'pair_accept',
    targetId: targetId
  });
}

/**
 * Send eye tracking data
 * @param {WebSocket} ws - The WebSocket connection
 * @param {string} targetId - The ID of the target device
 * @param {Object} trackingData - The eye tracking data
 */
function sendEyeTrackingData(ws, targetId, trackingData) {
  sendWebSocketMessage(ws, {
    type: 'eye_tracking_data',
    targetId: targetId,
    trackingData: trackingData
  });
}

/**
 * Send heart rate data
 * @param {WebSocket} ws - The WebSocket connection
 * @param {string} targetId - The ID of the target device
 * @param {Object} heartRateData - The heart rate data
 */
function sendHeartRateData(ws, targetId, heartRateData) {
  sendWebSocketMessage(ws, {
    type: 'heart_rate_data',
    targetId: targetId,
    heartRateData: heartRateData
  });
}

/**
 * Send biofeedback data
 * @param {WebSocket} ws - The WebSocket connection
 * @param {string} targetId - The ID of the target device
 * @param {Object} feedback - The feedback data
 */
function sendBiofeedbackData(ws, targetId, feedback) {
  sendWebSocketMessage(ws, {
    type: 'biofeedback',
    targetId: targetId,
    feedback: feedback
  });
}

/**
 * Set up WebSocket handlers for the mobile device
 * @param {WebSocket} ws - The WebSocket connection
 * @param {Object} handlers - Object containing handler functions for different message types
 */
function setupMobileWebSocketHandlers(ws, handlers) {
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'available_laptops':
          if (handlers.onAvailableLaptops) {
            handlers.onAvailableLaptops(data.laptops);
          }
          break;
        case 'pair_request':
          if (handlers.onPairRequest) {
            handlers.onPairRequest(data.sourceId);
          }
          break;
        case 'pair_confirmed':
          if (handlers.onPairConfirmed) {
            handlers.onPairConfirmed(data.sourceId);
          }
          break;
        case 'laptop_disconnected':
          if (handlers.onLaptopDisconnected) {
            handlers.onLaptopDisconnected(data.laptopId);
          }
          break;
        case 'biofeedback_update':
          if (handlers.onBiofeedbackUpdate) {
            handlers.onBiofeedbackUpdate(data.sourceId, data.feedback);
          }
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
}

/**
 * Set up WebSocket handlers for the laptop device
 * @param {WebSocket} ws - The WebSocket connection
 * @param {Object} handlers - Object containing handler functions for different message types
 */
function setupLaptopWebSocketHandlers(ws, handlers) {
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'available_mobiles':
          if (handlers.onAvailableMobiles) {
            handlers.onAvailableMobiles(data.mobiles);
          }
          break;
        case 'mobile_connected':
          if (handlers.onMobileConnected) {
            handlers.onMobileConnected(data.mobileId);
          }
          break;
        case 'mobile_disconnected':
          if (handlers.onMobileDisconnected) {
            handlers.onMobileDisconnected(data.mobileId);
          }
          break;
        case 'pair_request':
          if (handlers.onPairRequest) {
            handlers.onPairRequest(data.sourceId);
          }
          break;
        case 'pair_confirmed':
          if (handlers.onPairConfirmed) {
            handlers.onPairConfirmed(data.sourceId);
          }
          break;
        case 'eye_tracking_update':
          if (handlers.onEyeTrackingUpdate) {
            handlers.onEyeTrackingUpdate(data.sourceId, data.data);
          }
          break;
        case 'heart_rate_update':
          if (handlers.onHeartRateUpdate) {
            handlers.onHeartRateUpdate(data.sourceId, data.data);
          }
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
}