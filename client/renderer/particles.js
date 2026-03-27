import { TILE_SIZE } from '../../shared/constants.js';

export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  emit(x, y, color, count, speed, life) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.5 + Math.random() * 0.5);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life,
        maxLife: life,
        color,
        size: 1.5 + Math.random() * 2,
      });
    }
  }

  // Directional burst (for hits, muzzle flash)
  emitDirectional(x, y, angle, color, count, speed, spread, life) {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const spd = speed * (0.5 + Math.random() * 0.5);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life,
        maxLife: life,
        color,
        size: 1.5 + Math.random() * 2,
      });
    }
  }

  update(dt) {
    const dtSec = dt / 1000;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }
  }

  draw(ctx, camX, camY, w, h, viewScale) {
    for (const p of this.particles) {
      const sx = (p.x - camX) * viewScale / TILE_SIZE + w / 2;
      const sy = (p.y - camY) * viewScale / TILE_SIZE + h / 2;
      if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
