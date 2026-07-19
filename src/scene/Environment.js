import * as THREE from 'three';

/**
 * 背景環境（公園の雰囲気を演出）
 * - 木のビルボードスプライト
 * - 遠景の丘
 */
export function createEnvironment(scene) {
  // --- 簡易な木スプライト ---
  const treePositions = [
    { x: -40, z: 30 }, { x: -25, z: 45 }, { x: -50, z: 50 },
    { x: 30, z: 35 },  { x: 45, z: 40 },  { x: 55, z: 55 },
    { x: -35, z: 60 }, { x: 10, z: 65 },   { x: 50, z: 65 },
    { x: -60, z: 35 }, { x: 60, z: 45 },   { x: 0, z: 75 },
    { x: -20, z: -55 }, { x: 25, z: -50 }, { x: -45, z: -40 },
    { x: 50, z: -55 },
  ];

  for (const pos of treePositions) {
    const treeGroup = createSimpleTree();
    treeGroup.position.set(pos.x, 0, pos.z);
    // 少しランダムなサイズ
    const scale = 0.8 + Math.random() * 0.6;
    treeGroup.scale.set(scale, scale, scale);
    treeGroup.rotation.y = Math.random() * Math.PI * 2;
    scene.add(treeGroup);
  }
}

function createSimpleTree() {
  const group = new THREE.Group();

  // 幹
  const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 4, 8);
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x6b4226,
    roughness: 0.9,
    metalness: 0.0,
  });
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = 2;
  trunk.castShadow = true;
  group.add(trunk);

  // 葉っぱ（3段の球体で木らしく）
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x3d8b37,
    roughness: 0.8,
    metalness: 0.0,
  });

  const leafSizes = [
    { y: 5, r: 2.5 },
    { y: 6.5, r: 2.0 },
    { y: 7.8, r: 1.3 },
  ];

  for (const leaf of leafSizes) {
    const leafGeometry = new THREE.SphereGeometry(leaf.r, 8, 6);
    const leafMesh = new THREE.Mesh(leafGeometry, leafMaterial);
    leafMesh.position.y = leaf.y;
    leafMesh.castShadow = true;
    group.add(leafMesh);
  }

  return group;
}
