/**
 * Simple spatial hash grid for fast proximity queries.
 * Grid cell size should be >= max query radius.
 */
export class SpatialHash {
  constructor(cellSize = 10) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  clear() {
    this.grid.clear();
  }

  _key(x, z) {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return `${cx},${cz}`;
  }

  insert(obj, x, z) {
    const key = this._key(x, z);
    let bucket = this.grid.get(key);
    if (!bucket) {
      bucket = [];
      this.grid.set(key, bucket);
    }
    bucket.push(obj);
  }

  query(x, z, radius) {
    const results = [];
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCz = Math.floor((z - radius) / this.cellSize);
    const maxCz = Math.floor((z + radius) / this.cellSize);
    const rSq = radius * radius;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const bucket = this.grid.get(`${cx},${cz}`);
        if (bucket) {
          for (let i = 0; i < bucket.length; i++) {
            const obj = bucket[i];
            const dx = obj.x - x;
            const dz = obj.z - z;
            if (dx * dx + dz * dz <= rSq) {
              results.push(obj);
            }
          }
        }
      }
    }
    return results;
  }
}
