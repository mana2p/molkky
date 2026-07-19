import {
  THROW_MIN_POWER,
  THROW_MAX_POWER,
  THROW_Y_FACTOR,
  THROW_Z_FACTOR,
  THROW_X_FACTOR,
  SLINGSHOT_MAX_PULL,
  THROW_HEIGHT,
  THROW_DISTANCE,
  WIN_SCORE
} from '../constants.js';

export class CPUController {
  constructor(throwController, skittleManager, gameState) {
    this.throwController = throwController;
    this.skittleManager = skittleManager;
    this.gameState = gameState;
    this.currentTurnCount = 0; // ターンごとの重複発火を防止するフラグ
  }

  /**
   * CPUのターンを実行
   */
  playTurn(onComplete) {
    // 同じターン内ですでに発火済みならスキットする
    if (this.currentTurnCount === this.gameState.turn) return;
    this.currentTurnCount = this.gameState.turn;

    // 1. ターゲットの決定
    const targetSkittle = this._chooseTarget();
    if (!targetSkittle) {
      // スキットルがない場合は適当に投げる（あり得ないが念のため）
      this._simulatePullAndThrow(0, 0.5, onComplete);
      return;
    }

    // 2. ターゲット座標までの必要な引っ張り量（dx, dy）を計算
    const startX = 0;
    const startZ = -THROW_DISTANCE;
    const targetPos = targetSkittle.body.translation();
    
    const pull = this._calculatePullForTarget(targetPos.x, targetPos.z, startX, startZ);

    // 3. 人間味（ブレ）を追加
    // pull は NDC（-1.0 〜 1.0）のスケール。
    // 画面幅1000pxと仮定した場合、±10pxのブレは約0.02NDCに相当する。
    const ndcNoise = 0.02;
    pull.dx += (Math.random() - 0.5) * 2 * ndcNoise;
    pull.dy += (Math.random() - 0.5) * 2 * ndcNoise;

    // 4. アニメーション（徐々に引っ張る）して投げる
    this._simulatePullAndThrow(pull.dx, pull.dy, onComplete);
  }

  _chooseTarget() {
    const activeSkittles = [...this.skittleManager.skittles];
    if (activeSkittles.length === 0) return null;

    // 1. 自身の上がり優先
    const currentScore = this.gameState.currentPlayer.score;
    const needed = WIN_SCORE - currentScore;

    if (needed <= 12) {
      const exactTarget = activeSkittles.find(s => s.number === needed);
      if (exactTarget) {
        return exactTarget;
      }
    }

    // 2. 他プレイヤーの妨害（サボタージュ）
    const opponents = this.gameState.playerManager.activePlayers.filter(
      p => p.index !== this.gameState.currentPlayer.index
    );
    
    // スコアが高い順（より上がりに近い順）に並べる
    opponents.sort((a, b) => b.score - a.score);

    for (const opp of opponents) {
      const oppNeeded = WIN_SCORE - opp.score;
      if (oppNeeded <= 12) {
        const dangerSkittle = activeSkittles.find(s => s.number === oppNeeded);
        if (dangerSkittle) {
          // 危険スキットルが存在する！一番近い別のスキットルを探してそれをぶつける
          const dangerPos = dangerSkittle.body.translation();
          let closestDist = Infinity;
          let sabotageTarget = null;
          
          for (const s of activeSkittles) {
            if (s.number === dangerSkittle.number) continue;
            const pos = s.body.translation();
            const dist = Math.sqrt((pos.x - dangerPos.x) ** 2 + (pos.z - dangerPos.z) ** 2);
            if (dist < closestDist) {
              closestDist = dist;
              sabotageTarget = s;
            }
          }
          
          if (sabotageTarget) {
            console.log(`[CPU] 妨害発動！${opp.name} の上がり目 ${dangerSkittle.number}番 に一番近い ${sabotageTarget.number}番 を狙います！`);
            return sabotageTarget;
          }
        }
      }
    }

    // 3. 通常時のスコア稼ぎ（高得点を狙う！）
    // 高得点順（降順）にソート
    activeSkittles.sort((a, b) => b.number - a.number);
    // 上位3本のうちのどれかを狙う（一番高いやつだけだと単調になるため）
    const index = Math.floor(Math.random() * Math.min(3, activeSkittles.length));
    const targetSkittle = activeSkittles[index];
    console.log(`[CPU] 通常攻撃: ${targetSkittle.number}番 を狙います`);
    return targetSkittle;
  }

  _calculatePullForTarget(targetX, targetZ, startX, startZ) {
    const deltaX = targetX - startX;
    const deltaZ = targetZ - startZ;
    
    // ThrowControllerの計算に合うように比率を調整
    const adjustedDeltaX = deltaX / THROW_X_FACTOR;
    const adjustedDeltaZ = deltaZ / THROW_Z_FACTOR;
    const adjustedDist = Math.sqrt(adjustedDeltaX ** 2 + adjustedDeltaZ ** 2);
    
    const dirX = adjustedDeltaX / adjustedDist;
    const dirY = adjustedDeltaZ / adjustedDist;

    // パワーを二分探索で探す
    let low = THROW_MIN_POWER;
    let high = THROW_MAX_POWER;
    let bestPower = low;
    
    for (let i = 0; i < 20; i++) {
      const midPower = (low + high) / 2;
      const throwY = midPower * THROW_Y_FACTOR;
      const throwZ = dirY * midPower * THROW_Z_FACTOR;
      
      const g = 9.81;
      const maxT = (throwY + Math.sqrt(throwY ** 2 + 2 * g * THROW_HEIGHT)) / g;
      const predictedZ = startZ + throwZ * maxT;
      
      // Z軸はカメラ奥がマイナス方向。
      // predictedZ が targetZ より「小さい（奥にある）」場合は、パワーが強すぎて飛びすぎている
      if (predictedZ < targetZ) {
        high = midPower; // 飛びすぎなので上限を下げる
      } else {
        low = midPower;  // 手前すぎるので下限を上げる
      }
      bestPower = midPower;
    }
    
    // power から normalizedPower (0〜1) に逆変換
    let normalizedPower = (bestPower - THROW_MIN_POWER) / (THROW_MAX_POWER - THROW_MIN_POWER);
    normalizedPower = Math.max(0.01, Math.min(1.0, normalizedPower)); // 少しだけ引く
    const pullDistance = normalizedPower * SLINGSHOT_MAX_PULL;
    
    return {
      dx: dirX * pullDistance,
      dy: dirY * pullDistance
    };
  }

  _simulatePullAndThrow(targetDx, targetDy, onComplete) {
    const frames = 60; // 1秒かけて引く
    let currentFrame = 0;
    
    const animate = () => {
      if (currentFrame > frames) {
        // 発射
        this.throwController.releaseSimulatedPull();
        if (onComplete) onComplete();
        return;
      }
      
      const progress = currentFrame / frames;
      // イージング（easeOutQuad）
      const easeProgress = progress * (2 - progress);
      
      const dx = targetDx * easeProgress;
      const dy = targetDy * easeProgress;
      
      this.throwController.setSimulatedPull(dx, dy);
      currentFrame++;
      requestAnimationFrame(animate);
    };
    
    // 少し待ってからエイム開始（人間っぽさ）
    setTimeout(() => {
      animate();
    }, 1000);
  }
}
