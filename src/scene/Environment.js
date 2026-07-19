import * as THREE from 'three';

/**
 * 背景環境（自然公園の雰囲気を演出）
 * - 滑らかで読みやすい木（幹の太さ変化・枝・色バリエーション付きの球体葉叢）
 * - 控えめな遠景の丘陵
 */
export function createEnvironment(scene) {
  // --- 木 ---
  const treePositions = [
    { x: -40, z: 30 }, { x: -25, z: 45 }, { x: -50, z: 50 },
    { x: 30, z: 35 },  { x: 45, z: 40 },  { x: 55, z: 55 },
    { x: -35, z: 60 }, { x: 10, z: 65 },   { x: 50, z: 65 },
    { x: -60, z: 35 }, { x: 60, z: 45 },   { x: 0, z: 75 },
    { x: -20, z: -55 }, { x: 25, z: -50 }, { x: -45, z: -40 },
    { x: 50, z: -55 },
  ];

  for (const pos of treePositions) {
    const treeGroup = createTree();
    treeGroup.position.set(pos.x, 0, pos.z);
    const scale = 0.8 + Math.random() * 0.6;
    treeGroup.scale.set(scale, scale, scale);
    treeGroup.rotation.y = Math.random() * Math.PI * 2;
    scene.add(treeGroup);
  }

  // --- 遠景の丘陵（控えめ）---
  createHills(scene);
}

/**
 * 木を生成（テーパー幹 + 根元の膨らみ + 短い枝 + 球体の葉叢4〜5段）
 */
function createTree() {
  const group = new THREE.Group();

  // 幹の色をランダムにばらす
  const trunkLightness = 0.2 + Math.random() * 0.08;
  const trunkColor = new THREE.Color().setHSL(0.07, 0.5, trunkLightness);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: trunkColor,
    roughness: 0.92,
    metalness: 0.0,
  });

  // 主幹（テーパー）
  const trunkHeight = 4 + Math.random() * 1.5;
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.5, trunkHeight, 8);
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  group.add(trunk);

  // 根元の膨らみ
  const rootGeo = new THREE.CylinderGeometry(0.5, 0.7, 0.5, 8);
  const root = new THREE.Mesh(rootGeo, trunkMat);
  root.position.y = 0.25;
  group.add(root);

  // 短い枝を2本（幹の中段あたりから斜めに）
  for (let i = 0; i < 2; i++) {
    const branchLen = 1.0 + Math.random() * 0.8;
    const branchGeo = new THREE.CylinderGeometry(0.05, 0.12, branchLen, 5);
    const branch = new THREE.Mesh(branchGeo, trunkMat);
    
    const branchY = trunkHeight * (0.4 + Math.random() * 0.3);
    const angle = Math.PI * i + (Math.random() - 0.5) * 1.2;
    
    branch.position.set(
      Math.sin(angle) * branchLen * 0.3,
      branchY,
      Math.cos(angle) * branchLen * 0.3
    );
    // 上向きかつ外側に生えるように回転軸と符号を修正
    branch.rotation.x = Math.cos(angle) * 0.8;
    branch.rotation.z = -Math.sin(angle) * 0.8;
    branch.castShadow = true;
    group.add(branch);
  }

  // 葉叢（滑らかな球体を4〜5個、少しずらして重ねて自然な樹冠を作る）
  const leafCount = 4 + Math.floor(Math.random() * 2);
  
  // ベースとなる葉の色をランダムに（濃い緑〜やや明るい緑）
  const baseHue = 0.28 + Math.random() * 0.06;
  const baseSat = 0.55 + Math.random() * 0.2;
  const baseLight = 0.3 + Math.random() * 0.1;

  for (let i = 0; i < leafCount; i++) {
    // 各球ごとに微妙に色を変えて立体感を出す
    const leafColor = new THREE.Color().setHSL(
      baseHue + (Math.random() - 0.5) * 0.04,
      baseSat + (Math.random() - 0.5) * 0.1,
      baseLight + (Math.random() - 0.5) * 0.06
    );
    const leafMat = new THREE.MeshStandardMaterial({
      color: leafColor,
      roughness: 0.8,
      metalness: 0.0,
    });

    const radius = 1.3 + Math.random() * 1.2;
    const leafGeo = new THREE.SphereGeometry(radius, 12, 10);
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    
    // 中心から少しずらして配置（重なり合って自然な形に）
    const offsetX = (Math.random() - 0.5) * 1.8;
    const offsetZ = (Math.random() - 0.5) * 1.8;
    const offsetY = trunkHeight + i * 0.8 + Math.random() * 0.5;
    leaf.position.set(offsetX, offsetY, offsetZ);
    
    // 少し潰して卵型にする球もある
    leaf.scale.y = 0.7 + Math.random() * 0.4;
    leaf.castShadow = true;
    group.add(leaf);
  }

  return group;
}

/**
 * 遠景の丘陵を生成（控えめ）
 */
function createHills(scene) {
  const hillMat = new THREE.MeshStandardMaterial({
    color: 0x4a7c3f,
    roughness: 0.95,
    metalness: 0.0,
  });

  const hillConfigs = [
    { x: -70, z: 110, sx: 70, sy: 6, sz: 35 },
    { x: 50, z: 120, sx: 90, sy: 8, sz: 40 },
    { x: -50, z: -85, sx: 60, sy: 5, sz: 30 },
    { x: 70, z: -95, sx: 70, sy: 7, sz: 35 },
  ];

  for (const cfg of hillConfigs) {
    const hillGeo = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const hill = new THREE.Mesh(hillGeo, hillMat);
    hill.scale.set(cfg.sx, cfg.sy, cfg.sz);
    hill.position.set(cfg.x, 0, cfg.z);
    hill.receiveShadow = true;
    scene.add(hill);
  }
}

