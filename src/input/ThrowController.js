import {
  SLINGSHOT_MAX_PULL,
  SLINGSHOT_DEAD_ZONE,
  THROW_MIN_POWER,
  THROW_MAX_POWER,
  THROW_Y_FACTOR,
  THROW_Z_FACTOR,
  THROW_X_FACTOR,
} from '../constants.js';

/**
 * パチンコ（スリングショット）式投げコントローラー
 *
 * 操作:
 *   ポインタダウン → 構え（エイミング開始）
 *   ドラッグで引く → パワー＆方向決定（引いた方向の逆に飛ぶ）
 *   リリース → 投擲
 *
 * 画面下方向に引く → 前方（スキットル方向 +Z）へ飛ぶ
 * 画面左に引く   → 右方向（+X）へ飛ぶ（スリングショットの原理）
 */
export class ThrowController {
  constructor(domElement) {
    this.domElement = domElement;
    this.isAiming = false;
    this.canThrow = true;
    this.startPos = null;
    this.currentPos = null;
    this._pendingThrow = null;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);

    domElement.addEventListener('pointerdown', this._onPointerDown);
    domElement.addEventListener('pointermove', this._onPointerMove);
    domElement.addEventListener('pointerup', this._onPointerUp);
    domElement.addEventListener('pointercancel', this._onPointerUp);

    // タッチデバイスのスクロール・ズームを防止
    domElement.style.touchAction = 'none';
  }

  /** マウス/タッチ座標をNDC (-1〜+1) に変換 */
  _toNDC(e) {
    const rect = this.domElement.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
    };
  }

  _onPointerDown(e) {
    if (!this.canThrow) return;
    this.isAiming = true;
    this.startPos = this._toNDC(e);
    this.currentPos = { ...this.startPos };
    this.domElement.setPointerCapture(e.pointerId);
  }

  _onPointerMove(e) {
    if (!this.isAiming) return;
    this.currentPos = this._toNDC(e);
  }

  _onPointerUp(e) {
    if (!this.isAiming) return;
    // isAiming を false にする前に throw を計算する（getPullVector が isAiming を参照するため）
    this._pendingThrow = this._calculateThrow();
    this.isAiming = false;
    this.startPos = null;
    this.currentPos = null;
  }

  /**
   * 引き戻しベクトル（start - current）を返す
   * スリングショットの原理: 引いた方向＝発射方向
   */
  getPullVector() {
    if (!this.isAiming || !this.startPos || !this.currentPos) return null;
    return {
      x: this.startPos.x - this.currentPos.x,
      y: this.startPos.y - this.currentPos.y,
    };
  }

  /**
   * 現在の引き戻し情報を返す（エイムガイド用）
   * @returns {{ dx, dy, distance, power, dirX, dirZ, throwVec }} | null
   */
  getPullInfo() {
    const pull = this.getPullVector();
    if (!pull) return null;

    const distance = Math.sqrt(pull.x * pull.x + pull.y * pull.y);
    if (distance < SLINGSHOT_DEAD_ZONE) return null;

    const normalizedPower = Math.min(distance / SLINGSHOT_MAX_PULL, 1.0);
    const power = THROW_MIN_POWER + normalizedPower * (THROW_MAX_POWER - THROW_MIN_POWER);
    const dirX = pull.x / distance;
    const dirY = pull.y / distance;

    return {
      dx: pull.x,
      dy: pull.y,
      distance,
      power: normalizedPower,
      rawPower: power,
      dirX,
      dirZ: dirY,
      throwVec: {
        x: dirX * power * THROW_X_FACTOR,
        y: power * THROW_Y_FACTOR,
        z: dirY * power * THROW_Z_FACTOR,
      },
    };
  }

  /** リリース時の投擲ベクトルを計算 */
  _calculateThrow() {
    const info = this.getPullInfo();
    if (!info) return null;
    return info.throwVec;
  }

  /** ゲームループから呼ばれる。pending throwがあれば返す */
  update() {
    const throwVec = this._pendingThrow;
    this._pendingThrow = null;
    return throwVec;
  }

  setCanThrow(canThrow) {
    this.canThrow = canThrow;
    this.domElement.style.cursor = canThrow ? 'crosshair' : 'default';
  }

  dispose() {
    this.domElement.removeEventListener('pointerdown', this._onPointerDown);
    this.domElement.removeEventListener('pointermove', this._onPointerMove);
    this.domElement.removeEventListener('pointerup', this._onPointerUp);
    this.domElement.removeEventListener('pointercancel', this._onPointerUp);
  }
}
