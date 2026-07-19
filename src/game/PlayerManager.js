import { PLAYER_COLORS, PLAYER_NAMES_DEFAULT, MAX_CONSECUTIVE_MISSES } from '../constants.js';

export class Player {
  constructor(name, color, index, isCpu = false) {
    this.name = name;
    this.color = color;
    this.index = index;
    this.isCpu = isCpu;
    this.score = 0;
    this.consecutiveMisses = 0;
    this.eliminated = false;
    this.scoreHistory = [];
  }

  reset() {
    this.score = 0;
    this.consecutiveMisses = 0;
    this.eliminated = false;
    this.scoreHistory = [];
  }
}

export class PlayerManager {
  constructor() {
    this.players = [];
    this.currentIndex = 0;
  }

  /** プレイヤーを追加 */
  setup(playerConfigs) {
    this.players = playerConfigs.map((cfg, i) => new Player(
      cfg.name || PLAYER_NAMES_DEFAULT[i],
      cfg.color || PLAYER_COLORS[i],
      i,
      cfg.isCpu || false
    ));
    this.currentIndex = 0;
  }

  /** 現在のプレイヤーを取得 */
  get current() {
    return this.players[this.currentIndex];
  }

  /** 生存中（非脱落）のプレイヤー数 */
  get activePlayers() {
    return this.players.filter(p => !p.eliminated);
  }

  /** 次のプレイヤーに進む（脱落者はスキップ） */
  nextTurn() {
    const count = this.players.length;
    for (let i = 1; i <= count; i++) {
      const idx = (this.currentIndex + i) % count;
      if (!this.players[idx].eliminated) {
        this.currentIndex = idx;
        return this.players[idx];
      }
    }
    return null; // 全員脱落
  }

  /** 脱落チェック */
  checkElimination(player) {
    if (player.consecutiveMisses >= MAX_CONSECUTIVE_MISSES) {
      player.eliminated = true;
      return true;
    }
    return false;
  }

  /** 全プレイヤーリセット */
  reset() {
    this.players.forEach(p => p.reset());
    this.currentIndex = 0;
  }
}
