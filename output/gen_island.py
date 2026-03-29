#!/usr/bin/env python3
"""Procedural low-poly floating island generator — take 2."""

import numpy as np
import trimesh
import random

random.seed(42)
np.random.seed(42)


def create_terrain(radius=3.0, height=2.8, seed=42):
    """Create an irregular floating island using a subdivided radial grid."""
    rng = np.random.RandomState(seed)
    
    # Build a radial grid with multiple rings
    rings = [
        (0.0, 1),    # center
        (0.8, 8),    # inner ring
        (1.6, 12),   # mid ring
        (2.4, 16),   # outer ring
        (3.0, 20),   # edge ring
    ]
    
    top_verts = []
    vert_ring_ids = []  # track which ring each vert belongs to
    
    for ring_r, n_pts in rings:
        if n_pts == 1:
            top_verts.append([0, 0, rng.uniform(0.05, 0.15)])
            vert_ring_ids.append(0)
        else:
            for j in range(n_pts):
                a = 2 * np.pi * j / n_pts + rng.uniform(-0.15, 0.15)
                rr = ring_r + rng.uniform(-0.25, 0.25)
                x = rr * np.cos(a)
                y = rr * np.sin(a)
                # Height variation: gentle hills
                z = rng.uniform(-0.05, 0.2) * (ring_r / radius)
                top_verts.append([x, y, z])
                vert_ring_ids.append(len(rings) - 1 - rings.index((ring_r, n_pts)))
    
    top_verts = np.array(top_verts)
    n_top = len(top_verts)
    
    # Create bottom verts (mirror with taper and irregularity)
    bottom_verts = np.copy(top_verts)
    for i in range(n_top):
        r = np.sqrt(top_verts[i, 0]**2 + top_verts[i, 1]**2)
        t = r / radius
        bh = height * (1.0 - 0.2 * t) + rng.uniform(-0.4, 0.2)
        # Add stalactite-like points on bottom
        if rng.random() < 0.3:
            bh += rng.uniform(0.2, 0.6)
        bottom_verts[i] = [top_verts[i, 0], top_verts[i, 1], -bh]
    
    # Triangulate top surface
    from scipy.spatial import Delaunay
    tri = Delaunay(top_verts[:, :2])
    top_faces = tri.simplices
    
    # Triangulate bottom surface (flipped winding)
    tri_b = Delaunay(bottom_verts[:, :2])
    bot_faces = tri_b.simplices[:, ::-1]
    
    # Side faces from convex hull perimeter
    from scipy.spatial import ConvexHull
    hull = ConvexHull(top_verts[:, :2])
    hull_indices = hull.vertices
    hull_pts = top_verts[hull_indices, :2]
    hull_angles = np.arctan2(hull_pts[:, 1], hull_pts[:, 0])
    sorted_order = np.argsort(hull_angles)
    hull_ring = hull_indices[sorted_order]
    
    side_faces = []
    for i in range(len(hull_ring)):
        i0 = hull_ring[i]
        i1 = hull_ring[(i + 1) % len(hull_ring)]
        side_faces.append([i0, i1, i1 + n_top])
        side_faces.append([i0, i1 + n_top, i0 + n_top])
    
    all_verts = np.vstack([top_verts, bottom_verts])
    all_faces = np.vstack([top_faces, bot_faces + n_top, np.array(side_faces)])
    
    mesh = trimesh.Trimesh(vertices=all_verts, faces=all_faces, process=False)
    return mesh


def color_island(mesh, height_range):
    """Color vertices: green top, brown sides, dark bottom."""
    normals = mesh.vertex_normals
    colors = np.zeros((len(mesh.vertices), 4))
    h_min, h_max = height_range
    h_range = h_max - h_min
    
    for i, n in enumerate(normals):
        nz = n[2]
        h_norm = (mesh.vertices[i][2] - h_min) / h_range
        
        if nz > 0.3:
            # Top surface: grass green with subtle variation
            g = 0.5 + 0.15 * np.random.random()
            colors[i] = [0.2 + 0.1 * np.random.random(), g, 0.15, 1.0]
        elif nz < -0.3:
            # Bottom: dark rocky
            colors[i] = [0.2, 0.15, 0.12, 1.0]
        else:
            # Sides: brown/gray gradient
            colors[i] = [
                0.35 + 0.2 * h_norm,
                0.25 + 0.15 * h_norm,
                0.18 + 0.18 * h_norm,
                1.0
            ]
    
    mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, vertex_colors=colors)


def create_tree(x, y, z, scale=1.0, rng=None):
    """Low-poly tree: cylinder trunk + layered cone foliage."""
    if rng is None:
        rng = np.random.RandomState()
    
    # Trunk
    trunk_h = 0.25 * scale + rng.uniform(0, 0.1)
    trunk_r = 0.05 * scale
    trunk = trimesh.creation.cylinder(radius=trunk_r, height=trunk_h, sections=5)
    trunk.apply_translation([x, y, z + trunk_h / 2])
    trunk_colors = np.tile([0.4, 0.25, 0.12, 1.0], (len(trunk.vertices), 1))
    trunk.visual = trimesh.visual.ColorVisuals(mesh=trunk, vertex_colors=trunk_colors)
    
    # Two-layer foliage for a nicer look
    foliage_parts = []
    base_z = z + trunk_h
    
    for layer, (h, r, color) in enumerate([
        (0.45 * scale + rng.uniform(0, 0.15), 0.28 * scale + rng.uniform(0, 0.08), [0.15, 0.5, 0.12, 1.0]),
        (0.3 * scale + rng.uniform(0, 0.1), 0.22 * scale + rng.uniform(0, 0.06), [0.2, 0.55, 0.15, 1.0]),
    ]):
        cone = trimesh.creation.cone(radius=r, height=h, sections=6)
        cone.apply_translation([x, y, base_z + h * 0.3 + layer * 0.15 * scale])
        cone_colors = np.tile(color, (len(cone.vertices), 1))
        cone.visual = trimesh.visual.ColorVisuals(mesh=cone, vertex_colors=cone_colors)
        foliage_parts.append(cone)
    
    return [trunk] + foliage_parts


def create_pond(x, y, z, radius=0.35, segments=12):
    """Flat circular pond."""
    pond = trimesh.creation.cylinder(radius=radius, height=0.015, sections=segments)
    pond.apply_translation([x, y, z + 0.008])
    pond_colors = np.tile([0.18, 0.38, 0.78, 1.0], (len(pond.vertices), 1))
    pond.visual = trimesh.visual.ColorVisuals(mesh=pond, vertex_colors=pond_colors)
    return pond


def create_rock(x, y, z, scale=1.0, rng=None):
    """Small low-poly rock."""
    if rng is None:
        rng = np.random.RandomState()
    
    # Deformed icosphere
    rock = trimesh.creation.icosphere(subdivisions=1, radius=0.12 * scale)
    # Random deformation
    verts = rock.vertices
    for i in range(len(verts)):
        verts[i] *= (0.7 + 0.6 * rng.random())
    rock.vertices = verts
    rock.apply_translation([x, y, z + 0.05 * scale])
    
    gray = 0.35 + 0.2 * rng.random()
    rock_colors = np.tile([gray, gray * 0.9, gray * 0.85, 1.0], (len(rock.vertices), 1))
    rock.visual = trimesh.visual.ColorVisuals(mesh=rock, vertex_colors=rock_colors)
    return rock


def main():
    rng = np.random.RandomState(42)
    
    # --- Island terrain ---
    island = create_terrain(radius=3.0, height=2.8, seed=42)
    island.fix_normals()
    island.remove_unreferenced_vertices()
    
    h_min, h_max = island.vertices[:, 2].min(), island.vertices[:, 2].max()
    color_island(island, (h_min, h_max))
    
    parts = [island]
    
    # --- Trees ---
    tree_positions = [
        (0.8, 0.5, 0.12, 1.0),
        (-1.0, 0.8, 0.08, 0.85),
        (0.3, -1.3, 0.1, 1.15),
        (-0.6, -0.9, 0.05, 0.7),
        (1.6, -0.4, 0.14, 0.95),
        (-1.8, -0.2, 0.06, 0.75),
        (0.1, 1.5, 0.09, 1.05),
    ]
    
    for tx, ty, tz, ts in tree_positions:
        parts.extend(create_tree(tx, ty, tz, scale=ts, rng=rng))
    
    # --- Pond ---
    parts.append(create_pond(-0.2, 0.4, 0.02, radius=0.38))
    
    # --- Small rocks ---
    rock_positions = [
        (1.2, 0.8, 0.08, 0.6),
        (-1.4, 1.0, 0.05, 0.4),
        (0.7, -0.6, 0.1, 0.5),
        (-0.3, 1.8, 0.06, 0.45),
        (1.9, 0.5, 0.1, 0.35),
    ]
    
    for rx, ry, rz, rs in rock_positions:
        parts.append(create_rock(rx, ry, rz, scale=rs, rng=rng))
    
    # --- Combine & export ---
    scene = trimesh.Scene()
    for p in parts:
        scene.add_geometry(p)
    
    glb_path = "/home/graeme/.openclaw/workspace/output/floating_island.glb"
    gltf_path = "/home/graeme/.openclaw/workspace/output/floating_island.gltf"
    
    scene.export(glb_path, file_type='glb')
    scene.export(gltf_path, file_type='gltf')
    
    # Stats
    total_verts = sum(len(p.vertices) for p in parts)
    total_faces = sum(len(p.faces) for p in parts)
    
    import os
    print(f"✅ Floating island generated!")
    print(f"   Vertices: {total_verts}")
    print(f"   Triangles: {total_faces}")
    print(f"   GLB: {glb_path} ({os.path.getsize(glb_path):,} bytes)")
    print(f"   GLTF: {gltf_path} ({os.path.getsize(gltf_path):,} bytes)")


if __name__ == "__main__":
    main()
