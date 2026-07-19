import * as THREE from 'three';
import {
  STICK_RADIUS,
  STICK_LENGTH,
  STICK_HALF_LENGTH,
  STICK_MASS,
  THROW_DISTANCE,
  THROW_HEIGHT,
  RESTITUTION,
  FRICTION,
} from '../constants.js';
import { GamePhase } from '../game/GameState.js';

let stickMesh = null;
let stickBody = null;

export function createMolkkyStick(scene, world, RAPIER) {
  // 面取り（角丸）のある円柱ジオメトリを生成
  const r = STICK_RADIUS;
  const h = STICK_HALF_LENGTH;
  const bevelRadius = r * 0.4; // 半径の40%を面取りし、写真のような大きな丸みを再現
  const points = [];
  
  // 下面の中心
  points.push(new THREE.Vector2(0, -h));
  
  // 下面の角丸 (270度〜360度)
  const segments = 8;
  for(let i = 0; i <= segments; i++) {
    const theta = (i / segments) * (Math.PI / 2) + Math.PI * 1.5;
    points.push(new THREE.Vector2(
      (r - bevelRadius) + bevelRadius * Math.cos(theta),
      (-h + bevelRadius) + bevelRadius * Math.sin(theta)
    ));
  }
  
  // 上面の角丸 (0度〜90度)
  for(let i = 0; i <= segments; i++) {
    const theta = (i / segments) * (Math.PI / 2);
    points.push(new THREE.Vector2(
      (r - bevelRadius) + bevelRadius * Math.cos(theta),
      (h - bevelRadius) + bevelRadius * Math.sin(theta)
    ));
  }
  
  // 上面の中心
  points.push(new THREE.Vector2(0, h));

  const geometry = new THREE.LatheGeometry(points, 24);
  geometry.rotateX(Math.PI / 2); // Z軸方向に寝かせる

  const material = new THREE.MeshStandardMaterial({
    color: 0xc19a5b,
    roughness: 0.6,
    metalness: 0.1,
  });

  stickMesh = new THREE.Mesh(geometry, material);
  stickMesh.castShadow = true;
  scene.add(stickMesh);

  const startZ = -THROW_DISTANCE;
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(0, THROW_HEIGHT, startZ)
    .setLinearDamping(0.0)   // 空気抵抗ゼロ（エイム予測線と完全一致させるため）
    .setAngularDamping(0.10) // 空中での自然な回転を維持
    .setCcdEnabled(true);

  stickBody = world.createRigidBody(bodyDesc);

  // コライダー: 面取り円柱(roundCylinder)コライダーに変更し、
  // 現実のモルック棒の「角が取れた平らな端面」の物理挙動を正確に再現する。
  const colliderDesc = RAPIER.ColliderDesc.roundCylinder(
    h - bevelRadius,
    r - bevelRadius,
    bevelRadius
  )
    .setMass(STICK_MASS)
    .setFriction(FRICTION)
    .setRestitution(RESTITUTION)
    .setRotation({
      x: Math.sin(Math.PI / 4),
      y: 0,
      z: 0,
      w: Math.cos(Math.PI / 4),
    });

  world.createCollider(colliderDesc, stickBody);

  return { mesh: stickMesh, body: stickBody };
}

export function resetStick(body, RAPIER) {
  const startZ = -THROW_DISTANCE;
  body.setLinvel(new RAPIER.Vector3(0, 0, 0), true);
  body.setAngvel(new RAPIER.Vector3(0, 0, 0), true);
  body.setTranslation(new RAPIER.Vector3(0, THROW_HEIGHT, startZ), true);
  body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
}

export function throwStick(body, RAPIER, velocity) {
  body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
  
  // マウスのドラッグ速度から直接速度をセットする
  body.setLinvel(new RAPIER.Vector3(velocity.x, velocity.y, velocity.z), true);
  
  // モルック特有の回転（縦スピン）を加える（X軸周りに約3回転/秒の回転速度を与える）
  body.setAngvel(new RAPIER.Vector3(-20.0, 0, 0), true);
}

export function syncMolkkyStickMesh(stickData, gamePhase) {
  if (!stickData) return;
  const pos = stickData.body.translation();
  const rot = stickData.body.rotation();
  stickData.mesh.position.set(pos.x, pos.y, pos.z);
  stickData.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);

  if ((gamePhase === GamePhase.THROWING || gamePhase === GamePhase.SETTLING) && pos.y < 0.45) {
    stickData.body.setLinearDamping(0.8);
    stickData.body.setAngularDamping(4.0);
  } else if (gamePhase === GamePhase.READY || gamePhase === GamePhase.THROWING || gamePhase === GamePhase.SETTLING) {
    stickData.body.setLinearDamping(0.0);
    stickData.body.setAngularDamping(0.10);
  }
}

export function isMolkkyStickSettled(stickData, settleFrames, RAPIER) {
  if (!stickData) return true;

  const pos = stickData.body.translation();
  const linvel = stickData.body.linvel();
  const angvel = stickData.body.angvel();
  const speed = Math.sqrt(linvel.x ** 2 + linvel.y ** 2 + linvel.z ** 2);
  const angSpeed = Math.sqrt(angvel.x ** 2 + angvel.y ** 2 + angvel.z ** 2);

  if (pos.y > 0.6 || settleFrames < 30) {
    return false;
  }

  if (speed < 0.3 && angSpeed < 0.5) {
    if (speed > 0 || angSpeed > 0) {
      stickData.body.setLinvel(new RAPIER.Vector3(0, 0, 0), true);
      stickData.body.setAngvel(new RAPIER.Vector3(0, 0, 0), true);
      stickData.body.sleep();
    }
    return true;
  }
  return false;
}
