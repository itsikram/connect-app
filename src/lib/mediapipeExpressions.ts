// MediaPipe Face Mesh based expression detection utilities for React Native
// Mirrors logic from web/src/utils/mediapipeExpressions.js and the HTML demo

export type Landmark = { x: number; y: number; z: number };

export function distance(p1: Landmark, p2: Landmark): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = p1.z - p2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function calculateFaceClarity(landmarks: Landmark[]) {
  const leftEyeOuter = landmarks[33];
  const rightEyeOuter = landmarks[263];
  const faceWidth = distance(leftEyeOuter, rightEyeOuter);

  let sizeScore = 0;
  if (faceWidth >= 0.18 && faceWidth <= 0.38) {
    sizeScore = 100 - Math.abs(faceWidth - 0.28) * 300;
  } else if (faceWidth < 0.18) {
    sizeScore = Math.max(0, (faceWidth / 0.18) * 60);
  } else {
    sizeScore = Math.max(0, 60 - (faceWidth - 0.38) * 300);
  }

  const nose = landmarks[1];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];
  const leftDepth = Math.abs(nose.z - leftCheek.z);
  const rightDepth = Math.abs(nose.z - rightCheek.z);
  const depthDifference = Math.abs(leftDepth - rightDepth);
  const angleScore = Math.max(0, 100 - depthDifference * 1000);

  const faceCenterX = (leftEyeOuter.x + rightEyeOuter.x) / 2;
  const horizontalCenter = Math.abs(faceCenterX - 0.5);
  const centerScore = Math.max(0, 100 - horizontalCenter * 300);

  const faceCenterY = nose.y;
  const verticalScore = (faceCenterY >= 0.3 && faceCenterY <= 0.6)
    ? 100
    : Math.max(0, 100 - Math.abs(faceCenterY - 0.45) * 300);

  const clarityScore = (sizeScore * 0.4 + angleScore * 0.3 + centerScore * 0.2 + verticalScore * 0.1);
  let clarityLevel: 'Poor' | 'Fair' | 'Good' | 'Excellent' = 'Poor';
  if (clarityScore >= 80) clarityLevel = 'Excellent';
  else if (clarityScore >= 65) clarityLevel = 'Good';
  else if (clarityScore >= 50) clarityLevel = 'Fair';

  return { score: Math.round(clarityScore), level: clarityLevel };
}

function ema(prev: number | undefined, next: number, alpha: number): number {
  return (prev === undefined || prev === null) ? next : (prev * (1 - alpha) + next * alpha);
}

export interface SmoothCtx {
  avgEAR?: number;
  mouthWidth?: number;
  mar?: number;
  mouthHeight?: number;
  mouthCurve?: number;
  innerBrowDistance?: number;
  browRatio?: number;
  lipDistance?: number;
}

export interface CalibCtx {
  isCalibrating: boolean;
  framesCollected: number;
  sums: { avgEAR: number; mouthWidth: number; mar: number; innerBrowDistance: number; browRatio: number; mouthCurve: number };
  baseline: null | { avgEAR: number; mouthWidth: number; mar: number; innerBrowDistance: number; browRatio: number; mouthCurve: number };
}

export interface AnalysisResult {
  customExpression: string;
  emotions: { happy: number; sad: number; surprise: number; angry: number };
  dominantEmotion: string;
  dominantEmotionScore: number;
  debug: any;
}

export function analyzeExpression(
  landmarks: Landmark[],
  clarityScore: number,
  canvasWidth: number,
  canvasHeight: number,
  smoothCtx: SmoothCtx,
  calibCtx: CalibCtx
): AnalysisResult {
  const SMOOTH_ALPHA = 0.35;

  const leftEyeOuter = landmarks[33];
  const rightEyeOuter = landmarks[263];
  const faceWidth = distance(leftEyeOuter, rightEyeOuter);
  const faceWidthPx = Math.hypot((leftEyeOuter.x - rightEyeOuter.x) * canvasWidth, (leftEyeOuter.y - rightEyeOuter.y) * canvasHeight);

  const leftEyeTop = landmarks[159];
  const leftEyeBottom = landmarks[145];
  const rightEyeTop = landmarks[386];
  const rightEyeBottom = landmarks[374];
  const leftEAR = distance(leftEyeTop, leftEyeBottom) / faceWidth;
  const rightEAR = distance(rightEyeTop, rightEyeBottom) / faceWidth;
  const avgEAR_raw = (leftEAR + rightEAR) / 2;

  const mouthTop = landmarks[13];
  const mouthBottom = landmarks[14];
  const mouthLeft = landmarks[61];
  const mouthRight = landmarks[291];
  const mouthHeight_raw = distance(mouthTop, mouthBottom) / faceWidth;
  const mouthWidth_raw = distance(mouthLeft, mouthRight) / faceWidth;
  const mar_raw = mouthHeight_raw / mouthWidth_raw;

  const leftCorner = landmarks[61];
  const rightCorner = landmarks[291];
  const mouthCenterY = landmarks[13].y;
  const cornerHeightAvg = (leftCorner.y + rightCorner.y) / 2;
  const mouthCurve_raw = mouthCenterY - cornerHeightAvg;

  const leftEyebrowInner = landmarks[285];
  const rightEyebrowInner = landmarks[55];
  const leftEyebrowCenter = landmarks[282];
  const rightEyebrowCenter = landmarks[52];
  const innerBrowDistance_raw = distance(leftEyebrowInner, rightEyebrowInner) / faceWidth;
  const innerBrowDistance_px = Math.hypot(
    (leftEyebrowInner.x - rightEyebrowInner.x) * canvasWidth,
    (leftEyebrowInner.y - rightEyebrowInner.y) * canvasHeight,
  );
  const leftBrowToEye = distance(leftEyebrowInner, leftEyeTop) / faceWidth;
  const rightBrowToEye = distance(rightEyebrowInner, rightEyeTop) / faceWidth;
  const avgBrowToEye = (leftBrowToEye + rightBrowToEye) / 2;
  const leftEyeWidth = distance(landmarks[33], landmarks[133]) / faceWidth;
  const rightEyeWidth = distance(landmarks[362], landmarks[263]) / faceWidth;
  const avgEyeWidth = (leftEyeWidth + rightEyeWidth) / 2;
  const browRatio_raw = avgBrowToEye / avgEyeWidth;

  const upperLip = landmarks[0];
  const lowerLip = landmarks[17];
  const lipDistance_raw = distance(upperLip, lowerLip) / faceWidth;

  // Smooth
  smoothCtx.avgEAR = ema(smoothCtx.avgEAR, avgEAR_raw, SMOOTH_ALPHA);
  smoothCtx.mouthWidth = ema(smoothCtx.mouthWidth, mouthWidth_raw, SMOOTH_ALPHA);
  smoothCtx.mar = ema(smoothCtx.mar, mar_raw, SMOOTH_ALPHA);
  smoothCtx.mouthHeight = ema(smoothCtx.mouthHeight, mouthHeight_raw, SMOOTH_ALPHA);
  smoothCtx.mouthCurve = ema(smoothCtx.mouthCurve, mouthCurve_raw, SMOOTH_ALPHA);
  smoothCtx.innerBrowDistance = ema(smoothCtx.innerBrowDistance, innerBrowDistance_raw, SMOOTH_ALPHA);
  smoothCtx.browRatio = ema(smoothCtx.browRatio, browRatio_raw, SMOOTH_ALPHA);
  smoothCtx.lipDistance = ema(smoothCtx.lipDistance, lipDistance_raw, SMOOTH_ALPHA);

  // Calibration
  if (calibCtx.isCalibrating && clarityScore >= 65) {
    calibCtx.framesCollected++;
    calibCtx.sums.avgEAR += smoothCtx.avgEAR || avgEAR_raw;
    calibCtx.sums.mouthWidth += smoothCtx.mouthWidth || mouthWidth_raw;
    calibCtx.sums.mar += smoothCtx.mar || mar_raw;
    calibCtx.sums.innerBrowDistance += smoothCtx.innerBrowDistance || innerBrowDistance_raw;
    calibCtx.sums.browRatio += smoothCtx.browRatio || browRatio_raw;
    calibCtx.sums.mouthCurve += smoothCtx.mouthCurve || mouthCurve_raw;
    if (calibCtx.framesCollected >= 45) {
      calibCtx.baseline = {
        avgEAR: calibCtx.sums.avgEAR / calibCtx.framesCollected,
        mouthWidth: calibCtx.sums.mouthWidth / calibCtx.framesCollected,
        mar: calibCtx.sums.mar / calibCtx.framesCollected,
        innerBrowDistance: calibCtx.sums.innerBrowDistance / calibCtx.framesCollected,
        browRatio: calibCtx.sums.browRatio / calibCtx.framesCollected,
        mouthCurve: calibCtx.sums.mouthCurve / calibCtx.framesCollected,
      };
      calibCtx.isCalibrating = false;
    }
  }

  const mouthOpenArea = (smoothCtx.mar || mar_raw) * (smoothCtx.mouthWidth || mouthWidth_raw);
  const teethVisible = ((smoothCtx.mar || mar_raw) > 0.22 && (smoothCtx.mouthHeight || mouthHeight_raw) > 0.03) || mouthOpenArea > 0.035;

  const metrics = {
    faceWidth: faceWidth.toFixed(4),
    mouthWidth: (smoothCtx.mouthWidth || mouthWidth_raw).toFixed(4),
    mouthHeight: (smoothCtx.mouthHeight || mouthHeight_raw).toFixed(4),
    mar: (smoothCtx.mar || mar_raw).toFixed(4),
    avgEAR: (smoothCtx.avgEAR || avgEAR_raw).toFixed(4),
    innerBrowDistance: (smoothCtx.innerBrowDistance || innerBrowDistance_raw).toFixed(4),
    browRatio: (smoothCtx.browRatio || browRatio_raw).toFixed(4),
    avgBrowToEye: avgBrowToEye.toFixed(4),
    mouthCurve: (smoothCtx.mouthCurve || mouthCurve_raw).toFixed(4),
    lipDistance: (smoothCtx.lipDistance || lipDistance_raw).toFixed(4),
    mouthOpenArea: mouthOpenArea.toFixed(4),
    browDistancePx: innerBrowDistance_px.toFixed(1),
    teethVisible: teethVisible,
    leftEAR: leftEAR.toFixed(4),
    rightEAR: rightEAR.toFixed(4),
    leftEyeWidth: leftEyeWidth.toFixed(4),
    rightEyeWidth: rightEyeWidth.toFixed(4),
    avgEyeWidth: avgEyeWidth.toFixed(4),
    leftBrowToEye: leftBrowToEye.toFixed(4),
    rightBrowToEye: rightBrowToEye.toFixed(4),
    leftEyeOpen: leftEAR > 0.05,
    rightEyeOpen: rightEAR > 0.05,
  } as any;

  // Numeric values for expression rules
  const mouthWidthVal = parseFloat(metrics.mouthWidth);
  const mouthOpenAreaVal = parseFloat(metrics.mouthOpenArea);
  const avgEARVal = parseFloat(metrics.avgEAR);
  const innerBrowDistanceVal = parseFloat(metrics.innerBrowDistance);
  const mouthCurveVal = parseFloat(metrics.mouthCurve);
  const leftBrowToEyeVal = parseFloat(metrics.leftBrowToEye);
  const rightBrowToEyeVal = parseFloat(metrics.rightBrowToEye);
  const mouthHeightVal = parseFloat(metrics.mouthHeight);
  const browDistanceRatioVal = innerBrowDistance_px / faceWidthPx;

  const customExpression = ((): string => {
    if (mouthWidthVal > 0.57 && !metrics.teethVisible) return 'Smiling';
    if (mouthWidthVal > 0.60 && metrics.teethVisible && mouthOpenAreaVal > 0.18) return 'Laughing';
    if (metrics.teethVisible && mouthCurveVal > -0.25 && mouthOpenAreaVal < 0.20) return 'Speaking';
    if (leftEAR < 0.05 && rightEAR > 0.05 && mouthOpenAreaVal < 0.30) return 'Winking';
    if (leftEAR > 0.05 && rightEAR < 0.05 && mouthOpenAreaVal < 0.30) return 'Winking';
    if (mouthOpenAreaVal > 0.40 && avgEARVal < 0.11) return 'Yawning';
    if (browDistanceRatioVal > 0.310 && innerBrowDistanceVal > 0.305) return 'Surprised';
    if (browDistanceRatioVal < 0.305 && innerBrowDistanceVal < 0.290 && mouthOpenAreaVal < 0.30) return 'Angry';
    if (avgEARVal < 0.095 && mouthCurveVal > -0.150 && mouthOpenAreaVal < 0.25 && metrics.leftEyeOpen && metrics.rightEyeOpen) return 'Sleepy';
    if (leftBrowToEyeVal > 0.595 || rightBrowToEyeVal > 0.595) return 'Eyebrow Raise';
    if (mouthHeightVal < 0.045 && mouthWidthVal < 0.43 && mouthCurveVal > 0.0) return 'Kissing';
    return 'Neutral';
  })();

  function computeEmotionScores(exprLabel: string) {
    const scores = { happy: 0, sad: 0, surprise: 0, angry: 0 };
    switch (exprLabel) {
      case 'Smiling': scores.happy = 1.0; break;
      case 'Laughing': scores.happy = 1.0; scores.surprise = 0.2; break;
      case 'Winking': scores.happy = 0.4; break;
      case 'Yawning': scores.surprise = 0.8; break;
      case 'Eyebrow Raise': scores.surprise = 0.8; break;
      case 'Sleepy': scores.sad = 0.5; break;
      case 'Speaking': scores.happy = 0.2; scores.surprise = 0.2; break;
      default: scores.happy = 0.25; scores.sad = 0.25; scores.surprise = 0.25; scores.angry = 0.25; break;
    }
    return scores;
  }

  const emotions = computeEmotionScores(customExpression);
  let dominantEmotion = 'Neutral';
  let dominantScore = -1;
  (['happy', 'sad', 'surprise', 'angry'] as const).forEach(k => {
    const v = (emotions as any)[k] as number;
    if (v > dominantScore) { dominantScore = v; dominantEmotion = k.charAt(0).toUpperCase() + k.slice(1); }
  });

  return {
    customExpression,
    emotions,
    dominantEmotion,
    dominantEmotionScore: dominantScore,
    debug: metrics,
  };
}

export function createEmotionDetector() {
  const smoothCtx: SmoothCtx = {};
  const calibCtx: CalibCtx = {
    isCalibrating: true,
    framesCollected: 0,
    sums: { avgEAR: 0, mouthWidth: 0, mar: 0, innerBrowDistance: 0, browRatio: 0, mouthCurve: 0 },
    baseline: null,
  };
  let lastStable: AnalysisResult | null = null;

  return {
    process(landmarks: Landmark[], imageWidth: number, imageHeight: number) {
      const clarity = calculateFaceClarity(landmarks);
      let result = analyzeExpression(landmarks, clarity.score, imageWidth, imageHeight, smoothCtx, calibCtx);
      if (clarity.score < 60 && lastStable) {
        result = lastStable;
      } else if (clarity.score >= 60) {
        lastStable = result;
      }
      return { analysis: result, clarityScore: clarity.score };
    }
  };
}


