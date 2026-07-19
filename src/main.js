import { initPhysics, stepPhysics, getRapier } from './physics/PhysicsWorld.js';
import { initScene, renderScene, getCamera } from './scene/SceneSetup.js';
import { createGround } from './scene/Ground.js';
import { createEnvironment } from './scene/Environment.js';
import { createMolkkyStick, resetStick, throwStick } from './scene/MolkkyStick.js';
import { ThrowController } from './input/ThrowController.js';
import { GameState, GamePhase } from './game/GameState.js';
import { SkittleManager } from './game/SkittleManager.js';
import { AimGuide } from './scene/AimGuide.js';
import { CameraController } from './scene/CameraController.js';
import { ParticleSystem } from './effects/ParticleSystem.js';
import { GameUI } from './ui/GameUI.js';
import { CPUController } from './input/CPUController.js';
import { SETTLE_MIN_FRAMES } from './constants.js';

let throwController;
let gameState;
let skittleManager;
let stickData;
let aimGuide;
let cameraController;
let particleSystem;
let cpuController;
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

  // 10.5 CPUコントローラー
  cpuController = new CPUController(throwController, skittleManager, gameState);

  // 11. UI初期化
  gameUI = new GameUI();
  gameUI.onStartGame = startGame;
  gameUI.onReplay = replay;
  gameUI.onBackToMenu = backToMenu;
  gameUI.showMainMenu();

  // 12. ゲームループ開始
  isRunning = true;
  gameLoop();
}

function startGame(playerConfigs) {
  gameState.startGame(playerConfigs);
  skittleManager.resetAll();
  resetStick(stickData.body, getRapier());
  cameraController.resetToOverview();

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
  startGame(configs);
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
  skittleManager.syncMeshes();
  syncStickMesh();
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
    && isStickSettled();

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

function isStickSettled() {
  if (!stickData) return true;

  const pos = stickData.body.translation();
  const linvel = stickData.body.linvel();
  const angvel = stickData.body.angvel();
  const speed = Math.sqrt(linvel.x ** 2 + linvel.y ** 2 + linvel.z ** 2);
  const angSpeed = Math.sqrt(angvel.x ** 2 + angvel.y ** 2 + angvel.z ** 2);

  if (pos.y > 0.6 || gameState.settleFrames < 30) {
    return false;
  }

  if (speed < 0.3 && angSpeed < 0.5) {
    if (speed > 0 || angSpeed > 0) {
      stickData.body.setLinvel(new (getRapier().Vector3)(0, 0, 0), true);
      stickData.body.setAngvel(new (getRapier().Vector3)(0, 0, 0), true);
      stickData.body.sleep();
    }
    return true;
  }
  return false;
}

function proceedToNextTurn() {
  skittleManager.resetToppled();
  resetStick(stickData.body, getRapier());

  const nextPlayer = gameState.nextTurn();
  if (!nextPlayer) return;

  // カメラを全体表示に戻す
  cameraController.setOverview();

  gameUI.updateCurrentPlayer(nextPlayer, gameState.turn);
  gameUI.updateScoreboard(
    gameState.playerManager.players,
    gameState.playerManager.currentIndex,
  );
  gameUI.showThrowGuide(true);
  gameUI.hideMessage();
}

function syncStickMesh() {
  if (!stickData) return;
  const pos = stickData.body.translation();
  const rot = stickData.body.rotation();
  stickData.mesh.position.set(pos.x, pos.y, pos.z);
  stickData.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);

  // 着地後（高さが一定以下）は草むらの強い抵抗（ダンピング）をかけて、不自然な斜め転がりを防ぐ
  // モルック棒の半径は0.275なので、0.4以下なら地面に接触していると判定
  if ((gameState.phase === GamePhase.THROWING || gameState.phase === GamePhase.SETTLING) && pos.y < 0.45) {
    stickData.body.setLinearDamping(0.8);
    stickData.body.setAngularDamping(4.0); // 回転への抵抗をかなり強くして転がりを止める
  } else if (gameState.phase === GamePhase.READY || gameState.phase === GamePhase.THROWING || gameState.phase === GamePhase.SETTLING) {
    // 構え中および空中（スキットル衝突でバウンド中など）の間は空気抵抗をリセット
    stickData.body.setLinearDamping(0.0);
    stickData.body.setAngularDamping(0.10);
  }
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

main().catch((err) => {
  console.error('Molkky initialization failed:', err);
  document.body.innerHTML = `<div style="color:red;padding:40px;font-size:20px;">
    初期化エラー: ${err.message}<br>
    WebGL2対応ブラウザで開いてください。
  </div>`;
});
