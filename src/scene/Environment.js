import * as THREE from 'three';

/**
 * 背景環境（自然公園の雰囲気を演出）
 * - リアルな木（分岐する幹・枝・非対称な葉叢クラスター）
 * - 遠景の丘陵
 * - 低木・花の点在
 */
export function createEnvironment(scene) {
  // --- リアルな木 ---
  const treePositions = [
    { x: -40, z: 30 }, { x: -25, z: 45 }, { x: -50, z: 50 },
    { x: 30, z: 35 },  { x: 45, z: 40 },  { x: 55, z: 55 },
    { x: -35, z: 60 }, { x: 10, z: 65 },   { x: 50, z: 65 },
    { x: -60, z: 35 }, { x: 60, z: 45 },   { x: 0, z: 75 },
    { x: -20, z: -55 }, { x: 25, z: -50 }, { x: -45, z: -40 },
    { x: 50, z: -55 },
  ];

  for (const pos of treePositions) {
    const treeGroup = createRealisticTree();
    treeGroup.position.set(pos.x, 0, pos.z);
    const scale = 0.7 + Math.random() * 0.8;
    treeGroup.scale.set(scale, scale, scale);
    treeGroup.rotation.y = Math.random() * Math.PI * 2;
    scene.add(treeGroup);
  }

  // --- 遠景の丘陵 ---
  createHills(scene);

  // --- 低木・花の点在 ---
  createBushesAndFlowers(scene);
}

/**
 * リアルな木を生成（分岐する幹、非対称な葉叢クラスター、色バリエーション）
 */
function createRealisticTree() {
  const group = new THREE.Group();

  // 幹の色をランダムに少しばらつかせる
  const trunkHue = 0.06 + Math.random() * 0.03; // オレンジ寄り〜赤茶
  const trunkColor = new THREE.Color().setHSL(trunkHue, 0.55, 0.22 + Math.random() * 0.08);

  const trunkMat = new THREE.MeshStandardMaterial({
    color: trunkColor,
    roughness: 0.95,
    metalness: 0.0,
  });

  // 主幹（下から上に向かって細くなるテーパー）
  const trunkHeight = 3.5 + Math.random() * 2;
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.55, trunkHeight, 7);
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  group.add(trunk);

  // 根元の膨らみ（フレア）
  const rootGeo = new THREE.CylinderGeometry(0.55, 0.85, 0.6, 7);
  const root = new THREE.Mesh(rootGeo, trunkMat);
  root.position.y = 0.3;
  root.castShadow = true;
  group.add(root);

  // 枝を2〜4本追加（ランダムな角度・長さ）
  const branchCount = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < branchCount; i++) {
    const branchLen = 1.5 + Math.random() * 2;
    const branchGeo = new THREE.CylinderGeometry(0.06, 0.15, branchLen, 5);
    const branch = new THREE.Mesh(branchGeo, trunkMat);
    
    const branchY = trunkHeight * (0.5 + Math.random() * 0.4);
    const angle = (Math.PI * 2 / branchCount) * i + (Math.random() - 0.5) * 0.8;
    const tilt = 0.4 + Math.random() * 0.5; // 傾き
    
    branch.position.set(
      Math.sin(angle) * branchLen * 0.35,
      branchY,
      Math.cos(angle) * branchLen * 0.35
    );
    branch.rotation.z = Math.cos(angle) * tilt;
    branch.rotation.x = -Math.sin(angle) * tilt;
    branch.castShadow = true;
    group.add(branch);

    // 枝先に小さめの葉叢をつける
    const smallLeaf = createLeafCluster(0.8 + Math.random() * 0.6);
    smallLeaf.position.set(
      Math.sin(angle) * branchLen * 0.65,
      branchY + branchLen * 0.3,
      Math.cos(angle) * branchLen * 0.65
    );
    group.add(smallLeaf);
  }

  // メインの葉叢クラスター（頂上に大きめに3〜5個配置して非対称に）
  const crownClusters = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < crownClusters; i++) {
    const radius = 1.5 + Math.random() * 1.5;
    const clusterMesh = createLeafCluster(radius);
    const offsetX = (Math.random() - 0.5) * 2.5;
    const offsetZ = (Math.random() - 0.5) * 2.5;
    const offsetY = trunkHeight + 0.5 + Math.random() * 2.5;
    clusterMesh.position.set(offsetX, offsetY, offsetZ);
    group.add(clusterMesh);
  }

  return group;
}

/**
 * 葉叢クラスター1個を生成（変形した球体でモコモコ感）
 */
function createLeafCluster(radius) {
  // 葉の色に自然なバリエーション（濃い緑〜黄緑〜少し黄色がかった緑まで）
  const hue = 0.25 + Math.random() * 0.1;       // 緑系
  const sat = 0.5 + Math.random() * 0.3;
  const light = 0.28 + Math.random() * 0.15;
  const leafColor = new THREE.Color().setHSL(hue, sat, light);

  const leafMat = new THREE.MeshStandardMaterial({
    color: leafColor,
    roughness: 0.85,
    metalness: 0.0,
    flatShading: true, // ポリゴンの面が見える＝自然なモコモコ感
  });

  // DodecahedronGeometry（12面体）を使って自然な球状に
  const geo = new THREE.DodecahedronGeometry(radius, 1);
  
  // 頂点をランダムにずらして不規則な形に
  const posAttr = geo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    posAttr.setX(i, posAttr.getX(i) + (Math.random() - 0.5) * radius * 0.35);
    posAttr.setY(i, posAttr.getY(i) + (Math.random() - 0.5) * radius * 0.25);
    posAttr.setZ(i, posAttr.getZ(i) + (Math.random() - 0.5) * radius * 0.35);
  }
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, leafMat);
  mesh.castShadow = true;
  // ランダムに少し潰す・伸ばすで変化をつける
  mesh.scale.set(
    0.8 + Math.random() * 0.4,
    0.7 + Math.random() * 0.5,
    0.8 + Math.random() * 0.4
  );
  return mesh;
}

/**
 * 遠景の丘陵を生成
 */
function createHills(scene) {
  const hillMat = new THREE.MeshStandardMaterial({
    color: 0x4a7c3f,
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true,
  });

  const hillConfigs = [
    { x: -80, z: 100, sx: 60, sy: 8, sz: 30 },
    { x: 40, z: 110, sx: 80, sy: 12, sz: 35 },
    { x: -30, z: 120, sx: 50, sy: 6, sz: 25 },
    { x: 80, z: 90, sx: 45, sy: 7, sz: 28 },
    { x: -70, z: -80, sx: 55, sy: 9, sz: 30 },
    { x: 60, z: -90, sx: 65, sy: 10, sz: 32 },
  ];

  for (const cfg of hillConfigs) {
    const hillGeo = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const hill = new THREE.Mesh(hillGeo, hillMat);
    hill.scale.set(cfg.sx, cfg.sy, cfg.sz);
    hill.position.set(cfg.x, 0, cfg.z);
    hill.receiveShadow = true;
    scene.add(hill);
  }
}

/**
 * 低木と花を散りばめる
 */
function createBushesAndFlowers(scene) {
  const bushMat = new THREE.MeshStandardMaterial({
    color: 0x2d6b30,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true,
  });

  // 低木（小さなモコモコ球）
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 15 + Math.random() * 50;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    const bushGeo = new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.5, 1);
    // 頂点を少し変形
    const posAttr = bushGeo.attributes.position;
    for (let j = 0; j < posAttr.count; j++) {
      posAttr.setY(j, posAttr.getY(j) * (0.5 + Math.random() * 0.3));
    }
    bushGeo.computeVertexNormals();

    const bush = new THREE.Mesh(bushGeo, bushMat);
    bush.position.set(x, 0.2, z);
    bush.castShadow = true;
    scene.add(bush);
  }

  // 花（小さな球＋茎）
  const flowerColors = [0xff6b8a, 0xffeb3b, 0xff9800, 0xba68c8, 0xef5350, 0xffffff];
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 8 + Math.random() * 45;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    // 茎
    const stemGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.3 + Math.random() * 0.2, 4);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3f });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(x, 0.15, z);
    scene.add(stem);

    // 花弁
    const color = flowerColors[Math.floor(Math.random() * flowerColors.length)];
    const flowerGeo = new THREE.SphereGeometry(0.06 + Math.random() * 0.05, 6, 4);
    const flowerMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.6 });
    const flower = new THREE.Mesh(flowerGeo, flowerMat);
    flower.position.set(x, 0.35 + Math.random() * 0.1, z);
    scene.add(flower);
  }
}

