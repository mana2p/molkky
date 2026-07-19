import { SKITTLE_POSITIONS, SKITTLE_HALF_HEIGHT, SETTLE_VELOCITY_THRESHOLD } from '../constants.js';
import { createSkittle } from '../scene/Skittle.js';
import { isSkittleToppled } from './Rules.js';

export class SkittleManager {
  constructor() {
    this.skittles = [];
    this.RAPIER = null;
    this._scene = null;
    this._world = null;
  }

  init(scene, world, RAPIER) {
    this.RAPIER = RAPIER;
    this._scene = scene;
    this._world = world;

    for (const pos of SKITTLE_POSITIONS) {
      const skittle = createSkittle(pos.number, pos.x, pos.z, scene, world, RAPIER);
      this.skittles.push(skittle);
    }
  }

  syncMeshes() {
    for (const skittle of this.skittles) {
      const pos = skittle.body.translation();
      const rot = skittle.body.rotation();

      skittle.mesh.position.set(pos.x, pos.y, pos.z);
      skittle.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    }
  }

  areAllSettled() {
    let allSettled = true;
    for (const skittle of this.skittles) {
      const linvel = skittle.body.linvel();
      const angvel = skittle.body.angvel();
      const speed = Math.sqrt(linvel.x ** 2 + linvel.y ** 2 + linvel.z ** 2);
      const angSpeed = Math.sqrt(angvel.x ** 2 + angvel.y ** 2 + angvel.z ** 2);

      if (speed < SETTLE_VELOCITY_THRESHOLD && angSpeed < SETTLE_VELOCITY_THRESHOLD) {
        if (speed > 0 || angSpeed > 0) {
          skittle.body.setLinvel(new this.RAPIER.Vector3(0, 0, 0), true);
          skittle.body.setAngvel(new this.RAPIER.Vector3(0, 0, 0), true);
          skittle.body.sleep();
        }
      } else {
        allSettled = false;
      }
    }
    return allSettled;
  }

  getToppledNumbers() {
    const toppled = [];
    for (const skittle of this.skittles) {
      if (isSkittleToppled(skittle.body)) {
        toppled.push(skittle.number);
      }
    }
    return toppled;
  }

  /** ターン終了時：全てのスキットルをその場で直立させる（倒れたものも、中途半端に傾いたものも全て） */
  resetToppled() {
    for (const skittle of this.skittles) {
      const pos = skittle.body.translation();
      skittle.body.setLinvel(new this.RAPIER.Vector3(0, 0, 0), true);
      skittle.body.setAngvel(new this.RAPIER.Vector3(0, 0, 0), true);
      skittle.body.setTranslation(
        new this.RAPIER.Vector3(pos.x, SKITTLE_HALF_HEIGHT, pos.z),
        true
      );
      skittle.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      skittle.body.sleep();
    }
  }

  /** 全スキットルを初期位置にリセット（ゲームリスタート用） */
  resetAll() {
    for (let i = 0; i < this.skittles.length; i++) {
      const skittle = this.skittles[i];
      const pos = SKITTLE_POSITIONS[i];

      skittle.body.setLinvel(new this.RAPIER.Vector3(0, 0, 0), true);
      skittle.body.setAngvel(new this.RAPIER.Vector3(0, 0, 0), true);
      skittle.body.setTranslation(
        new this.RAPIER.Vector3(pos.x, SKITTLE_HALF_HEIGHT, pos.z),
        true
      );
      skittle.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      skittle.body.sleep();
    }
  }

  /** 倒れたスキットルの位置を返す（パーティクル用） */
  getToppledPositions() {
    const positions = [];
    for (const skittle of this.skittles) {
      if (isSkittleToppled(skittle.body)) {
        const pos = skittle.body.translation();
        positions.push({ x: pos.x, y: pos.y, z: pos.z });
      }
    }
    return positions;
  }
}
