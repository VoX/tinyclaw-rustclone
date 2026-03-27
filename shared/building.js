// Building system utilities: foundation edges, snap logic
// Used by both server (BuildSystem) and client (build preview)

import { TILE_SIZE } from './constants.js';

const EDGE_SIZE = TILE_SIZE * 2; // foundation is 2x2 tiles = 4 world units wide
const HALF = EDGE_SIZE / 2;      // 2 world units from center to edge
const SNAP_RANGE = 3.5;          // max snap distance in world units
const SNAP_RANGE_SQ = SNAP_RANGE * SNAP_RANGE;

// Get the 4 edge midpoints + normals for a square foundation at (cx, cy)
// Each edge: { mx, my, nx, ny, rot } where (mx,my) = midpoint, (nx,ny) = outward normal, rot = wall angle
export function getSquareEdges(cx, cy) {
  return [
    { mx: cx, my: cy - HALF, nx: 0, ny: -1, rot: 0 },             // north
    { mx: cx, my: cy + HALF, nx: 0, ny: 1, rot: 0 },              // south
    { mx: cx + HALF, my: cy, nx: 1, ny: 0, rot: Math.PI / 2 },    // east
    { mx: cx - HALF, my: cy, nx: -1, ny: 0, rot: Math.PI / 2 },   // west
  ];
}

// Get the 3 edge midpoints + normals for a triangle foundation at (cx, cy) with given rotation
// Triangle is equilateral, inscribed in same EDGE_SIZE bounding box
// rotation=0: point up. rotation=PI: point down.
export function getTriangleEdges(cx, cy, rotation) {
  const r = rotation || 0;
  const cos = Math.cos(r);
  const sin = Math.sin(r);

  // Base triangle (point-up): vertices at top, bottom-left, bottom-right
  // in local space relative to center
  const h = HALF * Math.sqrt(3) / 2; // triangle half-height ~1.73
  const verts = [
    { x: 0, y: -h },           // top vertex
    { x: -HALF, y: h },        // bottom-left
    { x: HALF, y: h },         // bottom-right
  ];

  // Rotate vertices
  const rv = verts.map(v => ({
    x: cx + v.x * cos - v.y * sin,
    y: cy + v.x * sin + v.y * cos,
  }));

  // Edges: between consecutive vertices
  const edges = [];
  for (let i = 0; i < 3; i++) {
    const a = rv[i];
    const b = rv[(i + 1) % 3];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    // Edge direction
    const edx = b.x - a.x;
    const edy = b.y - a.y;
    const len = Math.sqrt(edx * edx + edy * edy);
    // Outward normal (perpendicular, pointing away from center)
    let nx = edy / len;
    let ny = -edx / len;
    // Ensure normal points away from center
    const toCx = cx - mx;
    const toCy = cy - my;
    if (nx * toCx + ny * toCy > 0) { nx = -nx; ny = -ny; }
    // Wall rotation = angle of the edge direction
    const wallRot = Math.atan2(edy, edx);
    edges.push({ mx, my, nx, ny, rot: wallRot });
  }
  return edges;
}

// Check if an edge position is "internal" (shared between two adjacent foundations)
// foundations: array of { x, y, st } where st is structure type (1=square, 8=triangle)
// edgeMx, edgeMy: the edge midpoint to check
// Returns true if another foundation also has an edge at approximately the same position
export function isInternalEdge(edgeMx, edgeMy, foundations, selfIdx) {
  const threshold = 0.5; // matching tolerance
  const thresholdSq = threshold * threshold;
  for (let i = 0; i < foundations.length; i++) {
    if (i === selfIdx) continue;
    const f = foundations[i];
    const edges = f.st === 8
      ? getTriangleEdges(f.x, f.y, f.rot || 0)
      : getSquareEdges(f.x, f.y);
    for (const e of edges) {
      const dx = e.mx - edgeMx;
      const dy = e.my - edgeMy;
      if (dx * dx + dy * dy < thresholdSq) return true;
    }
  }
  return false;
}

// Find the best snap target for a new foundation near existing foundations.
// Returns { x, y, rotation } or null if no snap (free placement).
// cursorX, cursorY: world position of cursor
// foundations: array of { x, y, st, rot }
export function snapFoundation(cursorX, cursorY, pieceType, foundations) {
  if (foundations.length === 0) return null; // free placement

  let bestDist = SNAP_RANGE_SQ;
  let bestSnap = null;

  for (let i = 0; i < foundations.length; i++) {
    const f = foundations[i];
    const edges = f.st === 8
      ? getTriangleEdges(f.x, f.y, f.rot || 0)
      : getSquareEdges(f.x, f.y);

    for (const edge of edges) {
      // New foundation center = edge midpoint + normal * HALF (for square)
      // or edge midpoint + normal * triangle-height (for triangle)
      let newX, newY, newRot = 0;
      if (pieceType === 8) {
        // Triangle snapping to an edge: align triangle edge to foundation edge
        // Place triangle center offset from edge by triangle half-height
        const triH = HALF * Math.sqrt(3) / 2;
        newX = edge.mx + edge.nx * triH;
        newY = edge.my + edge.ny * triH;
        // Triangle rotation: point away from the edge it snaps to
        newRot = Math.atan2(edge.ny, edge.nx) - Math.PI / 2;
      } else {
        // Square snapping: center at edge + normal * HALF
        newX = edge.mx + edge.nx * HALF;
        newY = edge.my + edge.ny * HALF;
      }

      const dx = newX - cursorX;
      const dy = newY - cursorY;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        bestSnap = { x: newX, y: newY, rotation: newRot };
      }
    }
  }

  return bestSnap;
}

// Find the best edge for a wall/doorway/window to snap to.
// Only snaps to outer edges (not internal edges shared between foundations).
// Returns { x, y, rotation } or null if no valid edge found.
export function snapWall(cursorX, cursorY, foundations) {
  let bestDist = SNAP_RANGE_SQ;
  let bestSnap = null;

  // Build foundation list for internal edge detection
  const fList = foundations.map(f => ({ x: f.x, y: f.y, st: f.st, rot: f.rot || 0 }));

  for (let i = 0; i < foundations.length; i++) {
    const f = foundations[i];
    const edges = f.st === 8
      ? getTriangleEdges(f.x, f.y, f.rot || 0)
      : getSquareEdges(f.x, f.y);

    for (const edge of edges) {
      // Skip internal edges
      if (isInternalEdge(edge.mx, edge.my, fList, i)) continue;

      const dx = edge.mx - cursorX;
      const dy = edge.my - cursorY;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        bestSnap = { x: edge.mx, y: edge.my, rotation: edge.rot };
      }
    }
  }

  return bestSnap;
}
