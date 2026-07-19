const scoreEl = document.getElementById('score-display');
const turnEl = document.getElementById('turn-display');
const missEl = document.getElementById('miss-display');
const messageEl = document.getElementById('message-display');
const throwGuideEl = document.getElementById('throw-guide');

let messageTimeout = null;

export function updateScore(score) {
  scoreEl.textContent = `スコア: ${score} / 50`;
}

export function updateTurn(turn) {
  turnEl.textContent = `ターン: ${turn}`;
}

export function updateMisses(misses) {
  if (misses > 0) {
    missEl.textContent = `⚠️ 連続ミス: ${misses} / 3`;
    missEl.style.display = 'block';
    missEl.style.color = misses >= 2 ? '#ff6b6b' : '#ffd93d';
  } else {
    missEl.style.display = 'none';
  }
}

export function showMessage(text, duration = 3000) {
  messageEl.textContent = text;
  messageEl.style.display = 'block';

  if (messageTimeout) clearTimeout(messageTimeout);

  if (duration > 0) {
    messageTimeout = setTimeout(() => {
      messageEl.style.display = 'none';
    }, duration);
  }
}

export function hideMessage() {
  messageEl.style.display = 'none';
  if (messageTimeout) clearTimeout(messageTimeout);
}

export function showThrowGuide(visible) {
  throwGuideEl.style.opacity = visible ? '1' : '0';
}
