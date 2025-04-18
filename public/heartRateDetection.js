// Heart rate detection through video processing

// Global variables for heart rate detection
let lastProcessedTime = 0;
const processingInterval = 1000; // Process every 1 second
const signalWindow = 15; // 15-second window for heart rate calculation
let rgbSignals = {
  r: [],
  g: [],
  b: []
};
let timestamps = [];
let lastHeartRates = [];

// Process video frame for heart rate detection
async function detectHeartRate(videoElement) {
  if (!videoElement) return null;
  
  const now = Date.now();
  
  // Only process every interval ms to avoid performance issues
  if (now - lastProcessedTime < processingInterval) {
    return lastHeartRates.length > 0 ? { bpm: lastHeartRates[lastHeartRates.length - 1] } : null;
  }
  
  lastProcessedTime = now;
  
  try {
    // Create a temporary canvas to extract pixel data
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const width = videoElement.videoWidth;
    const height = videoElement.videoHeight;
    
    canvas.width = width;
    canvas.height = height;
    
    // Draw the current video frame on the canvas
    context.drawImage(videoElement, 0, 0, width, height);
    
    // Face detection to locate the region of interest (ROI)
    const detections = await faceapi.detectAllFaces(
      videoElement, 
      new faceapi.TinyFaceDetectorOptions()
    ).withFaceLandmarks();
    
    if (detections.length === 0) {
      console.log('No face detected for heart rate analysis');
      return null;
    }
    
    const face = detections[0];
    const { x, y, width: faceWidth, height: faceHeight } = face.detection.box;
    
    // Define ROI (forehead region)
    const roi = {
      x: x + faceWidth * 0.2,
      y: y + faceHeight * 0.1,
      width: faceWidth * 0.6,
      height: faceHeight * 0.15
    };
    
    // Extract pixel data from ROI
    const imageData = context.getImageData(roi.x, roi.y, roi.width, roi.height);
    const pixels = imageData.data;
    
    // Calculate average RGB values in the ROI
    let totalR = 0, totalG = 0, totalB = 0;
    let pixelCount = 0;
    
    for (let i = 0; i < pixels.length; i += 4) {
      totalR += pixels[i];     // Red
      totalG += pixels[i + 1]; // Green
      totalB += pixels[i + 2]; // Blue
      pixelCount++;
    }
    
    const avgR = totalR / pixelCount;
    const avgG = totalG / pixelCount;
    const avgB = totalB / pixelCount;
    
    // Store the signal values
    rgbSignals.r.push(avgR);
    rgbSignals.g.push(avgG);
    rgbSignals.b.push(avgB);
    timestamps.push(now);
    
    // Keep only the data within the time window
    const windowStart = now - (signalWindow * 1000);
    let startIndex = timestamps.findIndex(time => time >= windowStart);
    if (startIndex === -1) startIndex = 0;
    
    if (startIndex > 0) {
      rgbSignals.r = rgbSignals.r.slice(startIndex);
      rgbSignals.g = rgbSignals.g.slice(startIndex);
      rgbSignals.b = rgbSignals.b.slice(startIndex);
      timestamps = timestamps.slice(startIndex);
    }
    
    // If we have enough data points, calculate heart rate
    if (rgbSignals.g.length >= 4) { // Need at least 4 data points for analysis
      const heartRate = calculateHeartRate(rgbSignals.g, timestamps);
      
      if (heartRate) {
        lastHeartRates.push(heartRate);
        
        // Keep only the last 5 heart rate values
        if (lastHeartRates.length > 5) {
          lastHeartRates.shift();
        }
        
        // Return the average of the last heart rates to smooth results
        const avgHeartRate = lastHeartRates.reduce((sum, rate) => sum + rate, 0) / lastHeartRates.length;
        
        return {
          bpm: avgHeartRate,
          confidence: calculateConfidence(lastHeartRates)
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error in heart rate detection:', error);
    return null;
  }
}

// Calculate heart rate from the green channel signal
function calculateHeartRate(signal, times) {
  if (signal.length < 4 || times.length < 4) return null;
  
  try {
    // Normalize the signal by subtracting the mean
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const normalizedSignal = signal.map(val => val - mean);
    
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
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length / 1000;
    
    // Calculate heart rate in beats per minute
    const heartRate = 60 / avgInterval;
    
    // Filter out unreasonable heart rates
    if (heartRate < 40 || heartRate > 200) {
      return null;
    }
    
    return heartRate;
  } catch (error) {
    console.error('Error calculating heart rate:', error);
    return null;
  }
}

// Smooth the signal using a moving average filter
function smoothSignal(signal, windowSize) {
  const result = [];
  
  for (let i = 0; i < signal.length; i++) {
    let sum = 0;
    let count = 0;
    
    for (let j = Math.max(0, i - windowSize); j <= Math.min(signal.length - 1, i + windowSize); j++) {
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
  const mean = heartRates.reduce((sum, rate) => sum + rate, 0) / heartRates.length;
  const squaredDiffs = heartRates.map(rate => Math.pow(rate - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / heartRates.length;
  const stdDev = Math.sqrt(variance);
  
  // Calculate coefficient of variation (CV)
  const cv = stdDev / mean;
  
  // Map CV to confidence level (lower CV means higher confidence)
  let confidence = Math.max(0, 1 - cv * 4);
  confidence = Math.min(1, confidence); // Clamp to [0, 1]
  
  return confidence;
}
