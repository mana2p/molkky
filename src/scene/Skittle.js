import * as THREE from 'three';
import {
  SKITTLE_RADIUS,
  SKITTLE_HALF_HEIGHT,
  SKITTLE_HEIGHT,
  SKITTLE_MASS,
  RESTITUTION,
  FRICTION,
} from '../constants.js';

function createNumberTexture(number) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // 背景は完全透明（木肌がそのまま見える）
  ctx.clearRect(0, 0, 256, 256);

  // 焼印の刻印感を出すための「にじみ」シャドウ（焦げ跡のぼかし）
  ctx.shadowColor = 'rgba(30, 10, 0, 0.6)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // 番号テキスト（焦げ茶色＝焼き印の色）
  ctx.fillStyle = '#3a1a00';
  ctx.font = 'bold 185px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), 128, 128);

  // 二重描画で焼印の濃さと深みを出す
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = 'rgba(60, 20, 0, 0.4)';
  ctx.fillStyle = '#4a2200';
  ctx.fillText(String(number), 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function createSkittle(number, x, z, scene, world, RAPIER) {
  const group = new THREE.Group();

  // 単一の円柱ジオメトリを生成（全体の高さ SKITTLE_HEIGHT = 1.5）
  const geometry = new THREE.CylinderGeometry(
    SKITTLE_RADIUS,
    SKITTLE_RADIUS,
    SKITTLE_HEIGHT,
    32,
    1
  );

  const posAttr = geometry.attributes.position;
  const halfHeight = SKITTLE_HEIGHT / 2;

  // 上部の頂点 (y > 0) を斜め45度にカット
  // 投げる人（Z軸負方向）から見て斜めが手前向き（低く）になるようにする
  // 45度の傾き => Z座標の変位がそのままY座標に加算される (y = halfHeight + z * 1.0)
  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    if (y > 0.001) {
      const zVal = posAttr.getZ(i);
      const newY = halfHeight + zVal * 1.0;
      posAttr.setY(i, newY);
    }
  }
  posAttr.needsUpdate = true; // 頂点更新フラグをオンにする

  // 法線ベクトルとバウンディング情報を再計算（これをしないと影や光がバグる）
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0xd4a574,
    roughness: 0.6,
    metalness: 0.05,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  // 番号を表示する Plane は斜めカットの傾斜面に沿わせる
  const numberTexture = createNumberTexture(number);
  const numberGeometry = new THREE.PlaneGeometry(
    SKITTLE_RADIUS * 1.35, // 楕円の短径(半径の2倍)に合わせてはみ出さないサイズに調整
    SKITTLE_RADIUS * 1.35
  );

  const posAttrNum = numberGeometry.attributes.position;
  // PlaneGeometryの頂点データを加工して、スライス面（y = halfHeight + z）に直接射影する。
  // これにより回転計算が不要になり、オイラー角のねじれによる「突き刺さりバグ」が完全に消滅します！
  // 文字の縦方向（PlaneのY）をシリンダーのZ（奥行き）に対応させます。
  for (let i = 0; i < posAttrNum.count; i++) {
    const px = posAttrNum.getX(i);
    const py = posAttrNum.getY(i);
    
    // シリンダーのローカル座標へ射影
    // カメラから見て裏面表示になっているため、X座標の符号を反転（-px）して鏡文字を解消！
    const newX = -px;
    const newZ = py;
    const newY = halfHeight + newZ * 1.0; // y = halfHeight + z * tan(45°)
    
    posAttrNum.setX(i, newX);
    posAttrNum.setY(i, newY);
    posAttrNum.setZ(i, newZ);
  }
  posAttrNum.needsUpdate = true; // 頂点更新フラグをオンにする
  numberGeometry.computeVertexNormals();

  const numberMaterial = new THREE.MeshBasicMaterial({
    map: numberTexture,
    transparent: true,
    side: THREE.DoubleSide
  });
  const numberMesh = new THREE.Mesh(numberGeometry, numberMaterial);
  numberMesh.castShadow = false;
  numberMesh.receiveShadow = false;

  // 傾斜面は Zがマイナスの領域。傾斜角度は45度 (Math.PI / 4)
  const angle = Math.PI / 4;
  const offset = 0.01; // めり込み防止の微小なオフセット
  
  // 法線ベクトル (0, sin(45°), -cos(45°)) = (0, 0.707, -0.707)
  const ny = Math.sin(angle);
  const nz = -Math.cos(angle);

  // 頂点が既にスライス面に乗っているので、法線方向にオフセットだけ浮かせば完璧に並行に重なる
  numberMesh.position.set(0, ny * offset, nz * offset);
  group.add(numberMesh);

  // 初期位置設定: 物理エンジンの重心位置 (Y = SKITTLE_HALF_HEIGHT) と合わせる
  group.position.set(x, SKITTLE_HALF_HEIGHT, z);
  scene.add(group);

  // ===== Rapier 剛体 =====
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x, SKITTLE_HALF_HEIGHT, z) // 地面にぴったり接地させてバウンドを防止
    .setLinearDamping(0.40) // 芝生での滑りを強く抑える
    .setAngularDamping(2.50) // 倒れた後のコロコロ転がりを強力にストップ
    .setCcdEnabled(true);

  const rigidBody = world.createRigidBody(bodyDesc);

  // 物理コライダーの半径を実寸の80%（SKITTLE_RADIUS * 0.8）に細くします。
  // これにより、底面積が狭くなり、棒がかすっただけでもリアルにパタパタと倒れやすくなります。
  const physicsRadius = SKITTLE_RADIUS * 0.8;
  const colliderDesc = RAPIER.ColliderDesc.cylinder(
    SKITTLE_HALF_HEIGHT,
    physicsRadius
  )
    .setMass(SKITTLE_MASS)
    .setRestitution(RESTITUTION)
    .setFriction(FRICTION);

  world.createCollider(colliderDesc, rigidBody);

  // 初期スポーン時に落下や微小な干渉で暴れないように、最初から物理スリープ（静止）させておく
  rigidBody.sleep();

  return { mesh: group, body: rigidBody, number };
}
