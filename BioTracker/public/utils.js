// Utility functions for the application

/**
 * Throttle function to limit how often a function can be called
 * @param {Function} func - The function to throttle
 * @param {number} limit - The time limit in milliseconds
 * @returns {Function} - Throttled function
 */
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Debounce function to delay function execution until after a period of inactivity
 * @param {Function} func - The function to debounce
 * @param {number} wait - The time to wait in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

/**
 * Format a timestamp into a human-readable string
 * @param {number} timestamp - The timestamp in milliseconds
 * @param {boolean} includeSeconds - Whether to include seconds
 * @returns {string} - Formatted time string
 */
function formatTime(timestamp, includeSeconds = true) {
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // Convert 0 to 12
  
  return includeSeconds
    ? `${hours}:${minutes}:${seconds} ${ampm}`
    : `${hours}:${minutes} ${ampm}`;
}

/**
 * Generate a random ID
 * @param {number} length - The length of the ID
 * @returns {string} - Random ID
 */
function generateRandomId(length = 8) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Check if device has camera support
 * @returns {Promise<boolean>} - Whether the device has camera support
 */
async function hasCameraSupport() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some(device => device.kind === 'videoinput');
  } catch (error) {
    console.error('Error checking camera support:', error);
    return false;
  }
}

/**
 * Check if the device is a mobile device
 * @returns {boolean} - Whether the device is a mobile device
 */
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Log an event with timestamp
 * @param {string} type - Event type
 * @param {string} message - Event message
 * @param {Object} data - Additional data
 */
function logEvent(type, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}][${type}] ${message}`, data);
}

/**
 * Calculate the average of an array of numbers
 * @param {Array<number>} values - The values to average
 * @returns {number} - The average value
 */
function calculateAverage(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate the min, max, average and standard deviation of an array of numbers
 * @param {Array<number>} values - The values to analyze
 * @returns {Object} - Statistics object
 */
function calculateStatistics(values) {
  if (!values || values.length === 0) {
    return { min: 0, max: 0, avg: 0, stdDev: 0 };
  }
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = calculateAverage(values);
  
  const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
  const variance = calculateAverage(squaredDiffs);
  const stdDev = Math.sqrt(variance);
  
  return { min, max, avg, stdDev };
}

/**
 * Map a value from one range to another
 * @param {number} value - The value to map
 * @param {number} inMin - Input range minimum
 * @param {number} inMax - Input range maximum
 * @param {number} outMin - Output range minimum
 * @param {number} outMax - Output range maximum
 * @returns {number} - Mapped value
 */
function mapRange(value, inMin, inMax, outMin, outMax) {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Clamp a value between a minimum and maximum
 * @param {number} value - The value to clamp
 * @param {number} min - The minimum value
 * @param {number} max - The maximum value
 * @returns {number} - Clamped value
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
