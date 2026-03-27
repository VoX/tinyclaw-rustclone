// Grid-based spatial hash for efficient proximity queries
export class SpatialHash {
  constructor(cellSize = 8) {
    this.cellSize = cellSize;
    this.cells = new Map();    // "cx,cy" -> Set of eids
    this.entityCell = new Map(); // eid -> "cx,cy"
    this.entityPos = new Map();  // eid -> {x, y}
  }

  _key(cx, cy) {
    return cx + ',' + cy;
  }

  _cellCoords(x, y) {
    return [Math.floor(x / this.cellSize), Math.floor(y / this.cellSize)];
  }

  insert(eid, x, y) {
    const [cx, cy] = this._cellCoords(x, y);
    const key = this._key(cx, cy);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = new Set();
      this.cells.set(key, cell);
    }
    cell.add(eid);
    this.entityCell.set(eid, key);
    this.entityPos.set(eid, { x, y });
  }

  remove(eid) {
    const key = this.entityCell.get(eid);
    if (key !== undefined) {
      const cell = this.cells.get(key);
      if (cell) {
        cell.delete(eid);
        if (cell.size === 0) this.cells.delete(key);
      }
      this.entityCell.delete(eid);
      this.entityPos.delete(eid);
    }
  }

  update(eid, x, y) {
    const [cx, cy] = this._cellCoords(x, y);
    const newKey = this._key(cx, cy);
    const oldKey = this.entityCell.get(eid);
    if (oldKey === newKey) {
      // Same cell, just update position
      const pos = this.entityPos.get(eid);
      if (pos) { pos.x = x; pos.y = y; }
      return;
    }
    // Move to new cell
    if (oldKey !== undefined) {
      const oldCell = this.cells.get(oldKey);
      if (oldCell) {
        oldCell.delete(eid);
        if (oldCell.size === 0) this.cells.delete(oldKey);
      }
    }
    let newCell = this.cells.get(newKey);
    if (!newCell) {
      newCell = new Set();
      this.cells.set(newKey, newCell);
    }
    newCell.add(eid);
    this.entityCell.set(eid, newKey);
    this.entityPos.set(eid, { x, y });
  }

  query(x, y, radius) {
    const results = [];
    const r2 = radius * radius;
    const minCX = Math.floor((x - radius) / this.cellSize);
    const maxCX = Math.floor((x + radius) / this.cellSize);
    const minCY = Math.floor((y - radius) / this.cellSize);
    const maxCY = Math.floor((y + radius) / this.cellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(this._key(cx, cy));
        if (!cell) continue;
        for (const eid of cell) {
          const pos = this.entityPos.get(eid);
          if (!pos) continue;
          const dx = pos.x - x;
          const dy = pos.y - y;
          if (dx * dx + dy * dy <= r2) {
            results.push(eid);
          }
        }
      }
    }
    return results;
  }

  clear() {
    this.cells.clear();
    this.entityCell.clear();
    this.entityPos.clear();
  }
}
