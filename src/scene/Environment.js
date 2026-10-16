import * as THREE from 'three';
import { Tree } from '@dgreenheck/ez-tree';

/**
 * 背景環境（自然公園の雰囲気を演出）
 * - ez-tree で生成したリアル寄りの木
 * - 控えめな遠景の丘陵
 */
export function createEnvironment(scene) {
  createEzTrees(scene);
  createHills(scene);
}

/**
 * ez-tree のプリセットから代表的な木をいくつか生成し、クローンして林を構築
 */
function createEzTrees(scene) {
  const presets = ['Oak Medium', 'Pine Medium', 'Aspen Medium', 'Ash Medium'];
  const baseTrees = presets.map((name, index) => {
    const tree = new Tree();
    tree.loadPreset(name);
    tree.options.seed = 1000 + index * 333;
    tree.generate();
    tree.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return tree;
  });

  // 奥の林: 揺らぎ付きグリッドで均等にばらまく（丘陵手前の z=36〜68）
  const positions = [];
  for (let z = 36; z <= 68; z += 9) {
    for (let x = -66; x <= 66; x += 13) {
      positions.push({ x: x + (Math.random() - 0.5) * 8, z: z + (Math.random() - 0.5) * 8 });
    }
  }
  // 背後（投擲側）の木
  positions.push({ x: -20, z: -55 }, { x: 25, z: -50 }, { x: -45, z: -40 }, { x: 50, z: -55 });

  for (const pos of positions) {
    const baseTree = baseTrees[Math.floor(Math.random() * baseTrees.length)];
    const tree = baseTree.clone();
    tree.position.set(pos.x, 0, pos.z);
    // ez-tree の高さ・太さに合わせて適切なスケールに調整
    const scale = 0.22 + Math.random() * 0.1;
    tree.scale.set(scale, scale, scale);
    tree.rotation.y = Math.random() * Math.PI * 2;
    scene.add(tree);
  }
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

