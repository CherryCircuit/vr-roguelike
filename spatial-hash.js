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
    if (obj && typeof obj === 'object') {
      obj._hashX = x;
      obj._hashZ = z;
    }
    bucket.push(obj);
  }

  query(x, z, radius) {
    const results = [];
    return this.queryInto(results, x, z, radius);
  }

  // PERFORMANCE: Reusable query method that pushes into provided array
  // Callers should clear the array before use: arr.length = 0
  queryInto(targetArray, x, z, radius) {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCz = Math.floor((z - radius) / this.cellSize);
    const maxCz = Math.floor((z + radius) / this.cellSize);
    const rSq = radius * radius;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const bucket = this.grid.get(`${cx},${cz}`);
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const obj = bucket[i];
          if (!obj || typeof obj !== 'object') continue;

          let objX = obj._hashX;
          let objZ = obj._hashZ;
          if (!Number.isFinite(objX) || !Number.isFinite(objZ)) {
            if (obj.mesh && obj.mesh.position) {
              objX = obj.mesh.position.x;
              objZ = obj.mesh.position.z;
            } else if (Number.isFinite(obj.x) && Number.isFinite(obj.z)) {
              objX = obj.x;
              objZ = obj.z;
            }
          }
          if (!Number.isFinite(objX) || !Number.isFinite(objZ)) continue;

          const dx = objX - x;
          const dz = objZ - z;
          if (dx * dx + dz * dz <= rSq) {
            targetArray.push(obj);
          }
        }
      }
    }
    return targetArray;
  }
}
