import { moveActor } from "./world.js";

export class Player {
  constructor(spawn) {
    this.x = spawn.x;
    this.y = spawn.y;
    this.angle = 0;
    this.dirX = 1;
    this.dirY = 0;
    this.planeX = 0;
    this.planeY = 0.66;
    this.radius = 0.26;

    this.maxHealth = 100;
    this.health = 100;
    this.maxStamina = 100;
    this.stamina = 100;

    this.crouching = false;
    this.sprinting = false;
    this.walkPhase = 0;
    this.bobY = 0;
    this.bobTime = 0;
    this.stepDistance = 0;

    this.swingT = 0;
    this.attackCd = 0;
    this.hurtFlash = 0;
    this.dead = false;
  }

  setAngle(angle) {
    this.angle = angle;
    this.dirX = Math.cos(angle);
    this.dirY = Math.sin(angle);
    this.planeX = -this.dirY * 0.66;
    this.planeY = this.dirX * 0.66;
  }

  turn(delta) {
    this.setAngle(this.angle + delta);
  }

  reset(spawn) {
    this.x = spawn.x;
    this.y = spawn.y;
    this.setAngle(0);
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
    this.dead = false;
    this.swingT = 0;
    this.attackCd = 0;
    this.hurtFlash = 0;
    this.bobY = 0;
  }

  update(world, input, dt, state, audio) {
    if (this.dead) return;

    this.attackCd = Math.max(0, this.attackCd - dt);
    this.swingT = Math.max(0, this.swingT - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);

    this.crouching = input.isDown("ControlLeft") || input.isDown("ControlRight");
    const forward = (input.isDown("KeyW") ? 1 : 0) - (input.isDown("KeyS") ? 1 : 0);
    const strafe = (input.isDown("KeyD") ? 1 : 0) - (input.isDown("KeyA") ? 1 : 0);
    const wantsSprint =
      (input.isDown("ShiftLeft") || input.isDown("ShiftRight")) && forward > 0 && this.stamina > 1;

    this.sprinting = wantsSprint && !this.crouching;
    const boots = state.upgrades.boots;
    let speed = 2.35 * (1 + boots * 0.08);
    if (this.crouching) speed *= 0.52;
    else if (this.sprinting) speed *= 1.62;

    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - 24 * dt);
      if (this.stamina <= 0) this.sprinting = false;
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + (this.crouching ? 10 : 16) * dt);
    }

    let dx = 0;
    let dy = 0;
    if (forward !== 0 || strafe !== 0) {
      dx = this.dirX * forward + -this.dirY * strafe;
      dy = this.dirY * forward + this.dirX * strafe;
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      moveActor(world, this, dx * speed * dt, dy * speed * dt, this.radius);

      this.bobTime += dt * (this.sprinting ? 12 : this.crouching ? 5 : 8);
      this.bobY = Math.sin(this.bobTime) * (this.sprinting ? 2.4 : 1.5);
      this.walkPhase = this.bobTime;
      this.stepDistance += speed * dt;
      if (this.stepDistance > (this.sprinting ? 1.5 : 2.1)) {
        this.stepDistance = 0;
        if (audio) audio.step(this.crouching);
      }
    } else {
      this.bobY *= Math.max(0, 1 - dt * 8);
      this.walkPhase += dt * 1.5;
    }
  }
}
