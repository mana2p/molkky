import * as THREE from 'three';

/**
 * インパクト時のパーティクルエフェクト
 * - 木くずパーティクル（スキットル倒壊時）
 * - 祝福パーティクル（高スコア時）
 */
export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.emitters = [];
  }

  /**
   * 木くずパーティクルを発射
   * @param {THREE.Vector3} position - 発射位置
   * @param {number} count - パーティクル数
   */
  emitWoodChips(position, count = 15) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    const colors = new Float32Array(count * 3);

    const woodColors = [
      new THREE.Color(0xd4a574),
      new THREE.Color(0xc19a5b),
      new THREE.Color(0xe8c99b),
      new THREE.Color(0xb8860b),
    ];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y + 0.5;
      positions[i * 3 + 2] = position.z;

      velocities.push({
        x: (Math.random() - 0.5) * 8,
        y: Math.random() * 6 + 2,
        z: (Math.random() - 0.5) * 8,
      });

      const color = woodColors[Math.floor(Math.random() * woodColors.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);

    this.emitters.push({
      points,
      velocities,
      age: 0,
      maxAge: 60,
      gravity: 15,
    });
  }

  /**
   * 祝福パーティクル（全倒し時など）
   * @param {THREE.Vector3} position - 中心位置
   */
  emitCelebration(position) {
    const count = 40;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    const colors = new Float32Array(count * 3);

    const celebColors = [
      new THREE.Color(0xff6b6b),
      new THREE.Color(0xffd93d),
      new THREE.Color(0x6bcb77),
      new THREE.Color(0x4ecdc4),
      new THREE.Color(0xff6eb4),
      new THREE.Color(0xa78bfa),
    ];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y + 1;
      positions[i * 3 + 2] = position.z;

      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 3;
      velocities.push({
        x: Math.cos(angle) * speed,
        y: Math.random() * 10 + 5,
        z: Math.sin(angle) * speed,
      });

      const color = celebColors[Math.floor(Math.random() * celebColors.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.25,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);

    this.emitters.push({
      points,
      velocities,
      age: 0,
      maxAge: 90,
      gravity: 8,
    });
  }

  /** 毎フレーム更新 */
  update() {
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const emitter = this.emitters[i];
      emitter.age++;

      if (emitter.age >= emitter.maxAge) {
        this.scene.remove(emitter.points);
        emitter.points.geometry.dispose();
        emitter.points.material.dispose();
        this.emitters.splice(i, 1);
        continue;
      }

      const dt = 1 / 60;
      const posAttr = emitter.points.geometry.attributes.position;

      for (let j = 0; j < emitter.velocities.length; j++) {
        const vel = emitter.velocities[j];
        vel.y -= emitter.gravity * dt;

        posAttr.array[j * 3] += vel.x * dt;
        posAttr.array[j * 3 + 1] += vel.y * dt;
        posAttr.array[j * 3 + 2] += vel.z * dt;

        // 地面バウンス
        if (posAttr.array[j * 3 + 1] < 0.05) {
          posAttr.array[j * 3 + 1] = 0.05;
          vel.y *= -0.3;
          vel.x *= 0.8;
          vel.z *= 0.8;
        }
      }
      posAttr.needsUpdate = true;

      // フェードアウト
      const progress = emitter.age / emitter.maxAge;
      emitter.points.material.opacity = Math.max(0, 1 - progress * progress);
    }
  }
}
