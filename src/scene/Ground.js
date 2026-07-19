import * as THREE from 'three';
import { FRICTION, RESTITUTION } from '../constants.js';

export function createGround(scene, world, RAPIER) {
  const groundSize = 200;

  // --- プロシージャル芝生テクスチャ ---
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 512;
  grassCanvas.height = 512;
  const ctx = grassCanvas.getContext('2d');

  // ベース: 深い緑
  ctx.fillStyle = '#3d7a2e';
  ctx.fillRect(0, 0, 512, 512);

  // 草のランダムなストローク
  const grassColors = ['#4a8c34', '#5a9e3e', '#3d7a2e', '#2d6a1e', '#6aae4e'];
  for (let i = 0; i < 8000; i++) {
    ctx.strokeStyle = grassColors[Math.floor(Math.random() * grassColors.length)];
    ctx.lineWidth = Math.random() * 1.5 + 0.5;
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = Math.random() * 6 + 2;
    const angle = (Math.random() - 0.5) * 0.4 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  // 軽い光のムラ
  const gradient = ctx.createRadialGradient(256, 200, 50, 256, 256, 350);
  gradient.addColorStop(0, 'rgba(255, 255, 200, 0.06)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.04)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  const grassTexture = new THREE.CanvasTexture(grassCanvas);
  grassTexture.wrapS = THREE.RepeatWrapping;
  grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(20, 20);
  grassTexture.minFilter = THREE.LinearMipmapLinearFilter;
  grassTexture.anisotropy = 8;

  const material = new THREE.MeshLambertMaterial({
    map: grassTexture,
    color: 0x5a9e3e,
  });

  const geometry = new THREE.PlaneGeometry(groundSize, groundSize);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // --- 投擲エリアのライン ---
  const lineGeometry = new THREE.RingGeometry(1.2, 1.35, 32);
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
  });
  const throwLine = new THREE.Mesh(lineGeometry, lineMaterial);
  throwLine.rotation.x = -Math.PI / 2;
  throwLine.position.set(0, 0.01, -35);
  scene.add(throwLine);

  // --- 物理コライダー ---
  const groundThickness = 10;
  const groundBodyDesc = RAPIER.RigidBodyDesc.fixed()
    .setTranslation(0, -groundThickness / 2, 0);
  const groundBody = world.createRigidBody(groundBodyDesc);

  const groundColliderDesc = RAPIER.ColliderDesc.cuboid(
    groundSize / 2,
    groundThickness / 2,
    groundSize / 2
  )
    .setFriction(FRICTION)
    .setRestitution(RESTITUTION);

  world.createCollider(groundColliderDesc, groundBody);
}
