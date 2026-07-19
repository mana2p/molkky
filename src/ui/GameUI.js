import { PLAYER_COLORS, PLAYER_NAMES_DEFAULT } from '../constants.js';

/**
 * 全UI画面の管理
 * - メインメニュー
 * - プレイヤー設定
 * - 遊び方
 * - インゲームHUD＆スコアボード
 * - メッセージ表示
 * - リザルト画面
 */
export class GameUI {
  constructor() {
    // DOM参照
    this.mainMenu = document.getElementById('main-menu');
    this.playerSetup = document.getElementById('player-setup');
    this.howToPlay = document.getElementById('how-to-play');
    this.hud = document.getElementById('hud');
    this.throwGuide = document.getElementById('throw-guide');
    this.powerGauge = document.getElementById('power-gauge');
    this.powerFill = document.getElementById('power-fill');
    this.messageDisplay = document.getElementById('message-display');
    this.resultScreen = document.getElementById('result-screen');
    this.resultContent = document.getElementById('result-content');

    // HUDサブ要素
    this.currentPlayerEl = document.getElementById('current-player');
    this.scoreboardEl = document.getElementById('scoreboard');
    this.turnInfoEl = document.getElementById('turn-info');

    // コールバック
    this.onStartGame = null;  // (playerConfigs) => void
    this.onReplay = null;
    this.onBackToMenu = null;

    this._playerCount = 1;
    this._messageTimeout = null;

    this._setupEventListeners();
  }

  _setupEventListeners() {
    // メインメニュー
    document.getElementById('btn-play').addEventListener('click', () => {
      this.showPlayerSetup();
    });
    document.getElementById('btn-how').addEventListener('click', () => {
      this.showHowToPlay();
    });
    document.getElementById('btn-close-how').addEventListener('click', () => {
      this.hideHowToPlay();
    });

    // プレイヤー人数選択
    document.getElementById('count-buttons').addEventListener('click', (e) => {
      const btn = e.target.closest('.count-btn');
      if (!btn) return;
      this._playerCount = parseInt(btn.dataset.count);
      document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this._renderPlayerInputs();
    });

    // ゲーム開始
    document.getElementById('btn-start-game').addEventListener('click', () => {
      const configs = this._getPlayerConfigs();
      this.hidePlayerSetup();
      this.showHUD();
      if (this.onStartGame) this.onStartGame(configs);
    });

    // リザルト画面
    document.getElementById('btn-replay').addEventListener('click', () => {
      if (this.onReplay) this.onReplay();
    });
    document.getElementById('btn-back-menu').addEventListener('click', () => {
      if (this.onBackToMenu) this.onBackToMenu();
    });
  }

  // ===== メインメニュー =====
  showMainMenu() {
    this.mainMenu.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.throwGuide.classList.add('hidden');
    this.powerGauge.classList.add('hidden');
    this.messageDisplay.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.playerSetup.classList.add('hidden');
  }

  hideMainMenu() {
    this.mainMenu.classList.add('hidden');
  }

  // ===== プレイヤー設定 =====
  showPlayerSetup() {
    this.hideMainMenu();
    this.playerSetup.classList.remove('hidden');
    this._renderPlayerInputs();
  }

  hidePlayerSetup() {
    this.playerSetup.classList.add('hidden');
  }

  _renderPlayerInputs() {
    const container = document.getElementById('player-inputs');
    container.innerHTML = '';
    for (let i = 0; i < this._playerCount; i++) {
      const row = document.createElement('div');
      row.className = 'player-input-row';
      row.innerHTML = `
        <div class="player-color-dot" style="background: ${PLAYER_COLORS[i]}"></div>
        <input type="text" class="player-name-input" 
               placeholder="${PLAYER_NAMES_DEFAULT[i]}" 
               maxlength="12"
               data-index="${i}">
        <button class="btn-cpu-toggle" data-cpu="false" data-index="${i}">👤 Human</button>
      `;
      container.appendChild(row);
    }

    // CPU切り替えボタンのイベントリスナー
    const cpuBtns = container.querySelectorAll('.btn-cpu-toggle');
    cpuBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const isCpu = btn.dataset.cpu === 'true';
        if (isCpu) {
          btn.dataset.cpu = 'false';
          btn.textContent = '👤 Human';
          btn.classList.remove('is-cpu');
        } else {
          btn.dataset.cpu = 'true';
          btn.textContent = '🤖 CPU';
          btn.classList.add('is-cpu');
        }
      });
    });
  }

  _getPlayerConfigs() {
    const inputs = document.querySelectorAll('.player-name-input');
    const cpuBtns = document.querySelectorAll('.btn-cpu-toggle');
    const configs = [];
    inputs.forEach((input, i) => {
      const isCpu = cpuBtns[i].dataset.cpu === 'true';
      let name = input.value.trim();
      if (!name) {
        name = isCpu ? `CPU ${i+1}` : PLAYER_NAMES_DEFAULT[i];
      }
      configs.push({
        name: name,
        color: PLAYER_COLORS[i],
        isCpu: isCpu,
      });
    });
    return configs;
  }

  // ===== 遊び方 =====
  showHowToPlay() {
    this.howToPlay.classList.remove('hidden');
  }

  hideHowToPlay() {
    this.howToPlay.classList.add('hidden');
  }

  // ===== HUD =====
  showHUD() {
    this.hud.classList.remove('hidden');
  }

  updateCurrentPlayer(player, turn) {
    this.currentPlayerEl.innerHTML = `
      <span style="color:${player.color}">●</span> ${player.name} のターン
    `;
    this.turnInfoEl.textContent = `Turn ${turn}`;
  }

  updateScoreboard(players, currentIndex) {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    let html = '<div class="scoreboard-title">Scoreboard</div>';
    for (const p of sorted) {
      const isActive = p.index === currentIndex;
      const cls = [
        'scoreboard-row',
        isActive ? 'active' : '',
        p.eliminated ? 'eliminated' : '',
      ].filter(Boolean).join(' ');

      html += `
        <div class="${cls}">
          <div class="sb-color" style="background:${p.color}"></div>
          <div class="sb-name">${p.name}</div>
          <div class="sb-score">${p.score}</div>
          ${p.consecutiveMisses > 0 ? `<div class="sb-misses">${'✕'.repeat(p.consecutiveMisses)}</div>` : '<div class="sb-misses"></div>'}
        </div>
      `;
    }
    this.scoreboardEl.innerHTML = html;
  }

  // ===== 投げガイド =====
  showThrowGuide(visible) {
    this.throwGuide.classList.toggle('hidden', !visible);
  }

  // ===== パワーゲージ =====
  updatePowerGauge(power) {
    if (power > 0) {
      this.powerGauge.classList.remove('hidden');
      this.powerFill.style.width = `${power * 100}%`;
    } else {
      this.powerGauge.classList.add('hidden');
    }
  }

  hidePowerGauge() {
    this.powerGauge.classList.add('hidden');
  }

  // ===== メッセージ表示 =====
  showMessage(text, duration = 3000) {
    this.messageDisplay.textContent = text;
    this.messageDisplay.classList.remove('hidden');

    if (this._messageTimeout) clearTimeout(this._messageTimeout);

    if (duration > 0) {
      this._messageTimeout = setTimeout(() => {
        this.messageDisplay.classList.add('hidden');
      }, duration);
    }
  }

  hideMessage() {
    this.messageDisplay.classList.add('hidden');
    if (this._messageTimeout) clearTimeout(this._messageTimeout);
  }

  // ===== リザルト画面 =====
  showResult(players, winner) {
    this.hud.classList.add('hidden');
    this.throwGuide.classList.add('hidden');
    this.powerGauge.classList.add('hidden');

    const sorted = [...players].sort((a, b) => b.score - a.score);
    const medals = ['🥇', '🥈', '🥉', '4️⃣'];

    let html = '';
    if (winner) {
      html += `<div class="result-winner">🎉</div>`;
      html += `<div class="result-winner-name" style="color:${winner.color}">${winner.name} の勝利！</div>`;
    } else {
      html += `<div class="result-winner">💀</div>`;
      html += `<div class="result-winner-name">ゲーム終了</div>`;
    }

    html += '<div class="result-scores">';
    sorted.forEach((p, i) => {
      html += `
        <div class="result-score-row">
          <div class="result-rank">${medals[i] || ''}</div>
          <div class="sb-color" style="background:${p.color}"></div>
          <div class="result-name">${p.name}</div>
          <div class="result-score-val">${p.score}点</div>
        </div>
      `;
    });
    html += '</div>';

    this.resultContent.innerHTML = html;
    this.resultScreen.classList.remove('hidden');
  }

  hideResult() {
    this.resultScreen.classList.add('hidden');
  }
}
