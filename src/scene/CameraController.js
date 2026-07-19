import * as THREE from 'three';
import { CAMERA_POSITION, CAMERA_LOOK_AT } from '../constants.js';

/**
 * カメラ演出コントローラー
 *
 * フェーズ遷移:
 *   OVERVIEW → (投擲) → FOLLOW → (棒がスキットル群に到達) → OVERVIEW_LOCKED → (判定完了) → IMPACT → (次のターン) → OVERVIEW
 *
 * OVERVIEW_LOCKED:
 *   棒がスキットル群の近くに来たら追跡をやめてスキットル群全体が見渡せる
 *   やや引いた位置で固定。倒れる様子をしっかり見せる。
 */
export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'OVERVIEW';

    this.overviewPos = new THREE.Vector3(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);
    this.overviewTarget = new THREE.Vector3(CAMERA_LOOK_AT.x, CAMERA_LOOK_AT.y, CAMERA_LOOK_AT.z);

    // スキットル群の観戦に最適な位置（OVERVIEW_LOCKED用）
    // スキットル群は Z=0 付近にある。少し後ろ上方から全体を見渡す。
    this.watchPos = new THREE.Vector3(0, 8, -18);
    this.watchTarget = new THREE.Vector3(0, 0.5, 0);

    this.currentPos = this.overviewPos.clone();
    this.currentTarget = this.overviewTarget.clone();
    this.targetPos = this.overviewPos.clone();
    this.targetTarget = this.overviewTarget.clone();

    // Lerp速度
    this.posLerp = 0.04;
    this.targetLerp = 0.06;

    this._stickBody = null;
    // 棒がスキットル群のどのZ座標に近づいたら追跡をやめるか（スキットルZが概ね -7〜+7）
    this._followStopZ = -5;
  }

  /** 全体俯瞰に戻す */
  setOverview() {
    this.mode = 'OVERVIEW';
    this._stickBody = null;
    this.targetPos.copy(this.overviewPos);
    this.targetTarget.copy(this.overviewTarget);
    this.posLerp = 0.04;
    this.targetLerp = 0.06;
  }

  /**
   * 棒を追いかけるカメラ。
   * 着弾予測地点（landingPos）の少し手前に入ったら
   * 自動で OVERVIEW_LOCKED に切り替える。
   */
  setFollow(stickBody, landingPos = null) {
    this.mode = 'FOLLOW';
    this._stickBody = stickBody;
    this.posLerp = 0.07;
    this.targetLerp = 0.09;

    if (landingPos) {
      this._landingPos = landingPos;
      // 棒が着弾地点の少し手前に来たら観戦ロックに切り替える
      this._followStopZ = landingPos.z - 5;
    } else {
      this._landingPos = new THREE.Vector3(0, 0, 0);
      this._followStopZ = -5;
    }
  }

  /**
   * 狙った地点（着弾地点）全体が見える「観戦ロック」位置に切り替え。
   * 倒れる様子がよく見える少し引いた位置でスムーズに止まる。
   */
  setWatchLock() {
    this.mode = 'OVERVIEW_LOCKED';
    this._stickBody = null;

    const targetX = this._landingPos ? this._landingPos.x : 0;
    const targetZ = this._landingPos ? this._landingPos.z : 0;

    // 着弾地点（狙ったスキットル群）の少し後ろ上方から見渡す
    this.targetPos.set(targetX * 0.5, 8, targetZ - 18);
    this.targetTarget.set(targetX, 0.5, targetZ);

    this.posLerp = 0.05;
    this.targetLerp = 0.07;
  }

  /**
   * UFOアブダクション観戦用にカメラを引き、空のUFOと地面のスキットルが全体収まるアングルにする
   */
  setUFOFocus(targetPoint) {
    this.mode = 'UFO';
    this._stickBody = null;

    const tx = targetPoint ? targetPoint.x : 0;
    const tz = targetPoint ? targetPoint.z : 0;

    // 高い位置・遠い位置から全体（空のUFO＋地面）を俯瞰
    this.targetPos.set(tx * 0.4, 14, tz - 25);
    this.targetTarget.set(tx * 0.3, 3.0, tz);

    this.posLerp = 0.05;
    this.targetLerp = 0.06;
  }

  /**
   * 倒れたスキットル群をクローズアップ
   * @param {{ x, y, z }} focusPoint - 倒れたスキットルの平均位置
   */
  setImpact(focusPoint) {
    this.mode = 'IMPACT';
    this._stickBody = null;

    // focusPoint（スキットル群中心）を画角に収めつつ少し引いた斜め上から
    this.targetPos.set(
      focusPoint.x * 0.5,
      8,
      focusPoint.z - 14,
    );
    this.targetTarget.set(focusPoint.x * 0.3, 0.5, focusPoint.z * 0.5);
    this.posLerp = 0.045;
    this.targetLerp = 0.06;
  }

  update() {
    if (this.mode === 'FOLLOW' && this._stickBody) {
      const pos = this._stickBody.translation();

      // 棒がスキットル群の手前まで来たら観戦ロックに自動切替
      if (pos.z > this._followStopZ) {
        this.setWatchLock();
      } else {
        // 棒の後ろ上方を追跡（飛行中の臨場感）
        this.targetPos.set(
          pos.x * 0.25,
          Math.max(pos.y + 4, 6),
          pos.z - 10,
        );
        this.targetTarget.set(pos.x * 0.5, pos.y * 0.6, pos.z + 4);
      }
    }

    // スムーズ補間（全モード共通）
    this.currentPos.lerp(this.targetPos, this.posLerp);
    this.currentTarget.lerp(this.targetTarget, this.targetLerp);

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentTarget);
  }

  /** 即座にカメラ位置をセット（補間なし） */
  snapTo(pos, target) {
    this.currentPos.copy(pos);
    this.currentTarget.copy(target);
    this.targetPos.copy(pos);
    this.targetTarget.copy(target);
    this.camera.position.copy(pos);
    this.camera.lookAt(target);
  }

  resetToOverview() {
    this.setOverview();
    this.snapTo(this.overviewPos, this.overviewTarget);
  }
}
