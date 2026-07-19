import * as THREE from 'three';

export const GAME_MODES = {
  NORMAL: 'NORMAL',
  CONVEYOR: 'CONVEYOR',
  BOMB: 'BOMB',
  UFO: 'UFO',
  CHAOS: 'CHAOS',
};

export const GAME_MODE_INFO = {
  [GAME_MODES.NORMAL]: { name: '🎯 通常モード', desc: '標準的なモルックルール' },
  [GAME_MODES.CONVEYOR]: { name: '🛞 コンベア迷宮', desc: 'スキットルの足元で多方向ベルトが交差動作' },
  [GAME_MODES.BOMB]: { name: '💣 TNT爆弾', desc: '3ターンごとに新しい場所に爆弾が出現！' },
  [GAME_MODES.UFO]: { name: '🛸 UFOアブダクション', desc: 'UFOが吸い上げて別の場所へ移送ドロップ' },
  [GAME_MODES.CHAOS]: { name: '💥 全載せカオス', desc: 'すべてのギミックが合体したカオス' },
};

export class GimmickManager {
  constructor(scene, world, RAPIER) {
    this.scene = scene;
    this.world = world;
    this.RAPIER = RAPIER;

    this.currentMode = GAME_MODES.NORMAL;
    
    // コンベア
    this.conveyorGroup = null;
    this.conveyorMeshes = [];

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

    const isConveyor = mode === GAME_MODES.CONVEYOR || mode === GAME_MODES.CHAOS;
    const isBomb = mode === GAME_MODES.BOMB || mode === GAME_MODES.CHAOS;
    const isUFO = mode === GAME_MODES.UFO || mode === GAME_MODES.CHAOS;

    if (isConveyor) this._initConveyor();
    if (isBomb) this._initBomb();
    if (isUFO) this._initUFO();
  }

  cleanup() {
    if (this.conveyorGroup) {
      this.scene.remove(this.conveyorGroup);
      this.conveyorGroup = null;
      this.conveyorMeshes = [];
    }
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

  /** ターン開始時の処理（3ターンに1回の爆弾配置など） */
  onTurnStart(turnNumber, skittles) {
    const isBomb = this.currentMode === GAME_MODES.BOMB || this.currentMode === GAME_MODES.CHAOS;
    if (isBomb) {
      // 3ターンに1回（1, 4, 7, 10... ターン）新しい場所に爆弾を配置・再装填
      if (turnNumber % 3 === 1 || !this.bombGroup || this.bombExploded) {
        this.spawnBombAtRandomPos(skittles);
      }
    }
  }

  /** 爆弾をスキットルから離れたランダムな安全位置に出現 */
  spawnBombAtRandomPos(skittles) {
    this.bombExploded = false;
    if (this.bombGroup) this.bombGroup.visible = true;

    // スキットルが立っていない位置を抽選
    let rx = 0, rz = 0;
    for (let attempt = 0; attempt < 20; attempt++) {
      rx = (Math.random() - 0.5) * 8.0;
      rz = (Math.random() - 0.5) * 6.0 - 0.5;

      const safeFromAll = skittles.every(s => {
        if (!s.body) return true;
        const pos = s.body.translation();
        return Math.sqrt((pos.x - rx) ** 2 + (pos.z - rz) ** 2) > 1.8;
      });

      if (safeFromAll) break;
    }

    this.bombPos = { x: rx, y: 0.7, z: rz };
    if (this.bombGroup) {
      this.bombGroup.position.set(rx, 0.7, rz);
    }
    console.log(`[Gimmick] 💣 爆弾が位置 (${rx.toFixed(1)}, ${rz.toFixed(1)}) にセットされました！`);
  }

  // ===== コンベア =====
  _initConveyor() {
    this.conveyorGroup = new THREE.Group();
    this.conveyorMeshes = [];

    // スキットル初期位置（Z: -2〜+3, X: -3〜+3）を網羅する複雑な交差コンベア網
    this.conveyors = [
      { // 1. 中央縦ライン（手前行き +Z）
        x: 0, z: -0.5, w: 2.2, l: 8.5, dirX: 0, dirZ: 1,
        minX: -1.1, maxX: 1.1, minZ: -4.75, maxZ: 3.75, rot: Math.PI / 2
      },
      { // 2. 中央横ライン（右行き +X）
        x: 0, z: -1.0, w: 9.0, l: 2.2, dirX: 1, dirZ: 0,
        minX: -4.5, maxX: 4.5, minZ: -2.1, maxZ: 0.1, rot: 0
      },
      { // 3. 奥側横ライン（左行き -X）
        x: 0, z: -3.2, w: 9.0, l: 2.2, dirX: -1, dirZ: 0,
        minX: -4.5, maxX: 4.5, minZ: -4.3, maxZ: -2.1, rot: Math.PI
      },
      { // 4. 手前横ライン（右行き +X）
        x: 0, z: 1.5, w: 9.0, l: 2.2, dirX: 1, dirZ: 0,
        minX: -4.5, maxX: 4.5, minZ: 0.4, maxZ: 2.6, rot: 0
      },
      { // 5. 左側縦ライン（奥行き -Z）
        x: -3.5, z: -0.5, w: 2.2, l: 8.5, dirX: 0, dirZ: -1,
        minX: -4.6, maxX: -2.4, minZ: -4.75, maxZ: 3.75, rot: -Math.PI / 2
      },
      { // 6. 右側縦ライン（手前行き +Z）
        x: 3.5, z: -0.5, w: 2.2, l: 8.5, dirX: 0, dirZ: 1,
        minX: 2.4, maxX: 4.6, minZ: -4.75, maxZ: 3.75, rot: Math.PI / 2
      }
    ];

    for (const c of this.conveyors) {
      const geo = new THREE.PlaneGeometry(c.w, c.l);
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, 256, 256);
      
      // 黄色矢印マーク
      ctx.fillStyle = '#ffcc00';
      for (let y = 32; y < 256; y += 64) {
        ctx.beginPath();
        ctx.moveTo(128, y - 16);
        ctx.lineTo(176, y + 16);
        ctx.lineTo(152, y + 16);
        ctx.lineTo(152, y + 32);
        ctx.lineTo(104, y + 32);
        ctx.lineTo(104, y + 16);
        ctx.lineTo(80, y + 16);
        ctx.closePath();
        ctx.fill();
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(Math.ceil(c.w / 2), Math.ceil(c.l / 2));

      const mat = new THREE.MeshLambertMaterial({
        map: texture,
        side: THREE.DoubleSide
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = c.rot;
      mesh.position.set(c.x, 0.02, c.z);
      this.conveyorGroup.add(mesh);
      this.conveyorMeshes.push(mesh);
    }

    this.scene.add(this.conveyorGroup);
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
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x778899,
      metalness: 0.9,
      roughness: 0.2
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

    this.ufoGroup.position.set(0, 25, 0); // 上空に待機
    this.scene.add(this.ufoGroup);
  }

  /** 毎フレーム更新 */
  update(stickBody, skittles) {
    // コンベア移動（確実な速度 setLinvel + 正立補正で絶対に倒れない）
    const isConveyor = this.currentMode === GAME_MODES.CONVEYOR || this.currentMode === GAME_MODES.CHAOS;
    if (isConveyor && this.conveyorMeshes && this.conveyors) {
      for (const mesh of this.conveyorMeshes) {
        if (mesh.material.map) {
          mesh.material.map.offset.y -= 0.008;
        }
      }

      const beltSpeed = 0.45; // スムーズかつ目に見えてはっきり動く速度

      for (const s of skittles) {
        if (!s.body) continue;
        const pos = s.body.translation();

        for (const c of this.conveyors) {
          if (pos.x >= c.minX && pos.x <= c.maxX && pos.z >= c.minZ && pos.z <= c.maxZ) {
            s.body.wakeUp();

            const rot = s.body.rotation();
            const upY = 1 - 2 * (rot.x * rot.x + rot.z * rot.z);

            // 立っているスキットル（upY > 0.6）は傾き（x, z）を0にリセットして倒れないように平行に流す！
            if (upY > 0.6) {
              s.body.setRotation({ x: 0, y: rot.y, z: 0, w: rot.w }, true);
              s.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
            }

            // 物理エンジン上で安定して滑らかに移動する速度をセット
            const currentLinvel = s.body.linvel();
            s.body.setLinvel({
              x: c.dirX * beltSpeed,
              y: currentLinvel.y,
              z: c.dirZ * beltSpeed
            }, true);

            break;
          }
        }
      }

      if (stickBody) {
        const spos = stickBody.translation();
        for (const c of this.conveyors) {
          if (spos.x >= c.minX && spos.x <= c.maxX && spos.z >= c.minZ && spos.z <= c.maxZ) {
            const currentLinvel = stickBody.linvel();
            stickBody.setLinvel({
              x: c.dirX * beltSpeed,
              y: currentLinvel.y,
              z: c.dirZ * beltSpeed
            }, true);
            break;
          }
        }
      }
    }

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

  /** 爆発発動 */
  triggerExplosion(skittles) {
    this.bombExploded = true;
    if (this.bombGroup) this.bombGroup.visible = false;

    console.log('[Gimmick] 💣 爆発発動！！');

    for (let i = 0; i < 40; i++) {
      const pGeo = new THREE.SphereGeometry(0.1 + Math.random() * 0.25, 8, 8);
      const pMat = new THREE.MeshBasicMaterial({
        color: Math.random() < 0.5 ? 0xff4400 : 0xffcc00
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.set(this.bombPos.x, this.bombPos.y, this.bombPos.z);
      this.scene.add(pMesh);

      const vx = (Math.random() - 0.5) * 15;
      const vy = Math.random() * 12 + 4;
      const vz = (Math.random() - 0.5) * 15;

      this.particles.push({ mesh: pMesh, vx, vy, vz, life: 1.0 });
    }

    for (const s of skittles) {
      if (!s.body) continue;
      const pos = s.body.translation();
      const dx = pos.x - this.bombPos.x;
      const dz = pos.z - this.bombPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 8.0) {
        const force = (8.0 - dist) * 2.5;
        const dirX = dist > 0.001 ? dx / dist : 0;
        const dirZ = dist > 0.001 ? dz / dist : 1;

        s.body.wakeUp();
        s.body.applyImpulse({
          x: dirX * force,
          y: force * 1.5 + 5.0,
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

  /** UFOフル演出（飛来 → ビーム吸い上げ → 空中移動 → 新位置へドロップ着陸 → 離脱） */
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
    const targetSkittle = activeSkittles[Math.floor(Math.random() * activeSkittles.length)];
    const targetPos = targetSkittle.body.translation();

    // 再配置先のランダム座標
    const newX = (Math.random() - 0.5) * 10.0;
    const newZ = (Math.random() - 0.5) * 5.0 - 0.5;

    console.log(`[Gimmick] 🛸 UFOが ${targetSkittle.number}番 スキットルを吸い上げて (${newX.toFixed(1)}, ${newZ.toFixed(1)}) へ移送中！`);

    // 1. カメラを引いて全体が見えるアングルへ
    if (cameraController) {
      cameraController.setUFOFocus(targetPos);
    }

    const hoverY = 7;
    let arrivalProgress = 0;

    // ステップ1: UFOが空からターゲット直上へ降り立つ
    const animateArrival = () => {
      arrivalProgress += 0.03;
      if (arrivalProgress >= 1.0) {
        this.ufoBeam.visible = true;
        setTimeout(animateLift, 300);
        return;
      }
      this.ufoGroup.position.x = targetPos.x * arrivalProgress;
      this.ufoGroup.position.y = 25 - (25 - hoverY) * arrivalProgress;
      this.ufoGroup.position.z = targetPos.z * arrivalProgress;
      requestAnimationFrame(animateArrival);
    };

    // ステップ2: ビームでスキットルをUFOドーム内へ吸い上げる
    const animateLift = () => {
      let lift = 0;
      const liftInterval = setInterval(() => {
        lift += 0.25;
        targetSkittle.body.setTranslation({
          x: targetPos.x,
          y: targetPos.y + lift,
          z: targetPos.z
        }, true);

        if (lift >= 5.5) {
          clearInterval(liftInterval);
          // ステップ3: UFOがスキットルを載せたまま新しいドロップ地点へ上空移動！
          animateFlyToNewPos();
        }
      }, 30);
    };

    // ステップ3: スキットルを連れたままUFOが空中を移動
    const animateFlyToNewPos = () => {
      let flyProgress = 0;
      const startX = this.ufoGroup.position.x;
      const startZ = this.ufoGroup.position.z;

      const fly = () => {
        flyProgress += 0.025;
        if (flyProgress >= 1.0) {
          // 移動完了 -> ドロップ降下開始
          setTimeout(animateDropDown, 300);
          return;
        }

        const currX = startX + (newX - startX) * flyProgress;
        const currZ = startZ + (newZ - startZ) * flyProgress;

        this.ufoGroup.position.x = currX;
        this.ufoGroup.position.z = currZ;

        // スキットルもUFOの移動に合わせて空中追従
        targetSkittle.body.setTranslation({
          x: currX,
          y: hoverY - 1.0,
          z: currZ
        }, true);

        if (cameraController) {
          cameraController.setUFOFocus({ x: currX, z: currZ });
        }

        requestAnimationFrame(fly);
      };
      fly();
    };

    // ステップ4: トラクタービームで地面へゆっくり安全に降ろす（ドロップ）
    const animateDropDown = () => {
      let dropY = hoverY - 1.0;
      const dropInterval = setInterval(() => {
        dropY -= 0.25;
        targetSkittle.body.setTranslation({
          x: newX,
          y: Math.max(0.5, dropY),
          z: newZ
        }, true);

        if (dropY <= 0.5) {
          clearInterval(dropInterval);
          targetSkittle.body.setTranslation({ x: newX, y: 0.5, z: newZ }, true);
          targetSkittle.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
          targetSkittle.body.wakeUp();

          this.ufoBeam.visible = false;
          setTimeout(animateLeave, 400);
        }
      }, 30);
    };

    // ステップ5: UFOが空へ去り、カメラが戻る
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


