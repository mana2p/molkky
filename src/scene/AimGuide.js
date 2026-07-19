import * as THREE from 'three';
import { SLINGSHOT_MAX_PULL } from '../constants.js';

/**
 * パチンコ式エイムガイド
 * - 予測軌道の放物線（点線）
 * - 着弾予測地点の円形マーカー
 * - パワーに応じた色変化（緑→黄→赤）
 */
export class AimGuide {
  constructor(scene) {
    this.scene = scene;

    // 放物線の予測軌跡
    const trailGeometry = new THREE.BufferGeometry();
    const pointsCount = 40;
    const trailPositions = new Float32Array(pointsCount * 3);
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));

    this.trailMaterial = new THREE.LineDashedMaterial({
      color: 0x00ffcc,
      dashSize: 0.4,
      gapSize: 0.25,
      transparent: true,
      opacity: 0.85,
      linewidth: 1,
    });

    this.trail = new THREE.Line(trailGeometry, this.trailMaterial);
    this.trail.computeLineDistances();
    this.trail.visible = false;
    scene.add(this.trail);

    // 着弾予測マーカー（グラウンド上のリング）
    const ringGeometry = new THREE.RingGeometry(0.5, 0.7, 32);
    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    this.landingRing = new THREE.Mesh(ringGeometry, this.ringMaterial);
    this.landingRing.rotation.x = -Math.PI / 2;
    this.landingRing.position.y = 0.02; // 地面からほんの少し浮かす
    this.landingRing.visible = false;
    scene.add(this.landingRing);

    // パワーインジケーター（引っ張りの矢印線）
    const arrowGeometry = new THREE.BufferGeometry();
    const arrowPositions = new Float32Array(2 * 3);
    arrowGeometry.setAttribute('position', new THREE.BufferAttribute(arrowPositions, 3));

    this.arrowMaterial = new THREE.LineBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.5,
      linewidth: 2,
    });
    this.arrow = new THREE.Line(arrowGeometry, this.arrowMaterial);
    this.arrow.visible = false;
    scene.add(this.arrow);
  }

  /** パワー値 (0〜1) に応じた色を返す */
  _getPowerColor(power) {
    if (power < 0.4) return new THREE.Color(0x00ff88); // 緑（弱い）
    if (power < 0.7) return new THREE.Color(0xffdd00); // 黄（ちょうどいい）
    return new THREE.Color(0xff4444); // 赤（強い）
  }

  /**
   * エイムガイドを更新
   * @param {Object} stickPos - 棒の現在位置 {x, y, z}
   * @param {Object} pullInfo - ThrowControllerからのpullInfo
   */
  update(stickPos, pullInfo) {
    if (!pullInfo || !pullInfo.throwVec) {
      this.hide();
      return;
    }

    const vel = pullInfo.throwVec;
    const color = this._getPowerColor(pullInfo.power);

    // --- 放物線の軌跡更新 ---
    this.trail.visible = true;
    const posAttr = this.trail.geometry.attributes.position;
    const pointsCount = posAttr.count;
    const g = 9.81;

    // 着弾までの正確な時間を計算: y = y0 + vy*t - 0.5*g*t^2 = 0
    // => t = (vy + sqrt(vy^2 + 2*g*y0)) / g
    const maxT = (vel.y + Math.sqrt(vel.y * vel.y + 2 * g * stickPos.y)) / g;

    for (let i = 0; i < pointsCount; i++) {
      const t = (i / (pointsCount - 1)) * maxT;
      const x = stickPos.x + vel.x * t;
      const y = stickPos.y + vel.y * t - 0.5 * g * t * t;
      const z = stickPos.z + vel.z * t;

      // 地面以下にはいかない
      const clampedY = Math.max(0.05, y);
      posAttr.setXYZ(i, x, clampedY, z);
    }
    posAttr.needsUpdate = true;
    this.trail.geometry.computeBoundingBox();
    this.trail.geometry.computeBoundingSphere();
    this.trail.computeLineDistances();
    this.trailMaterial.color = color;

    // --- 着弾マーカー更新 ---
    // 着弾地点は軌跡の最後のポイント
    const landingX = stickPos.x + vel.x * maxT;
    const landingZ = stickPos.z + vel.z * maxT;
    
    this.landingRing.visible = true;
    this.landingRing.position.set(landingX, 0.02, landingZ);
    // パワーに応じてリングサイズ変更
    const scale = 0.8 + pullInfo.power * 1.2;
    this.landingRing.scale.set(scale, scale, scale);
    this.ringMaterial.color = color;

    // --- 軌跡色更新 ---
    this.trailMaterial.color = color;
    this.ringMaterial.color = color;
  }

  hide() {
    this.trail.visible = false;
    this.landingRing.visible = false;
    this.arrow.visible = false;
  }

  dispose() {
    this.scene.remove(this.trail);
    this.scene.remove(this.landingRing);
    this.scene.remove(this.arrow);
    this.trail.geometry.dispose();
    this.trailMaterial.dispose();
    this.landingRing.geometry.dispose();
    this.ringMaterial.dispose();
    this.arrow.geometry.dispose();
    this.arrowMaterial.dispose();
  }
}
