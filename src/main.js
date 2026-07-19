import { initPhysics, stepPhysics, getRapier } from './physics/PhysicsWorld.js';
import { initScene, renderScene, getCamera } from './scene/SceneSetup.js';
import { createGround } from './scene/Ground.js';
import { createEnvironment } from './scene/Environment.js';
import { createMolkkyStick, resetStick, throwStick, syncMolkkyStickMesh, isMolkkyStickSettled } from './scene/MolkkyStick.js';
import { ThrowController } from './input/ThrowController.js';
import { GameState, GamePhase } from './game/GameState.js';
import { SkittleManager } from './game/SkittleManager.js';
import { AimGuide } from './scene/AimGuide.js';
import { CameraController } from './scene/CameraController.js';
import { ParticleSystem } from './effects/ParticleSystem.js';
import { GameUI } from './ui/GameUI.js';
import { CPUController } from './input/CPUController.js';
import { GimmickManager } from './game/GimmickManager.js';
import { SETTLE_MIN_FRAMES } from './constants.js';
import { audioManager } from './audio/AudioManager.js';

let throwController;
let gameState;
let skittleManager;
let stickData;
let aimGuide;
let cameraController;
let particleSystem;
let cpuController;
let gimmickManager;
let gameUI;
let world;
let scene;
let isRunning = false;

async function main() {
  // 1. 物理エンジン初期化
  const physics = await initPhysics();
  world = physics.world;
  const RAPIER = physics.rapier;

  // 2. Three.jsシーン初期化
  const container = document.getElementById('app');
  const sceneData = initScene(container);
  scene = sceneData.scene;
  const camera = sceneData.camera;
  const renderer = sceneData.renderer;

  // 3. 地面＆環境
  createGround(scene, world, RAPIER);
  createEnvironment(scene);

  // 4. カメラコントローラー
  cameraController = new CameraController(camera);
  cameraController.resetToOverview();

  // 5. パーティクルシステム
  particleSystem = new ParticleSystem(scene);

  // 6. エイムガイド
  aimGuide = new AimGuide(scene);

  // 7. スキットル12本
  skittleManager = new SkittleManager();
  skittleManager.init(scene, world, RAPIER);

  // 8. モルック棒
  stickData = createMolkkyStick(scene, world, RAPIER);

  // 9. 入力コントローラー
  throwController = new ThrowController(renderer.domElement);
  throwController.setCanThrow(false);

  // 10. ゲーム状態
  gameState = new GameState();

  // 10.2 ギミックマネージャー
  gimmickManager = new GimmickManager(scene, world, RAPIER);

  // 10.5 CPUコントローラー
  cpuController = new CPUController(throwController, skittleManager, gameState);

  // 11. UI初期化
  gameUI = new GameUI();
  gameUI.onStartGame = startGame;
  gameUI.onReplay = replay;
  gameUI.onBackToMenu = () => {
    resetToMainMenu();
  };

  // サウンド制御
  const audioBtn = document.getElementById('btn-audio-toggle');
  if (audioBtn) {
    audioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isMuted = audioManager.toggleMute();
      audioBtn.textContent = isMuted ? '🔇' : '🔊';
    });
  }
  window.addEventListener('pointerdown', () => {
    audioManager.initOnFirstInteraction();
  });

  // 12. ゲームループ開始
  isRunning = true;
  gameLoop();
}

function startGame(playerConfigs, selectedMode = 'NORMAL') {
  gameState.startGame(playerConfigs);
  gameState.gameMode = selectedMode;
  gimmickManager.setMode(selectedMode);

  skittleManager.resetAll();
  resetStick(stickData.body, getRapier());
  cameraController.resetToOverview();

  gimmickManager.onTurnStart(gameState.turn, skittleManager.skittles);

  const player = gameState.currentPlayer;
  gameUI.updateCurrentPlayer(player, gameState.turn);
  gameUI.updateScoreboard(
    gameState.playerManager.players,
    gameState.playerManager.currentIndex,
  );
  gameUI.showThrowGuide(true);
  throwController.setCanThrow(true);
}

function replay() {
  gameUI.hideResult();
  gameUI.hideMessage();
  gameUI.showHUD();

  // 同じプレイヤー構成でリスタート
  const configs = gameState.playerManager.players.map(p => ({
    name: p.name,
    color: p.color,
    isCpu: p.isCpu,
  }));
  startGame(configs, gameState.gameMode);
}

function backToMenu() {
  gameUI.hideResult();
  gameUI.hideMessage();
  skittleManager.resetAll();
  resetStick(stickData.body, getRapier());
  cameraController.resetToOverview();
  gameState.reset();
  throwController.setCanThrow(false);
  gameUI.showMainMenu();
}

function gameLoop() {
  if (!isRunning) return;
  requestAnimationFrame(gameLoop);

  stepPhysics();
  updateSoundCollisions();

  switch (gameState.phase) {
    case GamePhase.READY:
      handleReady();
      break;
    case GamePhase.THROWING:
      handleThrowing();
      break;
    case GamePhase.SETTLING:
      handleSettling();
      break;
    case GamePhase.MENU:
    case GamePhase.SETUP:
    case GamePhase.SCORING:
    case GamePhase.GAME_OVER:
      break;
  }

  // エイムとパワーゲージの更新
  updateAimAndPower();

  // 各システム更新
  if (gimmickManager) {
    gimmickManager.update(stickData ? stickData.body : null, skittleManager.skittles);
  }
  skittleManager.syncMeshes();
  syncMolkkyStickMesh(stickData, gameState.phase);
  cameraController.update();
  particleSystem.update();
  renderScene();
}

function handleReady() {
  if (gameState.currentPlayer.isCpu) {
    throwController.setCanThrow(false);
    cpuController.playTurn();
  } else {
    throwController.setCanThrow(true);
  }

  const throwVec = throwController.update();

  if (throwVec) {
    throwStick(stickData.body, getRapier(), throwVec);
    gameState.onThrow();

    // 着弾予測地点を計算し、カメラに渡す
    const stickPos = stickData.body.translation();
    const g = 9.81;
    const maxT = (throwVec.y + Math.sqrt(throwVec.y * throwVec.y + 2 * g * stickPos.y)) / g;
    const landingX = stickPos.x + throwVec.x * maxT;
    const landingZ = stickPos.z + throwVec.z * maxT;

    gameState.landingFrames = Math.max(0, Math.floor(maxT * 60)); // 着地までのフレーム数

    throwController.setCanThrow(false);
    gameUI.showThrowGuide(false);
    gameUI.hidePowerGauge();
    aimGuide.hide();

    // カメラを追跡モードに（着弾予測地点を渡す）
    cameraController.setFollow(stickData.body, { x: landingX, y: 0, z: landingZ });
  }
}

function handleThrowing() {
  throwController.update();
  gameState.incrementSettleFrames();

  if (gameState.settleFrames > SETTLE_MIN_FRAMES / 2) {
    gameState.onStartSettling();
  }
}

function handleSettling() {
  gameState.incrementSettleFrames();

  const timedOut = gameState.settleFrames > SETTLE_MIN_FRAMES * 3;
  const allSettled = gameState.settleFrames >= SETTLE_MIN_FRAMES
    && skittleManager.areAllSettled()
    && isMolkkyStickSettled(stickData, gameState.settleFrames, getRapier());

  if (timedOut || allSettled) {
    const toppledPositions = skittleManager.getToppledPositions();
    const toppledNumbers = skittleManager.getToppledNumbers();

    if (toppledPositions.length > 0) {
      // 倒れたスキットルの平均位置にカメラをフォーカス
      const avgX = toppledPositions.reduce((s, p) => s + p.x, 0) / toppledPositions.length;
      const avgZ = toppledPositions.reduce((s, p) => s + p.z, 0) / toppledPositions.length;
      cameraController.setImpact({ x: avgX, y: 0.5, z: avgZ });

      // パーティクル発射
      for (const pos of toppledPositions) {
        particleSystem.emitWoodChips(pos, 10);
      }
    }
    // 倒れなかった（ミス）場合は OVERVIEW_LOCKED のまま→スキットル群が見える位置を維持
    const result = gameState.onScoreSettled(toppledNumbers);

    // 大量倒し時のお祝いパーティクル
    if (toppledNumbers.length >= 4) {
      particleSystem.emitCelebration({ x: 0, y: 1, z: 0 });
    }

    // スコアボード更新
    gameUI.updateScoreboard(
      gameState.playerManager.players,
      gameState.playerManager.currentIndex,
    );

    if (result.gameOver) {
      gameUI.showMessage(result.message, 0);
      setTimeout(() => {
        gameUI.hideMessage();
        gameUI.showResult(
          gameState.playerManager.players,
          gameState.winner,
        );
      }, 2500);
    } else {
      gameUI.showMessage(result.message, 2200);
      setTimeout(() => {
        proceedToNextTurn();
      }, 2500);
    }
  }
}



function proceedToNextTurn() {
  skittleManager.resetToppled();
  resetStick(stickData.body, getRapier());

  if (gimmickManager) {
    gimmickManager.triggerUFOAbduction(gameState.turn, skittleManager.skittles, cameraController, () => {
      finishProceedTurn();
    });
  } else {
    finishProceedTurn();
  }
}

function finishProceedTurn() {
  const nextPlayer = gameState.nextTurn();
  if (!nextPlayer) return;

  // カメラを全体表示に戻す
  cameraController.setOverview();

  gimmickManager.onTurnStart(gameState.turn, skittleManager.skittles);

  gameUI.updateCurrentPlayer(nextPlayer, gameState.turn);
  gameUI.updateScoreboard(
    gameState.playerManager.players,
    gameState.playerManager.currentIndex,
  );
  gameUI.showThrowGuide(true);
  gameUI.hideMessage();
}



function updateAimAndPower() {
  if (gameState && gameState.phase === GamePhase.READY && throwController) {
    const pullInfo = throwController.getPullInfo();

    if (pullInfo) {
      // エイムガイドの更新
      const stickPos = stickData.body.translation();
      aimGuide.update(stickPos, pullInfo);

      // パワーゲージの更新
      gameUI.updatePowerGauge(pullInfo.power);
      return;
    }
  }

  aimGuide.hide();
  gameUI.hidePowerGauge();
}

let prevStickSpeed = 0;
let prevSkittleSpeeds = new Map();

function updateSoundCollisions() {
  if (!stickData || !skittleManager) return;
  if (gameState.phase !== GamePhase.THROWING && gameState.phase !== GamePhase.SETTLING) {
    prevStickSpeed = 0;
    prevSkittleSpeeds.clear();
    return;
  }

  // モルック棒の減速・着地
  const sVel = stickData.body.linvel();
  const stickSpeed = Math.sqrt(sVel.x ** 2 + sVel.y ** 2 + sVel.z ** 2);
  const stickPos = stickData.body.translation();

  if (prevStickSpeed > 3.0 && (prevStickSpeed - stickSpeed > 2.0 || (stickPos.y < 0.4 && prevStickSpeed > 1.5))) {
    const vol = Math.min(1.0, prevStickSpeed / 15.0);
    audioManager.playHit(vol);
  }
  prevStickSpeed = stickSpeed;

  // スキットルの衝撃検知
  for (const skittle of skittleManager.skittles) {
    if (!skittle.body) continue;
    const vel = skittle.body.linvel();
    const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
    const prevSpeed = prevSkittleSpeeds.get(skittle.number) || 0;

    if (prevSpeed < 0.3 && speed > 1.0) {
      const vol = Math.min(1.0, speed / 10.0);
      audioManager.playHit(vol);
    } else if (prevSpeed > 2.0 && (prevSpeed - speed > 1.5)) {
      const vol = Math.min(1.0, prevSpeed / 10.0);
      audioManager.playHit(vol);
    }
    prevSkittleSpeeds.set(skittle.number, speed);
  }
}

main().catch((err) => {
  console.error('Molkky initialization failed:', err);
  document.body.innerHTML = `<div style="color:red;padding:40px;font-size:20px;">
    初期化エラー: ${err.message}<br>
    WebGL2対応ブラウザで開いてください。
  </div>`;
});
