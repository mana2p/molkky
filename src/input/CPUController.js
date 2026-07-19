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
   * CPU的ターンを実行
   */
  playTurn(onComplete) {
    // 同じターン内ですでに発火済みならスキップする
    if (this.currentTurnCount === this.gameState.turn) return;
    this.currentTurnCount = this.gameState.turn;

    // 1. ターゲット（ターゲット情報含む）の決定
    const targetDecision = this._chooseTarget();
    if (!targetDecision) {
      // スキットルがない場合は適当に投げる（あり得ないが念のため）
      this._simulatePullAndThrow(0, 0.5, onComplete);
      return;
    }

    // 2. ターゲット座標までの必要な引っ張り量（dx, dy）を計算
    const startX = 0;
    const startZ = -THROW_DISTANCE;
    
    // 単体スキットル直狙いか、密集地の重心・オフセット狙いかを反映
    const targetX = targetDecision.aimX;
    const targetZ = targetDecision.aimZ;
    
    const pull = this._calculatePullForTarget(targetX, targetZ, startX, startZ);

    // 3. 人間味（ブレ）を追加
    // pull は NDC（-1.0 〜 1.0）のスケール。
    let ndcNoise = 0.01; // ブレを半分の約±5pxにして精度2倍に強化！

    // 約40%の確率で超高精度スロー（本気モード）が発動！
    const isCritical = Math.random() < 0.40;
    if (isCritical) {
      console.log(`[CPU] ✨覚醒！超高精度スローを発動します！`);
      ndcNoise = 0.001; // ブレを10分の1にして、ほぼ針の穴を通す超高精度にする
    }

    pull.dx += (Math.random() - 0.5) * 2 * ndcNoise;
    pull.dy += (Math.random() - 0.5) * 2 * ndcNoise;
    
    // Y方向（前進方向）がマイナスになると後ろ向きに投げてしまうため、最小値を担保する
    pull.dy = Math.max(0.01, pull.dy);

    // 4. アニメーション（徐々に引っ張る）して投げる
    this._simulatePullAndThrow(pull.dx, pull.dy, onComplete);
  }

  _chooseTarget() {
    const activeSkittles = [...this.skittleManager.skittles];
    if (activeSkittles.length === 0) return null;

    const currentScore = this.gameState.currentPlayer.score;
    const needed = WIN_SCORE - currentScore;

    const startX = 0;
    const startZ = -THROW_DISTANCE;

    const opponents = this.gameState.playerManager.activePlayers.filter(
      p => p.index !== this.gameState.currentPlayer.index
    );

    // 1. プレイスタイル（攻守方針）の判定
    const playstyle = this._determinePlaystyle(currentScore, opponents);
    console.log(`[CPU] 現在のプレイスタイル: ${playstyle} (現在の点数: ${currentScore}, 残り: ${needed})`);

    // 1.5 爆弾の位置を取得（存在する場合）
    let bombPos = null;
    if (this.gameState.gimmickManager && this.gameState.gimmickManager.bombGroup && this.gameState.gimmickManager.bombGroup.visible) {
      bombPos = this.gameState.gimmickManager.bombPos;
    }

    // 2. 各スキットルをターゲットとした場合の評価（おすすめ度）を計算
    const evaluatedTargets = activeSkittles.map(s => 
      this._evaluateTarget(s, activeSkittles, needed, startX, startZ, playstyle, opponents, currentScore, bombPos)
    );
    
    // 評価が高い順にソート
    evaluatedTargets.sort((a, b) => b.score - a.score);
    const bestTarget = evaluatedTargets[0];

    // 3. ピンチ時の安全策（2回連続ミスしている場合は、確実に当てられる一番密集している場所を狙う）
    if (this.gameState.currentPlayer.consecutiveMisses >= 2) {
      const reachableTargets = evaluatedTargets.filter(t => t.isReachable);
      if (reachableTargets.length > 0) {
        reachableTargets.sort((a, b) => b.clusterCount - a.clusterCount);
        const bestSafety = reachableTargets[0];
        console.log(`[CPU] ⚠️ ピンチ！3回連続ミス回避のため、安全な密集地帯(${bestSafety.target.number}番付近)の中央を狙います！`);
        return {
          target: bestSafety.target,
          aimX: bestSafety.aimX,
          aimZ: bestSafety.aimZ
        };
      }
    }

    // 4. 即上がりできる場合は最優先
    if (bestTarget.score >= 10000) {
      console.log(`[CPU] 🏆 フィニッシュ！ ${bestTarget.target.number}番 を狙って上がりを決めます！`);
      return {
        target: bestTarget.target,
        aimX: bestTarget.aimX,
        aimZ: bestTarget.aimZ
      };
    }

    // 5. 他プレイヤーの妨害（サボタージュ）
    const sortedOpponents = [...opponents].sort((a, b) => b.score - a.score);

    for (const opp of sortedOpponents) {
      const oppNeeded = WIN_SCORE - opp.score;
      if (oppNeeded <= 12) {
        const dangerSkittle = activeSkittles.find(s => s.number === oppNeeded);
        if (dangerSkittle) {
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
              if (pos.z > dangerPos.z + 0.2) continue; // 後ろのスキットルは除外

              const dist = Math.sqrt((pos.x - dangerPos.x) ** 2 + (pos.z - dangerPos.z) ** 2);
              if (dist < closestDist) {
                closestDist = dist;
                sabotageTarget = s;
              }
            }
            
            if (sabotageTarget && closestDist < 3.0) {
              const sabotageEval = evaluatedTargets.find(e => e.target === sabotageTarget);
              if (sabotageEval && sabotageEval.isReachable) {
                console.log(`[CPU] 🛡️ 妨害発動！${opp.name} の上がり目 ${dangerSkittle.number}番 の手前にある ${sabotageTarget.number}番 を狙って崩します！`);
                return {
                  target: sabotageTarget,
                  aimX: sabotageEval.aimX,
                  aimZ: sabotageEval.aimZ
                };
              }
            }
            
            const dangerEval = evaluatedTargets.find(e => e.target === dangerSkittle);
            if (dangerEval && dangerEval.isReachable) {
              console.log(`[CPU] 🛡️ 妨害発動！${opp.name} の上がり目 ${dangerSkittle.number}番 を直接潰します！`);
              return {
                target: dangerSkittle,
                aimX: dangerEval.aimX,
                aimZ: dangerEval.aimZ
              };
            }
            
            console.log(`[CPU] 妨害対象が遠すぎるためサボタージュをスキップ`);
          }
        }
      }
    }

    // 6. 通常のスコア稼ぎ（マルチターン計画・重心狙い・攻守スタイル反映）
    const topScore = evaluatedTargets[0].score;
    const goodTargets = evaluatedTargets.filter(t => t.score >= topScore - 15);
    const selected = goodTargets[Math.floor(Math.random() * goodTargets.length)];
    
    console.log(`[CPU] 🧠 超高度思考: ${selected.target.number}番エリアを攻撃 (期待スコア: ${selected.expectedScore}, 評価値: ${selected.score.toFixed(0)})`);
    return {
      target: selected.target,
      aimX: selected.aimX,
      aimZ: selected.aimZ
    };
  }

  /**
   * 攻守スタイル（LEAD / CHASE / BALANCED）の判定
   */
  _determinePlaystyle(currentScore, opponents) {
    if (!opponents || opponents.length === 0) return 'BALANCED';
    const maxOpponentScore = Math.max(...opponents.map(o => o.score));
    const diff = currentScore - maxOpponentScore;

    if (diff >= 10) return 'LEAD';     // 逃げ切り（安全重視）
    if (diff <= -10) return 'CHASE';   // 追撃（ハイリスク・ハイリターン重視）
    return 'BALANCED';                 // 接戦
  }

  /**
   * スキットル群の「重心（中心）」と形状に応じたオフセットを計算
   */
  _getClusterInfo(targetSkittle, activeSkittles, radius = 1.5) {
    const pos = targetSkittle.body.translation();
    const cluster = activeSkittles.filter(s => {
      const spos = s.body.translation();
      return Math.sqrt((pos.x - spos.x) ** 2 + (pos.z - spos.z) ** 2) < radius;
    });

    if (cluster.length <= 1) {
      return {
        aimX: pos.x,
        aimZ: pos.z,
        clusterCount: 1,
        isCluster: false
      };
    }

    // 重心（平均座標）を計算
    let sumX = 0;
    let sumZ = 0;
    for (const s of cluster) {
      const spos = s.body.translation();
      sumX += spos.x;
      sumZ += spos.z;
    }
    let avgX = sumX / cluster.length;
    let avgZ = sumZ / cluster.length;

    // 形状解析（X方向とZ方向の広がり）
    let varX = 0;
    let varZ = 0;
    for (const s of cluster) {
      const spos = s.body.translation();
      varX += (spos.x - avgX) ** 2;
      varZ += (spos.z - avgZ) ** 2;
    }
    const stdDevX = Math.sqrt(varX / cluster.length);
    const stdDevZ = Math.sqrt(varZ / cluster.length);

    // 横広がり（Xの分散が大きい）場合、中央より少し手前/奥を狙って広範囲になぎ倒すオフセット調整
    let aimX = avgX;
    let aimZ = avgZ;
    if (stdDevX > stdDevZ * 1.2) {
      // 横長クラスターの場合、手前側に少しずらして全倒しを狙う
      aimZ -= 0.15;
    }

    return {
      aimX: aimX,
      aimZ: aimZ,
      clusterCount: cluster.length,
      isCluster: true
    };
  }

  /**
   * マルチターン（最大3ターン）の最適ルート計算
   */
  _evalMultiTurnPlan(expectedScore, needed, activeSkittles, targetSkittle) {
    const remainingNeeded = needed - expectedScore;
    if (remainingNeeded <= 0 || remainingNeeded > 25) return 0;

    // 2ターン目での即上がり可能チェック（1ターン分割）
    if (remainingNeeded <= 12) {
      const setupTarget = activeSkittles.find(s => s.number === remainingNeeded && s !== targetSkittle);
      if (setupTarget) {
        const spos = setupTarget.body.translation();
        const isolated = activeSkittles.every(s => s === setupTarget || Math.sqrt((spos.x - s.body.translation().x) ** 2 + (spos.z - s.body.translation().z) ** 2) >= 1.5);
        if (isolated) return 5000; // 2ターン即上がり絶好ルート
      }
    }

    // 3ターン分割の組み合わせルートチェック（残り13〜25点の場合）
    let bestMultiScore = 0;
    for (let firstTurn = 1; firstTurn <= 12; firstTurn++) {
      const secondTurnNeeded = remainingNeeded - firstTurn;
      if (secondTurnNeeded >= 1 && secondTurnNeeded <= 12) {
        const t1Exist = activeSkittles.some(s => s.number === firstTurn);
        const t2Exist = activeSkittles.some(s => s.number === secondTurnNeeded);
        if (t1Exist && t2Exist) {
          bestMultiScore = Math.max(bestMultiScore, 3000);
        }
      }
    }

    return bestMultiScore;
  }

  /**
   * 相手への塩送り（相手が上がりやすくなるリスク）を計算
   */
  _evalOpponentSetupRisk(expectedScore, currentScore, opponents, activeSkittles) {
    let riskPenalty = 0;
    const cpuNextScore = currentScore + expectedScore;
    if (cpuNextScore >= WIN_SCORE) return 0; // 自分が上がれるならリスク関係なし

    for (const opp of opponents) {
      const oppNeeded = WIN_SCORE - opp.score;
      if (oppNeeded <= 12) {
        const dangerSkittle = activeSkittles.find(s => s.number === oppNeeded);
        if (dangerSkittle) {
          riskPenalty += 100;
        }
      }
    }
    return riskPenalty;
  }

  _evaluateTarget(targetSkittle, activeSkittles, needed, startX, startZ, playstyle, opponents, currentScore, bombPos) {
    const clusterInfo = this._getClusterInfo(targetSkittle, activeSkittles, 1.5);
    const { aimX, aimZ, clusterCount } = clusterInfo;
    
    // --- 届くかどうかの事前チェック ---
    const deltaX = aimX - startX;
    const deltaZ = aimZ - startZ;
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
      if (maxPredictedZ < aimZ - 1.0) {
        isReachable = false;
      }
    }

    // 期待スコア（単体なら番号、密集なら本数）
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
    // ④ 通常の評価計算
    else {
      // プレイスタイル補正
      if (playstyle === 'LEAD') {
        // リード時: 安全重視。密集地帯（clusterCount > 1）の評価を大きくアップ
        if (clusterCount > 1) {
          score += clusterCount * 40;
        } else {
          score += targetSkittle.number * 5; // 単体狙いの優先度を下げる
        }
      } else if (playstyle === 'CHASE') {
        // 追撃時: 逆転狙い。高得点単体ピン（10〜12番）や大クラスターを強く評価
        if (clusterCount === 1 && targetSkittle.number >= 10) {
          score += targetSkittle.number * 25;
        } else {
          score += expectedScore * 15;
        }
      } else {
        // BALANCED
        score += expectedScore * 10;
        if (clusterCount > 1) {
          score += clusterCount * 15;
        }
      }

      // マルチターン（2〜3ターン先）の計算結果を加算
      const multiTurnBonus = this._evalMultiTurnPlan(expectedScore, needed, activeSkittles, targetSkittle);
      score += multiTurnBonus;

      // 相手への塩送り防止ペナルティを適用
      const riskPenalty = this._evalOpponentSetupRisk(expectedScore, currentScore, opponents, activeSkittles);
      score -= riskPenalty;

      // 爆弾の考慮
      if (bombPos) {
        const distToBomb = Math.sqrt((aimX - bombPos.x) ** 2 + (aimZ - bombPos.z) ** 2);
        if (distToBomb < 5.5) { // 爆発の巻き込み範囲
          if (needed <= 12 || playstyle === 'LEAD') {
            // 正確な点数が欲しい時や安全重視の時は爆弾を避ける
            score -= 1000;
          } else if (playstyle === 'CHASE') {
            // 負けている時は爆弾に巻き込んで大逆転・かく乱を狙う
            score += 500;
          }
        }
      }
    }

    return { 
      target: targetSkittle, 
      aimX: aimX, 
      aimZ: aimZ, 
      score: score, 
      expectedScore: expectedScore, 
      isReachable: isReachable, 
      clusterCount: clusterCount 
    };
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
