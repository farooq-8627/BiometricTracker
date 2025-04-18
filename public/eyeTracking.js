// Eye tracking detection and processing

// Global variables for eye tracking
let blinkCount = 0;
let lastBlinkTime = 0;
let lastEyePositions = [];
let blinkThreshold = 0.2; // Threshold for detecting eye closure
const MAX_EYE_POSITIONS = 10; // Number of eye positions to keep for velocity calculations

// Process video frame for eye tracking
async function processEyeTracking(videoElement, canvas, context) {
  if (!videoElement || !canvas || !context) {
    console.error('Missing required elements for eye tracking');
    return null;
  }
  
  try {
    // Detect faces in the video frame
    const detections = await faceapi.detectAllFaces(
      videoElement, 
      new faceapi.TinyFaceDetectorOptions()
    ).withFaceLandmarks();
    
    // Clear the canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // No faces detected
    if (detections.length === 0) {
      return {
        blinkRate: 0,
        saccadeVelocity: 0,
        gazeDuration: 0,
        pupilDilation: 0
      };
    }
    
    // Get the first detected face
    const face = detections[0];
    const landmarks = face.landmarks;
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    
    // Draw face landmarks
    drawFaceLandmarks(context, face);
    
    // Process eye data
    const eyeData = processEyeData(leftEye, rightEye);
    
    return eyeData;
  } catch (error) {
    console.error('Error in eye tracking:', error);
    return null;
  }
}

// Draw face landmarks on the canvas
function drawFaceLandmarks(context, face) {
  // Draw face outline
  context.strokeStyle = '#4a6fa5';
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
  context.strokeStyle = '#4fc3f7';
  context.lineWidth = 1;
  context.strokeRect(x, y, width, height);
}

// Process eye data from the landmarks
function processEyeData(leftEye, rightEye) {
  // Calculate eye aspect ratio (EAR) to detect blinks
  const leftEAR = calculateEyeAspectRatio(leftEye);
  const rightEAR = calculateEyeAspectRatio(rightEye);
  const avgEAR = (leftEAR + rightEAR) / 2;
  
  // Detect blinks based on EAR threshold
  const now = Date.now();
  if (avgEAR < blinkThreshold) {
    // A blink is detected if the last blink was more than 300ms ago
    if (now - lastBlinkTime > 300) {
      blinkCount++;
      lastBlinkTime = now;
    }
  }
  
  // Calculate blink rate (blinks per minute)
  // Use a 30-second window for calculation
  const timeWindowMs = 30000;
  const blinkRate = (blinkCount / timeWindowMs) * 60000;
  
  // Reset blink count after the time window
  if (now - lastBlinkTime > timeWindowMs) {
    blinkCount = 0;
    lastBlinkTime = now;
  }
  
  // Calculate eye positions (average of left and right eye centers)
  const leftEyeCenter = calculateEyeCenter(leftEye);
  const rightEyeCenter = calculateEyeCenter(rightEye);
  const currentEyePosition = {
    x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
    y: (leftEyeCenter.y + rightEyeCenter.y) / 2,
    timestamp: now
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
    saccadeVelocity,
    gazeDuration,
    pupilDilation: avgPupilSize
  };
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
  
  eye.forEach(point => {
    sumX += point.x;
    sumY += point.y;
  });
  
  return {
    x: sumX / eye.length,
    y: sumY / eye.length
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
