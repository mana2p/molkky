import * as THREE from 'three';
import { SKITTLE_HALF_HEIGHT } from '../constants.js';

export const GAME_MODES = {
  NORMAL: 'NORMAL',
  BOMB: 'BOMB',
  UFO: 'UFO',
  CHAOS: 'CHAOS',
};

export const GAME_MODE_INFO = {
  [GAME_MODES.NORMAL]: { name: '🎯 通常モード', desc: '標準的なモルックルール' },
  [GAME_MODES.BOMB]: { name: '💣 TNT爆弾', desc: 'ランダムなターンに新しい場所へ爆弾が出現！' },
  [GAME_MODES.UFO]: { name: '🛸 UFOアブダクション', desc: 'UFOが吸い上げて倒れず安全に移送ドロップ' },
  [GAME_MODES.CHAOS]: { name: '💥 全載せカオス', desc: '爆弾とUFOが合体したカオスモード' },
};

export class GimmickManager {
  constructor(scene, world, RAPIER) {
    this.scene = scene;
    this.world = world;
    this.RAPIER = RAPIER;

    this.currentMode = GAME_MODES.NORMAL;

    // 爆弾
    this.bombGroup = null;
    this.bombPos = { x: -3.5, y: 0.7, z: -1.0 };
    this.bombExploded = false;
    this.particles = [];

    // UFO
    this.ufoGroup = null;
    this.ufoBeam = null;
    this.ufoAnimating = false;
  }

  setMode(mode) {
    this.currentMode = mode;
    this.cleanup();

    const isBomb = mode === GAME_MODES.BOMB || mode === GAME_MODES.CHAOS;
    const isUFO = mode === GAME_MODES.UFO || mode === GAME_MODES.CHAOS;

    if (isBomb) this._initBomb();
    if (isUFO) this._initUFO();
  }

  cleanup() {
    if (this.bombGroup) {
      this.scene.remove(this.bombGroup);
      this.bombGroup = null;
    }
    if (this.ufoGroup) {
      this.scene.remove(this.ufoGroup);
      this.ufoGroup = null;
    }
    this.particles.forEach(p => this.scene.remove(p.mesh));
    this.particles = [];
    this.bombExploded = false;
    this.ufoAnimating = false;
  }

  /** ターン開始時の処理（ランダムなターンで爆弾配置） */
  onTurnStart(turnNumber, skittles) {
    const isBomb = this.currentMode === GAME_MODES.BOMB || this.currentMode === GAME_MODES.CHAOS;
    if (isBomb) {
      if (this.bombCooldown === undefined) {
        this.bombCooldown = Math.floor(Math.random() * 3) + 3; // 3 to 5
      }
      
      this.bombCooldown--;
      if (this.bombCooldown <= 0 || !this.bombGroup) {
        this.spawnBombAtRandomPos(skittles);
        this.bombCooldown = Math.floor(Math.random() * 3) + 3; // Reset to 3-5
      }
    }
  }

  /** 爆弾をスキットルから離れたランダムな安全位置に出現 */
  spawnBombAtRandomPos(skittles) {
    this.bombExploded = false;
    if (this.bombGroup) this.bombGroup.visible = true;

    // スキットルが立っていない位置を抽選
    let rx = 0, rz = 0;
    for (let attempt = 0; attempt < 50; attempt++) {
      rx = (Math.random() - 0.5) * 8.0;
      rz = (Math.random() - 0.5) * 6.0 - 0.5;

      const safeFromAll = skittles.every(s => {
        if (!s.body) return true;
        const pos = s.body.translation();
        return Math.sqrt((pos.x - rx) ** 2 + (pos.z - rz) ** 2) > 2.8;
      });

      if (safeFromAll) break;
    }

    this.bombPos = { x: rx, y: 0.7, z: rz };
    if (this.bombGroup) {
      this.bombGroup.position.set(rx, 0.7, rz);
    }
    console.log(`[Gimmick] 💣 爆弾が位置 (${rx.toFixed(1)}, ${rz.toFixed(1)}) にセットされました！`);
  }

  // ===== 爆弾 =====
  _initBomb() {
    this.bombGroup = new THREE.Group();
    
    // 爆弾本体（黒い球）
    const bodyGeo = new THREE.SphereGeometry(0.7, 16, 16);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.3,
      metalness: 0.8
    });
    const bombBody = new THREE.Mesh(bodyGeo, bodyMat);
    this.bombGroup.add(bombBody);

    // 導火線
    const fuseGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8);
    const fuseMat = new THREE.MeshBasicMaterial({ color: 0x8b5a2b });
    const fuse = new THREE.Mesh(fuseGeo, fuseMat);
    fuse.position.set(0, 0.8, 0);
    this.bombGroup.add(fuse);

    // 点滅火花
    const sparkGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
    this.spark = new THREE.Mesh(sparkGeo, sparkMat);
    this.spark.position.set(0, 1.0, 0);
    this.bombGroup.add(this.spark);

    this.bombGroup.position.set(this.bombPos.x, this.bombPos.y, this.bombPos.z);
    this.scene.add(this.bombGroup);
    this.bombExploded = false;
  }

  // ===== UFO =====
  _initUFO() {
    this.ufoGroup = new THREE.Group();

    // UFO円盤
    const discGeo = new THREE.CylinderGeometry(2.5, 3.5, 0.6, 16);
    const discMat = new THREE.MeshPhongMaterial({
      color: 0xaaaaaa,    // ベースカラーは明るめのグレー
      specular: 0xffffff, // 光の反射（ハイライト）を真っ白に
      shininess: 100      // 鋭い反射で金属っぽく
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    this.ufoGroup.add(disc);

    // ドーム
    const domeGeo = new THREE.SphereGeometry(1.5, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.7,
      metalness: 0.1
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 0.3;
    this.ufoGroup.add(dome);

    // トラクタービーム光線
    const beamGeo = new THREE.CylinderGeometry(0.5, 2.5, 12, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    this.ufoBeam = new THREE.Mesh(beamGeo, beamMat);
    this.ufoBeam.position.y = -6;
    this.ufoBeam.visible = false;
    this.ufoGroup.add(this.ufoBeam);

    this.ufoGroup.position.set(0, 25, 0);
    this.scene.add(this.ufoGroup);
  }

  /** 毎フレーム更新 */
  update(stickBody, skittles) {
    // 爆弾の点滅 ＆ 衝突検知
    const isBomb = this.currentMode === GAME_MODES.BOMB || this.currentMode === GAME_MODES.CHAOS;
    if (isBomb && this.bombGroup && !this.bombExploded) {
      if (this.spark) {
        this.spark.scale.setScalar(0.8 + Math.sin(Date.now() * 0.02) * 0.4);
      }

      let triggerExplosion = false;
      if (stickBody) {
        const spos = stickBody.translation();
        const dist = Math.sqrt((spos.x - this.bombPos.x) ** 2 + (spos.z - this.bombPos.z) ** 2);
        if (dist < 1.3 && spos.y < 2.0) triggerExplosion = true;
      }
      for (const s of skittles) {
        if (!s.body) continue;
        const pos = s.body.translation();
        const dist = Math.sqrt((pos.x - this.bombPos.x) ** 2 + (pos.z - this.bombPos.z) ** 2);
        if (dist < 1.2 && pos.y < 2.0) triggerExplosion = true;
      }

      if (triggerExplosion) {
        this.triggerExplosion(skittles);
      }
    }

    this._updateParticles();
  }

  /** 爆発発動（威力を大幅に弱く調整し、フィールド内に収める） */
  triggerExplosion(skittles) {
    this.bombExploded = true;
    if (this.bombGroup) this.bombGroup.visible = false;

    console.log('[Gimmick] 💣 爆発発動！！');

    for (let i = 0; i < 35; i++) {
      const pGeo = new THREE.SphereGeometry(0.08 + Math.random() * 0.18, 8, 8);
      const pMat = new THREE.MeshBasicMaterial({
        color: Math.random() < 0.5 ? 0xff4400 : 0xffcc00
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.set(this.bombPos.x, this.bombPos.y, this.bombPos.z);
      this.scene.add(pMesh);

      const vx = (Math.random() - 0.5) * 8;
      const vy = Math.random() * 6 + 2;
      const vz = (Math.random() - 0.5) * 8;

      this.particles.push({ mesh: pMesh, vx, vy, vz, life: 1.0 });
    }

    // 周囲のスキットルをマイルドに押し飛ばす（画面外へ出さない）
    for (const s of skittles) {
      if (!s.body) continue;
      const pos = s.body.translation();
      const dx = pos.x - this.bombPos.x;
      const dz = pos.z - this.bombPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      const maxRadius = 5.5;
      if (dist < maxRadius) {
        const force = (maxRadius - dist) * 0.28; // 非常にマイルドな押し出し力
        const dirX = dist > 0.001 ? dx / dist : 0;
        const dirZ = dist > 0.001 ? dz / dist : 1;

        s.body.wakeUp();
        s.body.applyImpulse({
          x: dirX * force,
          y: force * 0.4 + 0.8, // ほんのり浮き上がる程度
          z: dirZ * force
        }, true);
      }
    }
  }

  _updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= 0.03;
      p.mesh.position.x += p.vx * 0.016;
      p.mesh.position.y += p.vy * 0.016;
      p.mesh.position.z += p.vz * 0.016;
      p.vy -= 9.8 * 0.016;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  /** UFOフル演出（飛来 → 吸い上げ → 空中移動 → 地面へ安全着陸ドロップ → 離脱） */
  triggerUFOAbduction(skittles, cameraController, onComplete) {
    const isUFO = this.currentMode === GAME_MODES.UFO || this.currentMode === GAME_MODES.CHAOS;
    if (!isUFO || !this.ufoGroup || this.ufoAnimating) {
      if (onComplete) onComplete();
      return;
    }

    const activeSkittles = skittles.filter(s => s.body);
    if (activeSkittles.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    this.ufoAnimating = true;

    // 「遠くに行きすぎた」スキットルを優先して選ぶ
    let targetSkittle = null;
    const DISTANCE_THRESHOLD_SQ = 15.0 * 15.0; // 15.0 (1.5m) 以上を「遠すぎる」と判定
    
    // 原点からの距離の降順でソート
    const sortedSkittles = [...activeSkittles].sort((a, b) => {
      const pa = a.body.translation();
      const pb = b.body.translation();
      return (pb.x * pb.x + pb.z * pb.z) - (pa.x * pa.x + pa.z * pa.z);
    });

    const furthest = sortedSkittles[0];
    const fPos = furthest.body.translation();
    const furthestDistSq = fPos.x * fPos.x + fPos.z * fPos.z;

    if (furthestDistSq > DISTANCE_THRESHOLD_SQ) {
      targetSkittle = furthest;
      console.log(`[Gimmick] 🛸 遠すぎスキットル発見！(距離: ${Math.sqrt(furthestDistSq).toFixed(1)}) -> 優先して回収します`);
    } else {
      // 遠すぎるものがなければランダム
      targetSkittle = activeSkittles[Math.floor(Math.random() * activeSkittles.length)];
    }

    const targetPos = targetSkittle.body.translation();

    // 再配置先の安全なランダム座標を探す（他のスキットルと重なって倒さないようにする）
    let newX = 0, newZ = 0;
    for (let attempt = 0; attempt < 30; attempt++) {
      newX = (Math.random() - 0.5) * 8.0;
      newZ = (Math.random() - 0.5) * 5.0 - 0.5;
      
      const isSafe = activeSkittles.every(s => {
        if (s === targetSkittle || !s.body) return true;
        const pos = s.body.translation();
        // 密集地帯を避けるための安全距離 (1.8 = 0.18m)
        return Math.sqrt((pos.x - newX) ** 2 + (pos.z - newZ) ** 2) > 1.8;
      });
      
      if (isSafe) break;
    }

    console.log(`[Gimmick] 🛸 UFOが ${targetSkittle.number}番 スキットルを移送中...`);

    // 1. カメラを引いてワイドフォーカス
    if (cameraController) {
      cameraController.setUFOFocus(targetPos);
    }

    const hoverY = 7.0;
    const groundY = SKITTLE_HALF_HEIGHT; // 地面ピッタリの高さ (0.75m)

    // シーケンス1: UFOが空からターゲット直上へ降り立つ
    let arrivalProgress = 0;
    const animateArrival = () => {
      arrivalProgress += 0.03;
      if (arrivalProgress >= 1.0) {
        this.ufoBeam.visible = true;
        // 吸い上げ中の物理演算干渉を防ぐためキネマティックにする
        targetSkittle.body.setBodyType(this.RAPIER.RigidBodyType.KinematicPositionBased, true);
        setTimeout(animateLift, 250);
        return;
      }
      this.ufoGroup.position.x = targetPos.x * arrivalProgress;
      this.ufoGroup.position.y = 25 - (25 - hoverY) * arrivalProgress;
      this.ufoGroup.position.z = targetPos.z * arrivalProgress;
      requestAnimationFrame(animateArrival);
    };

    // シーケンス2: ビームでスキットルをUFOへ吸い上げる
    const animateLift = () => {
      let liftProgress = 0;
      const startSkittleY = targetPos.y;
      const targetSkittleY = hoverY - 1.2;

      const lift = () => {
        liftProgress += 0.04; // requestAnimationFrame ベースで約25フレーム (約0.4秒)
        const currentY = startSkittleY + (targetSkittleY - startSkittleY) * Math.min(1.0, liftProgress);

        targetSkittle.body.setTranslation({
          x: targetPos.x,
          y: currentY,
          z: targetPos.z
        }, true);

        if (liftProgress >= 1.0) {
          setTimeout(animateFlyToNewPos, 200);
          return;
        }
        requestAnimationFrame(lift);
      };
      lift();
    };

    // シーケンス3: UFOがスキットルを連れて新位置の上空へ水平移動
    const animateFlyToNewPos = () => {
      let flyProgress = 0;
      const startX = this.ufoGroup.position.x;
      const startZ = this.ufoGroup.position.z;

      const fly = () => {
        flyProgress += 0.03;
        if (flyProgress >= 1.0) {
          this.ufoGroup.position.x = newX;
          this.ufoGroup.position.z = newZ;
          targetSkittle.body.setTranslation({ x: newX, y: hoverY - 1.2, z: newZ }, true);
          setTimeout(animateDropDown, 200);
          return;
        }

        const currX = startX + (newX - startX) * flyProgress;
        const currZ = startZ + (newZ - startZ) * flyProgress;

        this.ufoGroup.position.x = currX;
        this.ufoGroup.position.z = currZ;

        targetSkittle.body.setTranslation({
          x: currX,
          y: hoverY - 1.2,
          z: currZ
        }, true);

        if (cameraController) {
          cameraController.setUFOFocus({ x: currX, z: currZ });
        }

        requestAnimationFrame(fly);
      };
      fly();
    };

    // シーケンス4: ビームでスキットルを地面（正確な高さ groundY = 0.75m）へ安全に着陸降下
    const animateDropDown = () => {
      let dropProgress = 0;
      const startSkittleY = hoverY - 1.2;

      const drop = () => {
        dropProgress += 0.04;
        const currentY = startSkittleY + (groundY - startSkittleY) * Math.min(1.0, dropProgress);

        targetSkittle.body.setTranslation({
          x: newX,
          y: currentY,
          z: newZ
        }, true);

        if (dropProgress >= 1.0) {
          // 正確な接地座標にセットし、ダイナミックボディに戻して物理スリープ
          targetSkittle.body.setTranslation({ x: newX, y: groundY, z: newZ }, true);
          targetSkittle.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
          targetSkittle.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          targetSkittle.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
          
          targetSkittle.body.setBodyType(this.RAPIER.RigidBodyType.Dynamic, true);
          targetSkittle.body.sleep();

          this.ufoBeam.visible = false;
          setTimeout(animateLeave, 350);
          return;
        }
        requestAnimationFrame(drop);
      };
      drop();
    };

    // シーケンス5: UFOが去り、カメラが俯瞰に戻る
    const animateLeave = () => {
      let leaveProgress = 0;
      const startX = this.ufoGroup.position.x;
      const startZ = this.ufoGroup.position.z;

      const leave = () => {
        leaveProgress += 0.04;
        if (leaveProgress >= 1.0) {
          this.ufoGroup.position.set(0, 25, 0);
          this.ufoAnimating = false;
          if (cameraController) {
            cameraController.setOverview();
          }
          if (onComplete) onComplete();
          return;
        }
        this.ufoGroup.position.y = hoverY + leaveProgress * 20;
        this.ufoGroup.position.x = startX + leaveProgress * 30;
        requestAnimationFrame(leave);
      };
      leave();
    };

    animateArrival();
  }
}



