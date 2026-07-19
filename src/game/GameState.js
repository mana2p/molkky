import { calculateScore, applyScore, isWin } from './Rules.js';
import { PlayerManager } from './PlayerManager.js';

export const GamePhase = {
  MENU: 'MENU',
  SETUP: 'SETUP',
  READY: 'READY',
  AIMING: 'AIMING',
  THROWING: 'THROWING',
  SETTLING: 'SETTLING',
  SCORING: 'SCORING',
  GAME_OVER: 'GAME_OVER',
};

export class GameState {
  constructor() {
    this.playerManager = new PlayerManager();
    this.gameMode = 'NORMAL';
    this.reset();
  }

  reset() {
    this.phase = GamePhase.MENU;
    this.turn = 1;
    this.lastMessage = '';
    this.lastTurnScore = 0;
    this.lastToppledNumbers = [];
    this.settleFrames = 0;
    this.winner = null;
    this.playerManager.reset();
  }

  /** ゲーム開始: プレイヤー設定を受けてREADYフェーズへ */
  startGame(playerConfigs) {
    this.playerManager.setup(playerConfigs);
    this.turn = 1;
    this.phase = GamePhase.READY;
    this.winner = null;
  }

  /** 現在のプレイヤー */
  get currentPlayer() {
    return this.playerManager.current;
  }

  /** 現在のプレイヤーのスコア */
  get score() {
    return this.currentPlayer ? this.currentPlayer.score : 0;
  }

  onThrow() {
    this.phase = GamePhase.THROWING;
    this.settleFrames = 0;
  }

  onStartSettling() {
    this.phase = GamePhase.SETTLING;
    this.settleFrames = 0;
  }

  incrementSettleFrames() {
    this.settleFrames++;
  }

  /** スコア確定処理（マルチプレイヤー対応） */
  onScoreSettled(toppledNumbers) {
    this.phase = GamePhase.SCORING;
    this.lastToppledNumbers = toppledNumbers;

    const player = this.currentPlayer;
    const turnScore = calculateScore(toppledNumbers);
    this.lastTurnScore = turnScore;

    // ミス処理
    if (turnScore === 0) {
      player.consecutiveMisses++;
      player.scoreHistory.push({ turn: this.turn, gained: 0, total: player.score });

      if (this.playerManager.checkElimination(player)) {
        // 全員脱落チェック
        if (this.playerManager.activePlayers.length === 0) {
          this.phase = GamePhase.GAME_OVER;
          this.lastMessage = '💀 全員脱落！ゲーム終了！';
          return { message: this.lastMessage, gameOver: true };
        }

        const activePlayers = this.playerManager.activePlayers;
        // 残り1人なら自動勝利
        if (activePlayers.length === 1) {
          this.winner = activePlayers[0];
          this.phase = GamePhase.GAME_OVER;
          this.lastMessage = `🎉 ${this.winner.name} の勝利！（最後の生き残り）`;
          return { message: this.lastMessage, gameOver: true };
        }

        this.lastMessage = `💀 ${player.name} 脱落！（3回連続ミス）`;
        return { message: this.lastMessage, gameOver: false, eliminated: true };
      }

      this.lastMessage = `${player.name}: ミス！（${player.consecutiveMisses}/3回連続）`;
      return { message: this.lastMessage, gameOver: false };
    }

    // 得点処理
    player.consecutiveMisses = 0;
    const { newScore, overshot } = applyScore(player.score, turnScore);
    player.score = newScore;
    player.scoreHistory.push({ turn: this.turn, gained: turnScore, total: newScore });

    if (isWin(player.score)) {
      this.winner = player;
      this.phase = GamePhase.GAME_OVER;
      this.lastMessage = `🎉 ${player.name} 50点で勝利！`;
      return { message: this.lastMessage, gameOver: true };
    }

    if (overshot) {
      this.lastMessage = `⚠️ ${player.name}: 50点超え！25点にリセット（+${turnScore} → ${player.score}点）`;
    } else if (toppledNumbers.length === 1) {
      this.lastMessage = `${player.name}: ${toppledNumbers[0]}番を倒した！ +${turnScore}点（${player.score}点）`;
    } else {
      this.lastMessage = `${player.name}: ${toppledNumbers.length}本倒した！ +${turnScore}点（${player.score}点）`;
    }

    return { message: this.lastMessage, gameOver: false };
  }

  /** 次のターンへ進む */
  nextTurn() {
    const nextPlayer = this.playerManager.nextTurn();
    if (!nextPlayer) {
      this.phase = GamePhase.GAME_OVER;
      return null;
    }
    this.turn++;
    this.phase = GamePhase.READY;
    return nextPlayer;
  }
}
