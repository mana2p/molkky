import { TOPPLE_THRESHOLD, WIN_SCORE, OVER_SCORE_RESET, MAX_CONSECUTIVE_MISSES } from '../constants.js';

export function isSkittleToppled(body) {
  const rotation = body.rotation();
  const qx = rotation.x;
  const qy = rotation.y;
  const qz = rotation.z;
  const qw = rotation.w;

  // クォータニオンから上方向ベクトルのY成分を計算
  const upY = 1 - 2 * (qx * qx + qz * qz);
  return upY < TOPPLE_THRESHOLD;
}

export function calculateScore(toppledNumbers) {
  if (toppledNumbers.length === 0) return 0;
  if (toppledNumbers.length === 1) return toppledNumbers[0];
  return toppledNumbers.length;
}

export function applyScore(currentScore, turnScore) {
  const total = currentScore + turnScore;
  if (total > WIN_SCORE) {
    return { newScore: OVER_SCORE_RESET, overshot: true };
  }
  return { newScore: total, overshot: false };
}

export function isWin(score) {
  return score === WIN_SCORE;
}

export function isEliminated(consecutiveMisses) {
  return consecutiveMisses >= MAX_CONSECUTIVE_MISSES;
}
