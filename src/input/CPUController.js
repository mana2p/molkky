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
    let ndcNoise = 0.02; // 通常のブレ（約±10px）

    // 3回〜4回に1回（約30%の確率）で高精度スロー（本気モード）が発動！
    const isCritical = Math.random() < 0.30;
    if (isCritical) {
      console.log(`[CPU] ✨覚醒！高精度スローを発動します！`);
      ndcNoise = 0.002; // ブレを10分の1にして、ほぼ狙い通りの超高精度にする
    }

    pull.dx += (Math.random() - 0.5) * 2 * ndcNoise;
    pull.dy += (Math.random() - 0.5) * 2 * ndcNoise;

    // 4. アニメーション（徐々に引っ張る）して投げる
    this._simulatePullAndThrow(pull.dx, pull.dy, onComplete);
  }

  _chooseTarget() {
    const activeSkittles = [...this.skittleManager.skittles];
    if (activeSkittles.length === 0) return null;

    const currentScore = this.gameState.currentPlayer.score;
    const needed = WIN_SCORE - currentScore;

    // CPUの投げる位置
    const startX = 0;
    const startZ = -THROW_DISTANCE;

    // 1. 各スキットルを狙った場合の「評価値（おすすめ度）」を計算
    const evaluatedTargets = activeSkittles.map(s => this._evaluateTarget(s, activeSkittles, needed, startX, startZ));
    
    // 評価が高い順にソート
    evaluatedTargets.sort((a, b) => b.score - a.score);
    const bestTarget = evaluatedTargets[0];

    // 2. 即上がりできる場合はサボタージュより優先して上がる！
    if (bestTarget.score >= 10000) {
      console.log(`[CPU] フィニッシュ！ ${bestTarget.target.number}番 を狙って上がりを決めます！`);
      return bestTarget.target;
    }

    // 3. 他プレイヤーの妨害（サボタージュ）
    const opponents = this.gameState.playerManager.activePlayers.filter(
      p => p.index !== this.gameState.currentPlayer.index
    );
    opponents.sort((a, b) => b.score - a.score);

    for (const opp of opponents) {
      const oppNeeded = WIN_SCORE - opp.score;
      if (oppNeeded <= 12) {
        const dangerSkittle = activeSkittles.find(s => s.number === oppNeeded);
        if (dangerSkittle) {
          // 危険スキットルが孤立しているか（狙われやすい状態か）をチェック
          const dangerPos = dangerSkittle.body.translation();
          let clusterCount = 0;
          for (const s of activeSkittles) {
            const pos = s.body.translation();
            const dist = Math.sqrt((pos.x - dangerPos.x) ** 2 + (pos.z - dangerPos.z) ** 2);
            if (dist < 1.5) clusterCount++;
          }
          
          if (clusterCount === 1) { // 孤立している＝相手が上がりやすい
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
    }

    // 4. 通常のスコア稼ぎ（密集度や次ターンを考慮した一番評価の高いターゲット）
    // 評価が同じくらいのものからランダムに選ぶ（単調にならないように上位から抽選）
    const topScore = evaluatedTargets[0].score;
    const goodTargets = evaluatedTargets.filter(t => t.score >= topScore - 10);
    const selected = goodTargets[Math.floor(Math.random() * goodTargets.length)];
    
    console.log(`[CPU] 戦略的思考: ${selected.target.number}番 を狙います (期待スコア: ${selected.expectedScore}, 評価値: ${selected.score})`);
    return selected.target;
  }

  _evaluateTarget(targetSkittle, activeSkittles, needed, startX, startZ) {
    const CLUSTER_RADIUS = 1.5; // この半径内にいると「巻き込んで倒れる」と判定する
    const pos = targetSkittle.body.translation();
    
    // --- 届くかどうかの事前チェック ---
    const deltaX = pos.x - startX;
    const deltaZ = pos.z - startZ;
    const adjustedDeltaX = deltaX / THROW_X_FACTOR;
    const adjustedDeltaZ = deltaZ / THROW_Z_FACTOR;
    const adjustedDist = Math.sqrt(adjustedDeltaX ** 2 + adjustedDeltaZ ** 2);
    
    let isReachable = true;
    if (adjustedDist > 0.001) {
      const dirY = adjustedDeltaZ / adjustedDist;
      const throwY = THROW_MAX_POWER * THROW_Y_FACTOR;
      const throwZ = dirY * THROW_MAX_POWER * THROW_Z_FACTOR;
      const g = 9.81;
      const maxT = (throwY + Math.sqrt(throwY ** 2 + 2 * g * THROW_HEIGHT)) / g;
      const maxPredictedZ = startZ + throwZ * maxT;
      // 多少転がることを考慮して、ターゲットの手前1.0まで届けばOKとする
      if (maxPredictedZ < pos.z - 1.0) {
        isReachable = false;
      }
    }
    
    // 密集度（巻き込み本数）を計算
    let clusterCount = 0;
    for (const s of activeSkittles) {
      const spos = s.body.translation();
      const dist = Math.sqrt((pos.x - spos.x) ** 2 + (pos.z - spos.z) ** 2);
      if (dist < CLUSTER_RADIUS) {
        clusterCount++;
      }
    }

    // 期待スコア
    // 周囲に誰もいなければ（1本だけなら）そのスキットルの数字。密集していれば巻き込む本数がスコア。
    const expectedScore = clusterCount === 1 ? targetSkittle.number : clusterCount;

    let score = 0;

    // ① 届かないターゲットへのペナルティ（最優先で回避）
    if (!isReachable) {
      score -= 50000;
    }

    // ② 即上がり
    if (expectedScore === needed) {
      score += 10000; // 最高評価
    }
    // ③ バースト（負け確定なので絶対に避ける）
    else if (expectedScore > needed) {
      score -= 10000;
    }
    // ④ 次のターンの上がり目作り（分割上がり）
    else {
      const remainingNeeded = needed - expectedScore;
      let foundGoodSetup = false;
      
      // 次のターンで上がれる数字が「孤立して」存在するか？
      if (remainingNeeded <= 12 && remainingNeeded > 0) {
        const setupTarget = activeSkittles.find(s => s.number === remainingNeeded);
        if (setupTarget && setupTarget !== targetSkittle) {
          let setupClusterCount = 0;
          const setupPos = setupTarget.body.translation();
          for (const s of activeSkittles) {
            const spos = s.body.translation();
            const dist = Math.sqrt((setupPos.x - spos.x) ** 2 + (setupPos.z - spos.z) ** 2);
            if (dist < CLUSTER_RADIUS) setupClusterCount++;
          }
          if (setupClusterCount === 1) { // 孤立していて確実に点数が取れる
            foundGoodSetup = true;
          }
        }
      }

      if (foundGoodSetup) {
        score += 5000; // 次のターンで上がれる絶好のポジションなので超高評価
      }

      // ⑤ ベースとなる評価値（純粋なスコア稼ぎ）
      score += expectedScore * 10;
      
      // 密集している場合は狙いやすい（ブレても何かに当たる）ので安全ボーナス
      if (clusterCount > 1) {
        score += clusterCount * 5;
      }
    }

    return { target: targetSkittle, score: score, expectedScore: expectedScore, isReachable: isReachable };
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
      
      // Z軸は投げ出し(-35)からスキットル(0)に向かってプラス方向へ飛ぶ。
      // predictedZ が targetZ より「小さい」場合は、パワーが弱すぎて手前に落ちている
      if (predictedZ < targetZ) {
        low = midPower;  // 手前すぎるので下限を上げる
      } else {
        high = midPower; // 飛びすぎなので上限を下げる
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
