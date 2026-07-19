// ===== スケール =====
// 実寸(メートル)だと3Dシーンで小さすぎるのでスケーリング
const SCALE = 10;

// ===== 物理定数 =====
export const GRAVITY = { x: 0, y: -9.81, z: 0 };
export const PHYSICS_TIMESTEP = 1 / 60;

// ===== スキットル寸法 =====
export const SKITTLE_RADIUS = 0.0275 * SCALE;
export const SKITTLE_HEIGHT = 0.15 * SCALE;
export const SKITTLE_HALF_HEIGHT = 0.075 * SCALE;

// ===== モルック棒寸法 =====
export const STICK_RADIUS = 0.0275 * SCALE;
export const STICK_LENGTH = 0.225 * SCALE;
export const STICK_HALF_LENGTH = 0.1125 * SCALE;

// ===== 投擲（パチンコ式） =====
export const THROW_DISTANCE = 3.5 * SCALE;
export const THROW_HEIGHT = 0.12 * SCALE;

/** パチンコ引き戻しの最大距離（NDC単位） */
export const SLINGSHOT_MAX_PULL = 1.0;
/** パチンコのデッドゾーン（これ以下は無視） */
export const SLINGSHOT_DEAD_ZONE = 0.06;
/** 最小パワー（軽い引きでも最低限の力で投げる） */
export const THROW_MIN_POWER = 14.0;
/** 最大パワー（フルに引いた時の力） */
export const THROW_MAX_POWER = 24.0;
/** Y成分係数（弧の高さ） */
export const THROW_Y_FACTOR = 0.48;
/** Z成分係数（前方への飛距離） */
export const THROW_Z_FACTOR = 0.88;
/** X成分係数（左右の振れ） */
export const THROW_X_FACTOR = 0.50;

// ===== スキットル初期配置 =====
const margin = 1.15;
const D = SKITTLE_RADIUS * 2 * margin;
const ROW_DEPTH = D * 0.866;

export const SKITTLE_POSITIONS = [
  // 1列目（手前）
  { number: 1,  x: -D / 2,     z: -ROW_DEPTH * 1.5 },
  { number: 2,  x:  D / 2,     z: -ROW_DEPTH * 1.5 },
  // 2列目
  { number: 3,  x: -D,         z: -ROW_DEPTH * 0.5 },
  { number: 10, x:  0,         z: -ROW_DEPTH * 0.5 },
  { number: 4,  x:  D,         z: -ROW_DEPTH * 0.5 },
  // 3列目
  { number: 5,  x: -D * 1.5,   z:  ROW_DEPTH * 0.5 },
  { number: 11, x: -D / 2,     z:  ROW_DEPTH * 0.5 },
  { number: 12, x:  D / 2,     z:  ROW_DEPTH * 0.5 },
  { number: 6,  x:  D * 1.5,   z:  ROW_DEPTH * 0.5 },
  // 4列目（奥）
  { number: 7,  x: -D,         z:  ROW_DEPTH * 1.5 },
  { number: 9,  x:  0,         z:  ROW_DEPTH * 1.5 },
  { number: 8,  x:  D,         z:  ROW_DEPTH * 1.5 },
];

// ===== ゲームルール定数 =====
export const WIN_SCORE = 50;
export const OVER_SCORE_RESET = 25;
export const MAX_CONSECUTIVE_MISSES = 3;

// ===== カメラ =====
export const CAMERA_POSITION = { x: 0, y: 0.65 * SCALE, z: -4.5 * SCALE };
export const CAMERA_LOOK_AT = { x: 0, y: 0.15 * SCALE, z: 0 };

// ===== 倒れ判定 =====
export const TOPPLE_THRESHOLD = 0.5;

// ===== 静止判定 =====
export const SETTLE_VELOCITY_THRESHOLD = 0.08;
/** テンポアップしつつ、ぐらぐらの途中で判定されないように十分な時間を確保 (90 -> 150 = 2.5秒) */
export const SETTLE_MIN_FRAMES = 150;

// ===== 物理マテリアル =====
/** スキットル質量: 200g（リアル寄り） */
export const SKITTLE_MASS = 0.20;
/** モルック棒質量: 500g（スキットルの2.5倍で程よいインパクト） */
export const STICK_MASS = 0.50;
export const RESTITUTION = 0.15;
export const FRICTION = 0.95;

// ===== プレイヤー =====
export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 1;
export const PLAYER_COLORS = ['#00c9ff', '#ff6b9d', '#ffd93d', '#6bcb77'];
export const PLAYER_NAMES_DEFAULT = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
