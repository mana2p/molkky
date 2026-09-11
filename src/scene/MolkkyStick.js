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

  // コライダー: 角丸円柱(roundCylinder)
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

  // 長軸の傾き (0: 水平横倒し, 1: 垂直直立)
  const tiltY = Math.abs(2 * (rot.y * rot.z + rot.w * rot.x));

  // 接地判定: 棒が地面付近にある場合のみ（空中での誤爆を防止）
  const isGrounded = pos.y < 0.45 || (pos.y < 0.70 && tiltY > 0.35);

  if ((gamePhase === GamePhase.THROWING || gamePhase === GamePhase.SETTLING) && isGrounded) {
    // スキットルと同等の物理減衰（Linear: 0.40, Angular: 2.50）
    stickData.body.setLinearDamping(0.40);
    stickData.body.setAngularDamping(2.50);

    // 角丸コライダー特有の斜め立ちコマ運動を防止：
    // 地面で斜めに起きて自転している時、垂直スピン（Y軸回転）を素早く逃がしてパタリと倒す
    if (tiltY > 0.30) {
      const angvel = stickData.body.angvel();
      if (Math.abs(angvel.y) > 0.15) {
        stickData.body.setAngvel({ x: angvel.x, y: angvel.y * 0.80, z: angvel.z }, true);
      }
    }
  } else {
    // 空中飛行中: ガイド線と完全一致（空気抵抗ゼロ）
    stickData.body.setLinearDamping(0.0);
    stickData.body.setAngularDamping(0.10);
  }
}

export function isMolkkyStickSettled(stickData, settleFrames, RAPIER) {
  if (!stickData) return true;

  const pos = stickData.body.translation();
  const linvel = stickData.body.linvel();
  const angvel = stickData.body.angvel();
  const speed = Math.hypot(linvel.x, linvel.y, linvel.z);
  const angSpeed = Math.hypot(angvel.x, angvel.y, angvel.z);

  // 地面に落ちて適度に転がる時間（40フレーム ≒ 0.67秒）を確保
  if (pos.y > 0.50 || settleFrames < 40) {
    return false;
  }

  // スキットルと同等の速度閾値で自然にピタッと静止
  if (speed < 0.12 && angSpeed < 0.20) {
    if (speed > 0 || angSpeed > 0) {
      stickData.body.setLinvel(new RAPIER.Vector3(0, 0, 0), true);
      stickData.body.setAngvel(new RAPIER.Vector3(0, 0, 0), true);
      stickData.body.sleep();
    }
    return true;
  }
  return false;
}
