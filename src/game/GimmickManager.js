import * as THREE from 'three';

export const GAME_MODES = {
  NORMAL: 'NORMAL',
  CONVEYOR: 'CONVEYOR',
  TRAMPOLINE: 'TRAMPOLINE',
  BOMB: 'BOMB',
  UFO: 'UFO',
  CHAOS: 'CHAOS',
};

export const GAME_MODE_INFO = {
  [GAME_MODES.NORMAL]: { name: '🎯 通常モード', desc: '標準的なモルックルール' },
  [GAME_MODES.CONVEYOR]: { name: '🛞 ベルトコンベア', desc: '床が自動移動！スキットルが流れる' },
  [GAME_MODES.TRAMPOLINE]: { name: '🎪 トランポリン', desc: '床が超高反発！月面大ジャンプ' },
  [GAME_MODES.BOMB]: { name: '💣 TNT爆弾', desc: '爆弾に当てると大爆発して吹っ飛ぶ！' },
  [GAME_MODES.UFO]: { name: '🛸 UFOアブダクション', desc: 'UFOが突然現れてスキットルを連れ去る' },
  [GAME_MODES.CHAOS]: { name: '💥 全載せカオス', desc: 'すべてのギミックが同時に発動する狂気' },
};

export class GimmickManager {
  constructor(scene, world, RAPIER) {
    this.scene = scene;
    this.world = world;
    this.RAPIER = RAPIER;

    this.currentMode = GAME_MODES.NORMAL;
    
    // コンベア
    this.conveyorMesh = null;
    this.conveyorSpeed = 0.05;

    // 爆弾
    this.bombGroup = null;
    this.bombPos = { x: 0, y: 0.5, z: 0 };
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
    const isTrampoline = mode === GAME_MODES.TRAMPOLINE || mode === GAME_MODES.CHAOS;
    const isBomb = mode === GAME_MODES.BOMB || mode === GAME_MODES.CHAOS;
    const isUFO = mode === GAME_MODES.UFO || mode === GAME_MODES.CHAOS;

    if (isConveyor) this._initConveyor();
    if (isTrampoline) this._initTrampoline();
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

  // ===== コンベア =====
  _initConveyor() {
    this.conveyorGroup = new THREE.Group();
    this.conveyorMeshes = [];

    // 4つの循環コンベアベルトの定義（時計回りに循環して絶対に画面外に出ない）
    this.conveyors = [
      { // 1. 奥（右行き +X）
        x: 0, z: -5.5, w: 13, l: 2.5, dirX: 1, dirZ: 0,
        minX: -6.5, maxX: 6.5, minZ: -6.75, maxZ: -4.25, rot: 0
      },
      { // 2. 右（手前行き +Z）
        x: 5.5, z: -1.0, w: 2.5, l: 11.5, dirX: 0, dirZ: 1,
        minX: 4.25, maxX: 6.75, minZ: -6.75, maxZ: 4.75, rot: Math.PI / 2
      },
      { // 3. 手前（左行き -X）
        x: 0, z: 3.5, w: 13, l: 2.5, dirX: -1, dirZ: 0,
        minX: -6.5, maxX: 6.5, minZ: 2.25, maxZ: 4.75, rot: Math.PI
      },
      { // 4. 左（奥行き -Z）
        x: -5.5, z: -1.0, w: 2.5, l: 11.5, dirX: 0, dirZ: -1,
        minX: -6.75, maxX: -4.25, minZ: -6.75, maxZ: 4.75, rot: -Math.PI / 2
      }
    ];

    for (const c of this.conveyors) {
      const geo = new THREE.PlaneGeometry(c.w, c.l);
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      
      // 暗い工業用ベルト
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, 256, 256);
      
      // 移動方向の矢印マーク
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

  // ===== トランポリン =====
  _initTrampoline() {
    // 地面コライダーの反発力を一時的に最大化
    this.world.forEachCollider(collider => {
      if (collider.halfExtents && collider.halfExtents().x > 20) {
        collider.setRestitution(0.92);
      }
    });
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

    // 爆弾の配置場所（スキットル群の真ん中前あたり）
    this.bombPos = { x: 0, y: 0.7, z: -1.5 };
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
    // コンベアの移動処理（超ゆっくり ＆ 多方向循環 ＆ 倒れ防止）
    const isConveyor = this.currentMode === GAME_MODES.CONVEYOR || this.currentMode === GAME_MODES.CHAOS;
    if (isConveyor && this.conveyorMeshes && this.conveyors) {
      // ベルトのアニメーション
      for (const mesh of this.conveyorMeshes) {
        if (mesh.material.map) {
          mesh.material.map.offset.y -= 0.003; // かなりゆっくり
        }
      }

      const moveSpeed = 0.003; // かなりゆっくり搬送

      for (const s of skittles) {
        if (!s.body) continue;
        const pos = s.body.translation();

        // 4本のコンベアのどれの上にあるか判定
        for (const c of this.conveyors) {
          if (pos.x >= c.minX && pos.x <= c.maxX && pos.z >= c.minZ && pos.z <= c.maxZ) {
            s.body.wakeUp();

            // スキットルが立っている状態（upY > 0.6）なら、移動のせいで倒れないように回転（X・Z角速度）を抑制する
            const rot = s.body.rotation();
            const upY = 1 - 2 * (rot.x * rot.x + rot.z * rot.z);
            if (upY > 0.6) {
              const ang = s.body.angvel();
              s.body.setAngvel({ x: 0, y: ang.y * 0.8, z: 0 }, true);
            }

            // 超ゆっくり力を加える
            s.body.applyImpulse({
              x: c.dirX * moveSpeed,
              y: 0,
              z: c.dirZ * moveSpeed
            }, true);

            break;
          }
        }
      }

      if (stickBody) {
        const spos = stickBody.translation();
        for (const c of this.conveyors) {
          if (spos.x >= c.minX && spos.x <= c.maxX && spos.z >= c.minZ && spos.z <= c.maxZ) {
            stickBody.applyImpulse({
              x: c.dirX * moveSpeed * 1.5,
              y: 0,
              z: c.dirZ * moveSpeed * 1.5
            }, true);
            break;
          }
        }
      }
    }

    // 爆弾の火花点滅 ＆ 衝突爆発判定
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

  /** UFO連れ去りイベント */
  triggerUFOAbduction(skittles, onComplete) {
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

    console.log(`[Gimmick] 🛸 UFOが ${targetSkittle.number}番 スキットルを連れ去りに飛来！`);

    let progress = 0;
    const hoverY = 7;

    const animateArrival = () => {
      progress += 0.03;
      if (progress >= 1.0) {
        this.ufoBeam.visible = true;
        setTimeout(animateAbduct, 500);
        return;
      }
      this.ufoGroup.position.x = targetPos.x * progress;
      this.ufoGroup.position.y = 25 - (25 - hoverY) * progress;
      this.ufoGroup.position.z = targetPos.z * progress;
      requestAnimationFrame(animateArrival);
    };

    const animateAbduct = () => {
      let lift = 0;
      const liftInterval = setInterval(() => {
        lift += 0.2;
        targetSkittle.body.setTranslation({
          x: targetPos.x,
          y: targetPos.y + lift,
          z: targetPos.z
        }, true);

        if (lift >= 5.0) {
          clearInterval(liftInterval);
          const newX = (Math.random() - 0.5) * 16;
          const newZ = (Math.random() - 0.5) * 10 - 2;
          targetSkittle.body.setTranslation({ x: newX, y: 0.5, z: newZ }, true);
          targetSkittle.body.wakeUp();

          this.ufoBeam.visible = false;
          animateLeave();
        }
      }, 30);
    };

    const animateLeave = () => {
      let leaveProgress = 0;
      const startX = this.ufoGroup.position.x;
      const startZ = this.ufoGroup.position.z;

      const leave = () => {
        leaveProgress += 0.04;
        if (leaveProgress >= 1.0) {
          this.ufoGroup.position.set(0, 25, 0);
          this.ufoAnimating = false;
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
