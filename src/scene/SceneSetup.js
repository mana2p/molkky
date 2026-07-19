import * as THREE from 'three';
import { CAMERA_POSITION, CAMERA_LOOK_AT } from '../constants.js';

let scene, camera, renderer;

export function initScene(container) {
  scene = new THREE.Scene();

  // --- グラデーション空 ---
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 2;
  skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext('2d');
  const skyGradient = skyCtx.createLinearGradient(0, 0, 0, 256);
  skyGradient.addColorStop(0, '#1a6fd4');    // 上空: 深い青
  skyGradient.addColorStop(0.4, '#5ba3e6');  // 中間: 明るい青
  skyGradient.addColorStop(0.7, '#87ceeb');  // 地平線付近: スカイブルー
  skyGradient.addColorStop(1, '#c9e8f5');    // 地平線: 淡い白青
  skyCtx.fillStyle = skyGradient;
  skyCtx.fillRect(0, 0, 2, 256);
  const skyTexture = new THREE.CanvasTexture(skyCanvas);
  skyTexture.magFilter = THREE.LinearFilter;
  scene.background = skyTexture;

  scene.fog = new THREE.FogExp2(0xa8d8ea, 0.004);

  camera = new THREE.PerspectiveCamera(
    17.5,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);
  camera.lookAt(CAMERA_LOOK_AT.x, CAMERA_LOOK_AT.y, CAMERA_LOOK_AT.z);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  container.appendChild(renderer.domElement);

  // --- ライティング ---
  // 温かみのあるアンビエント
  const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.45);
  scene.add(ambientLight);

  // メインの太陽光（温かいゴールド）
  const sunLight = new THREE.DirectionalLight(0xfff2cc, 1.2);
  sunLight.position.set(25, 60, -20);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 200;
  sunLight.shadow.camera.left = -50;
  sunLight.shadow.camera.right = 50;
  sunLight.shadow.camera.top = 50;
  sunLight.shadow.camera.bottom = -50;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);

  // 空と地面の色を反映するヘミスフィアライト
  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x4a7c3f, 0.35);
  scene.add(hemiLight);

  // 薄い逆光（リムライト）
  const backLight = new THREE.DirectionalLight(0x99ccff, 0.3);
  backLight.position.set(-15, 30, 30);
  scene.add(backLight);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer };
}

export function renderScene() {
  renderer.render(scene, camera);
}

export function getCamera() {
  return camera;
}
