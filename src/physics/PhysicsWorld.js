import RAPIER from '@dimforge/rapier3d-compat';
import { GRAVITY, PHYSICS_TIMESTEP } from '../constants.js';

let rapier = null;
let world = null;

export async function initPhysics() {
  await RAPIER.init();
  rapier = RAPIER;

  const gravity = new RAPIER.Vector3(GRAVITY.x, GRAVITY.y, GRAVITY.z);
  world = new RAPIER.World(gravity);
  world.timestep = PHYSICS_TIMESTEP;

  return { rapier, world };
}

export function stepPhysics() {
  if (world) {
    world.step();
  }
}

export function getWorld() {
  return world;
}

export function getRapier() {
  return rapier;
}

/** ワールドの全剛体をリセット（リスタート用） */
export function resetWorld() {
  if (!world || !rapier) return;

  // 全ボディを削除
  world.forEachRigidBody((body) => {
    world.removeRigidBody(body);
  });
}
