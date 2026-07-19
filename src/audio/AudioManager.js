import hitUrl from '../mp3/hit.mp3';
import bombUrl from '../mp3/bomb.mp3';
import ufoUrl from '../mp3/ufo.mp3';
import bgmUrl from '../mp3/bgm.mp3';

class AudioManager {
  constructor() {
    this.bgm = new Audio(bgmUrl);
    this.bgm.loop = true;
    this.bgm.volume = 0.25;

    this.hitUrl = hitUrl;
    this.bombUrl = bombUrl;
    this.ufoUrl = ufoUrl;

    this.isMuted = false;
    this.hasInteracted = false;

    // hit音用のプール（連続再生用）
    this.hitPool = Array.from({ length: 6 }, () => new Audio(hitUrl));
    this.hitPoolIndex = 0;
    this.lastHitTime = 0;
  }

  // 初回のユーザー操作でBGM再生をアンロック
  initOnFirstInteraction() {
    if (this.hasInteracted) return;
    this.hasInteracted = true;
    this.playBGM();
  }

  playBGM() {
    if (this.isMuted) return;
    this.bgm.play().catch(() => {
      // 自動再生制限の例外をキャッチ
    });
  }

  stopBGM() {
    this.bgm.pause();
    this.bgm.currentTime = 0;
  }

  playHit(volume = 1.0) {
    if (this.isMuted) return;
    const now = Date.now();
    if (now - this.lastHitTime < 40) return; // 連続再生制限
    this.lastHitTime = now;

    const sound = this.hitPool[this.hitPoolIndex];
    this.hitPoolIndex = (this.hitPoolIndex + 1) % this.hitPool.length;
    sound.currentTime = 0;
    sound.volume = Math.min(1.0, Math.max(0.1, volume));
    sound.play().catch(() => {});
  }

  playBomb() {
    if (this.isMuted) return;
    const bombSound = new Audio(this.bombUrl);
    bombSound.volume = 0.8;
    bombSound.play().catch(() => {});
  }

  playUFO() {
    if (this.isMuted) return;
    const ufoSound = new Audio(this.ufoUrl);
    ufoSound.volume = 0.7;
    ufoSound.play().catch(() => {});
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.bgm.pause();
    } else {
      this.playBGM();
    }
    return this.isMuted;
  }
}

export const audioManager = new AudioManager();
