// Point-vs-OBB test: checks if a circle (point + radius) overlaps with an oriented bounding box.
// Returns null if no collision, or { nx, ny, overlap } push-out vector if colliding.
// cx, cy = circle center; cr = circle radius
// bx, by = box center; hw, hh = box half-width/half-height; angle = box rotation
export function circleVsOBB(cx, cy, cr, bx, by, hw, hh, angle) {
  // Transform circle center into box-local space
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const dx = cx - bx;
  const dy = cy - by;
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  // Clamp to box extents to find nearest point on box
  const nearestX = Math.max(-hw, Math.min(hw, localX));
  const nearestY = Math.max(-hh, Math.min(hh, localY));

  const diffX = localX - nearestX;
  const diffY = localY - nearestY;
  const distSq = diffX * diffX + diffY * diffY;

  if (distSq >= cr * cr) return null;

  // Collision detected — compute push-out in world space
  const dist = Math.sqrt(distSq);
  if (dist < 0.001) {
    // Circle center is inside the box — push out along shortest axis
    const overlapX = hw - Math.abs(localX) + cr;
    const overlapY = hh - Math.abs(localY) + cr;
    const cosR = Math.cos(angle);
    const sinR = Math.sin(angle);
    if (overlapX < overlapY) {
      const sign = localX >= 0 ? 1 : -1;
      return {
        nx: sign * cosR,
        ny: sign * sinR,
        overlap: overlapX,
      };
    } else {
      const sign = localY >= 0 ? 1 : -1;
      return {
        nx: sign * -sinR,
        ny: sign * cosR,
        overlap: overlapY,
      };
    }
  }

  const overlap = cr - dist;
  // Push direction in local space, then rotate back to world space
  const lnx = diffX / dist;
  const lny = diffY / dist;
  const cosR = Math.cos(angle);
  const sinR = Math.sin(angle);
  return {
    nx: lnx * cosR - lny * sinR,
    ny: lnx * sinR + lny * cosR,
    overlap,
  };
}

// Line segment vs OBB: checks if a line segment intersects an OBB.
// Returns true if the segment (x1,y1)-(x2,y2) intersects the box.
export function segmentVsOBB(x1, y1, x2, y2, bx, by, hw, hh, angle) {
  // Transform segment into box-local space
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const dx1 = x1 - bx;
  const dy1 = y1 - by;
  const dx2 = x2 - bx;
  const dy2 = y2 - by;
  const lx1 = dx1 * cos - dy1 * sin;
  const ly1 = dx1 * sin + dy1 * cos;
  const lx2 = dx2 * cos - dy2 * sin;
  const ly2 = dx2 * sin + dy2 * cos;

  // Now it's an AABB test: segment (lx1,ly1)-(lx2,ly2) vs box [-hw,hw] x [-hh,hh]
  let tMin = 0, tMax = 1;
  const segDx = lx2 - lx1;
  const segDy = ly2 - ly1;

  // X axis slab
  if (Math.abs(segDx) < 0.0001) {
    if (lx1 < -hw || lx1 > hw) return false;
  } else {
    let t1 = (-hw - lx1) / segDx;
    let t2 = (hw - lx1) / segDx;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }

  // Y axis slab
  if (Math.abs(segDy) < 0.0001) {
    if (ly1 < -hh || ly1 > hh) return false;
  } else {
    let t1 = (-hh - ly1) / segDy;
    let t2 = (hh - ly1) / segDy;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }

  return true;
}
