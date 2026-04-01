"""
SPACE-OM-ICIDE Model Optimizer for Blender
==========================================
Run this script after loading a model into a scene.

What it does (on SELECTED objects only):
1. Merges vertices by distance (removes doubles)
2. Recalculates normals (fixes inside-out faces)
3. Deletes loose geometry (stray verts/edges)
4. Removes degenerate faces (zero-area)
5. Fills holes (where possible)
6. Checks for non-manifold geometry (reports, doesn't auto-fix)
7. Applies Decimate modifier (configurable target)
8. Applies all transforms (scale, rotation, location)
9. Sets origin to bottom of mesh bounds
10. Opens glTF export dialog for selected objects

Usage:
1. Import your .glb/.obj/.fbx into Blender
2. Select the mesh object(s) you want to optimize
3. Open Scripting workspace or Text Editor
4. Open this script (or paste it)
5. Adjust TARGET_TRIS at the top if needed
6. Run script (Play button or Alt+P)
7. Save the .glb when dialog appears

Tips:
- Select multiple objects to optimize and export them together
- Use different TARGET_TRIS values for different object types:
  - 200 for props/pickups
  - 600 for enemies
  - 1500 for scenery
  - 3000 for bosses

Author: Codey 🐵
"""

import bpy
import bmesh
import math
import mathutils
from mathutils import Vector

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION - Adjust these before running
# ═══════════════════════════════════════════════════════════════════════════════

# Target triangle count for the entire model
# Set to None to skip decimation (if model is already low enough)
TARGET_TRIS = 1500  # SCENERY tier. Use 600 for ENEMY, 3000 for BOSS

# Decimate mode: "RATIO" or "TARGET"
# RATIO = use fixed ratio (0.5 = half the tris)
# TARGET = auto-calculate ratio to hit TARGET_TRIS
DECIMATE_MODE = "TARGET"

# Fixed decimation ratio (only used if DECIMATE_MODE = "RATIO")
DECIMATE_RATIO = 0.5

# Maximum merge distance (in meters) - removes vertices closer than this
MERGE_DISTANCE = 0.0001

# Whether to automatically recalculate normals
RECALC_NORMALS = True

# Whether to fill holes
FILL_HOLES = True

# Whether to check and report non-manifold geometry
CHECK_NON_MANIFOLD = True

# Whether to apply transforms at the end
APPLY_TRANSFORMS = True

# Whether to set origin to bottom of mesh
SET_ORIGIN_TO_BOTTOM = True

# ── VERTEX COLORS ─────────────────────────────────────────────────────────────
# Bake texture colors to vertex colors automatically (works for most models)
# Uses Cycles bake: Diffuse Color → Vertex Colors
# 
# If colors look wrong, bake manually in Blender:
#   1. Object Data Properties → Vertex Colors → Add (+)
#   2. Render Properties → Engine: Cycles
#   3. Bake Type: Diffuse, Influence: Color ONLY
#   4. Target: Vertex Colors → Bake
BAKE_TEXTURE_TO_VERTEX_COLORS = True  # Set False to keep textures

# For already-vertex-painted models (skip baking, just set up material)
VERTEX_COLOR_MODE = False  # Set True if you already have vertex colors

# Solidify vertex colors: average colors per face for flat/solid shading
# This removes color gradients and makes each face a single solid color
SOLIDIFY_VERTEX_COLORS = True  # Set False to keep gradients from bake

# ═══════════════════════════════════════════════════════════════════════════════
# SCRIPT START - No need to edit below here
# ═══════════════════════════════════════════════════════════════════════════════

def get_selected_mesh_objects():
    """Get selected mesh objects in the scene."""
    return [obj for obj in bpy.context.selected_objects if obj.type == 'MESH']

def get_all_mesh_objects():
    """Get all mesh objects in the scene (for reference)."""
    return [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']

def count_triangles(obj):
    """Count triangles in a mesh object (quads/ngons count as multiple tris)."""
    if not obj or obj.type != 'MESH':
        return 0
    
    # Need to be in object mode to access mesh data reliably
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='OBJECT')
    
    mesh = obj.data
    tri_count = 0
    for poly in mesh.polygons:
        # Each polygon with n vertices triangulates to n-2 triangles
        tri_count += len(poly.vertices) - 2
    return tri_count

def count_total_triangles(meshes=None):
    """Count total triangles in given mesh objects (or all if not specified)."""
    if meshes is None:
        meshes = get_all_mesh_objects()
    total = 0
    for obj in meshes:
        total += count_triangles(obj)
    return total

def select_optimized_meshes(meshes):
    """Select the optimized mesh objects (for export)."""
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:
        obj.select_set(True)
    return meshes

def ensure_object_mode():
    """Ensure we're in object mode."""
    if bpy.context.active_object and bpy.context.active_object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')

def ensure_edit_mode(obj):
    """Switch to edit mode for the given object."""
    bpy.context.view_layer.objects.active = obj
    if obj.mode != 'EDIT':
        bpy.ops.object.mode_set(mode='EDIT')

def merge_by_distance(obj, distance=0.0001):
    """Merge vertices that are closer than distance."""
    ensure_edit_mode(obj)
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=distance)
    ensure_object_mode()

def recalculate_normals(obj):
    """Recalculate normals to point outward."""
    ensure_edit_mode(obj)
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    ensure_object_mode()

def delete_loose(obj):
    """Delete loose vertices and edges."""
    ensure_edit_mode(obj)
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.delete_loose()
    ensure_object_mode()

def delete_degenerate(obj):
    """Remove degenerate (zero-area) faces."""
    ensure_edit_mode(obj)
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.dissolve_degenerate()
    ensure_object_mode()

def fill_holes(obj):
    """Attempt to fill holes in the mesh."""
    ensure_edit_mode(obj)
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.fill_holes()
    ensure_object_mode()

def count_non_manifold(obj):
    """Count non-manifold vertices/edges (mesh errors)."""
    ensure_edit_mode(obj)
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.mesh.select_non_manifold()
    
    # Count selected
    bm = bmesh.from_edit_mesh(obj.data)
    non_manifold_count = sum(1 for v in bm.verts if v.select)
    ensure_object_mode()
    return non_manifold_count

def apply_decimate(obj, target_tris=None, ratio=None):
    """Apply decimate modifier to reduce polygon count."""
    current_tris = count_triangles(obj)
    
    if target_tris is not None and current_tris <= target_tris:
        print(f"  [SKIP] {obj.name}: {current_tris} tris (under target {target_tris})")
        return False
    
    # Calculate ratio if target specified
    if target_tris is not None:
        ratio = target_tris / current_tris
        ratio = max(0.01, min(1.0, ratio))  # Clamp between 0.01 and 1.0
    
    ensure_object_mode()
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    
    # Add decimate modifier
    mod = obj.modifiers.new(name="Decimate_Optimize", type='DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = ratio
    
    # Apply the modifier
    bpy.ops.object.modifier_apply(modifier=mod.name)
    
    new_tris = count_triangles(obj)
    print(f"  [DECIMATE] {obj.name}: {current_tris} → {new_tris} tris (ratio: {ratio:.3f})")
    return True

def apply_all_transforms(obj):
    """Apply location, rotation, and scale transforms."""
    ensure_object_mode()
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    print(f"  [TRANSFORM] {obj.name}: Applied all transforms")

def set_origin_to_bottom(obj):
    """Set the object origin to the bottom of its bounding box."""
    ensure_object_mode()
    
    # Get the bounding box
    bbox = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    min_z = min(v.z for v in bbox)
    
    # Calculate the offset
    current_origin = obj.matrix_world.translation
    new_origin = Vector((current_origin.x, current_origin.y, min_z))
    
    # Set origin to bottom
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    
    # Move 3D cursor to new origin position, set origin to cursor, restore cursor
    old_cursor = bpy.context.scene.cursor.location.copy()
    bpy.context.scene.cursor.location = new_origin
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.context.scene.cursor.location = old_cursor
    
    # Move object up so it sits on ground (if origin was at bottom)
    obj.location.z = 0
    
    print(f"  [ORIGIN] {obj.name}: Set origin to bottom (z={min_z:.3f})")

def has_vertex_colors(obj):
    """Check if the mesh has vertex color data."""
    if not obj or obj.type != 'MESH' or not obj.data.vertex_colors:
        return False
    return len(obj.data.vertex_colors) > 0

def get_texture_image_from_material(obj):
    """Extract the first texture image found in the object's material."""
    if not obj.data.materials or len(obj.data.materials) == 0:
        return None
    
    for mat in obj.data.materials:
        if not mat or not mat.use_nodes:
            continue
        
        # Look for Image Texture nodes
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image:
                return node.image
    
    return None

def srgb_to_linear(c):
    """Convert sRGB color component to linear space."""
    if c <= 0.04045:
        return c / 12.92
    else:
        return ((c + 0.055) / 1.055) ** 2.4

def verify_vertex_colors_populated(obj):
    """Check if vertex colors have actual color data (not all black/gray)."""
    ensure_object_mode()
    bpy.context.view_layer.objects.active = obj
    
    mesh = obj.data
    
    if not mesh.vertex_colors:
        print(f"  [VERIFY] No vertex color layer exists")
        return False
    
    vcol_layer = mesh.vertex_colors.active
    if not vcol_layer:
        print(f"  [VERIFY] No active vertex color layer")
        return False
    
    # Sample vertices to check if they have actual colors
    colors_found = []
    for poly in mesh.polygons[:min(100, len(mesh.polygons))]:  # Check first 100 faces
        for loop_idx in poly.loop_indices:
            c = vcol_layer.data[loop_idx].color
            colors_found.append((c[0], c[1], c[2]))
    
    if not colors_found:
        print(f"  [VERIFY] No vertex colors found")
        return False
    
    # Check if any color has non-zero values
    max_color = max(max(c) for c in colors_found)
    min_color = min(min(c) for c in colors_found)
    
    unique_colors = len(set((round(c[0], 3), round(c[1], 3), round(c[2], 3)) for c in colors_found))
    
    print(f"  [VERIFY] Sampled {len(colors_found)} vertices")
    print(f"  [VERIFY] {unique_colors} unique colors")
    print(f"  [VERIFY] Color range: {min_color:.3f} to {max_color:.3f}")
    
    # If all colors are zero (black), bake failed
    if max_color < 0.001:
        print(f"  [VERIFY] All colors are BLACK - bake failed")
        return False
    
    # If all colors are the same, bake failed
    if unique_colors <= 1:
        print(f"  [VERIFY] Only one color - bake failed")
        return False
    
    # Sample some actual colors for debugging
    sample_colors = list(set((round(c[0], 2), round(c[1], 2), round(c[2], 2)) for c in colors_found))[:5]
    print(f"  [VERIFY] Sample colors: {sample_colors}")
    
    return True

def bake_texture_to_vertex_colors_manual(obj):
    """Transfer texture to vertex colors using direct UV sampling (working method)."""
    ensure_object_mode()
    bpy.context.view_layer.objects.active = obj
    
    mesh = obj.data
    
    # Check for UVs
    if not mesh.uv_layers or len(mesh.uv_layers) == 0:
        print(f"  [BAKE] No UV layers")
        return False
    
    # Get the texture image
    image = get_texture_image_from_material(obj)
    if not image:
        print(f"  [BAKE] No texture image found")
        return False
    
    print(f"  [BAKE] Transferring texture '{image.name}' to vertex colors...")
    print(f"  [BAKE] Image: {image.size[0]}x{image.size[1]}")
    
    # Get or create vertex color layer
    if not mesh.vertex_colors:
        mesh.vertex_colors.new(name="Col")
    vert_color_layer = mesh.vertex_colors.active
    vert_values = vert_color_layer.data.values()
    
    # Get the active UV layer
    uv_layer = mesh.uv_layers.active.data.values()
    
    # Get image pixels as flat array
    width = image.size[0]
    height = image.size[1]
    pixels = image.pixels[:]  # Flat array: [r,g,b,a, r,g,b,a, ...]
    
    if width == 0 or height == 0:
        return False
    
    # Sample colors for debugging
    sample_colors = []
    
    # Direct UV-to-vertex-color transfer (same index in both arrays)
    for i, vert in enumerate(uv_layer):
        # Key insight from working addon: X and Y are FLIPPED
        # UV.u = horizontal, UV.v = vertical
        x = int(vert.uv[1] * height) % height  # UV.v -> Y in image
        y = int(vert.uv[0] * width) % width    # UV.u -> X in image
        
        # Pixel index (4 floats per pixel: RGBA)
        pixel_idx = (x * width + y) * 4
        
        r = pixels[pixel_idx]
        g = pixels[pixel_idx + 1]
        b = pixels[pixel_idx + 2]
        a = pixels[pixel_idx + 3]
        
        vert_values[i].color = (r, g, b, a)
        
        # Collect samples
        if len(sample_colors) < 10:
            sample_colors.append((round(r, 3), round(g, 3), round(b, 3)))
    
    mesh.vertex_colors.active = vert_color_layer
    
    print(f"  [BAKE] Transferred {len(uv_layer)} vertices")
    print(f"  [BAKE] Sample colors: {sample_colors}")
    
    return True

def solidify_vertex_colors(obj):
    """Average vertex colors per face for solid/flat shading (no gradients)."""
    ensure_object_mode()
    bpy.context.view_layer.objects.active = obj
    
    mesh = obj.data
    
    if not mesh.vertex_colors:
        print(f"  [SOLIDIFY] No vertex colors to solidify")
        return False
    
    vcol_layer = mesh.vertex_colors.active
    vcol_data = vcol_layer.data
    
    print(f"  [SOLIDIFY] Averaging vertex colors per face...")
    
    # For each polygon, calculate average color and apply to all its loops
    unique_colors_before = set()
    unique_colors_after = set()
    
    for poly in mesh.polygons:
        # Get all loop colors for this polygon
        loop_colors = []
        for loop_idx in poly.loop_indices:
            c = vcol_data[loop_idx].color
            loop_colors.append(c)
            unique_colors_before.add((round(c[0], 3), round(c[1], 3), round(c[2], 3)))
        
        # Calculate average color
        avg_r = sum(c[0] for c in loop_colors) / len(loop_colors)
        avg_g = sum(c[1] for c in loop_colors) / len(loop_colors)
        avg_b = sum(c[2] for c in loop_colors) / len(loop_colors)
        avg_a = sum(c[3] for c in loop_colors) / len(loop_colors)
        
        # Apply average color to all loops in this polygon
        for loop_idx in poly.loop_indices:
            vcol_data[loop_idx].color = (avg_r, avg_g, avg_b, avg_a)
        
        unique_colors_after.add((round(avg_r, 3), round(avg_g, 3), round(avg_b, 3)))
    
    print(f"  [SOLIDIFY] Unique colors: {len(unique_colors_before)} → {len(unique_colors_after)}")
    print(f"  [SOLIDIFY] Each face now has solid color (no gradients)")
    
    return True

def bake_texture_to_vertex_colors(obj):
    """Bake texture to vertex colors - tries direct transfer first, then Cycles."""
    ensure_object_mode()
    bpy.context.view_layer.objects.active = obj
    
    mesh = obj.data
    
    # Check for UVs
    if not mesh.uv_layers or len(mesh.uv_layers) == 0:
        print(f"  [BAKE] WARNING: No UV layers, cannot bake")
        return False
    
    # Check for material
    if not obj.data.materials or len(obj.data.materials) == 0:
        print(f"  [BAKE] WARNING: No material to bake from")
        return False
    
    print(f"  [BAKE] Attempting texture-to-vertex-color transfer...")
    
    # Method 1: Direct UV-to-pixel sampling (most reliable, like working addon)
    if bake_texture_to_vertex_colors_manual(obj):
        if verify_vertex_colors_populated(obj):
            print(f"  [BAKE] SUCCESS: Direct transfer worked!")
            return True
        else:
            print(f"  [BAKE] Direct transfer produced no colors, trying Cycles...")
    else:
        print(f"  [BAKE] Direct transfer failed, trying Cycles bake...")
    
    # Method 2: Cycles bake (fallback)
    # Create vertex color layer if needed
    if not mesh.vertex_colors:
        mesh.vertex_colors.new(name="Col")
    mesh.vertex_colors.active = mesh.vertex_colors[0]
    
    # Save current render settings
    scene = bpy.context.scene
    original_engine = scene.render.engine
    original_samples = getattr(scene.cycles, 'samples', 1) if hasattr(scene, 'cycles') else 1
    
    try:
        print(f"  [BAKE] Switching to Cycles...")
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = 1
        
        # Configure bake settings
        scene.cycles.bake_type = 'EMIT'  # Try EMIT instead of DIFFUSE (captures raw texture)
        scene.render.bake.use_pass_direct = False
        scene.render.bake.use_pass_indirect = False
        scene.render.bake.use_pass_color = True
        scene.render.bake.target = 'VERTEX_COLORS'
        
        print(f"  [BAKE] Bake settings: EMIT → Vertex Colors")
        
        # Select only this object
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        
        print(f"  [BAKE] Baking with Cycles...")
        bpy.ops.object.bake()
        
        if verify_vertex_colors_populated(obj):
            print(f"  [BAKE] SUCCESS: Cycles bake worked!")
            return True
        else:
            print(f"  [BAKE] FAILED: Both methods produced no colors")
            return False
        
    except Exception as e:
        print(f"  [BAKE] Cycles error: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        scene.render.engine = original_engine
        if hasattr(scene, 'cycles'):
            scene.cycles.samples = original_samples

def setup_vertex_color_material(obj):
    """Create a material that uses vertex colors (node-based method)."""
    ensure_object_mode()
    bpy.context.view_layer.objects.active = obj
    
    mesh = obj.data
    
    # Must have vertex colors
    if not mesh.vertex_colors:
        print(f"  [V MATERIAL] No vertex colors, cannot create material")
        return False
    
    # Remove existing materials
    while len(obj.data.materials) > 0:
        obj.data.materials.pop(index=0)
    
    # Create new vertex color material
    mat = bpy.data.materials.new(name=f"{obj.name}_VC")
    mat.use_nodes = True
    
    # Clear default nodes
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    
    # Create Vertex Color node
    vc_node = nodes.new('ShaderNodeVertexColor')
    vc_node.layer_name = mesh.vertex_colors.active.name
    
    # Create Principled BSDF
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.7
    bsdf.inputs['Metallic'].default_value = 0.0
    
    # Create Material Output
    output = nodes.new('ShaderNodeOutputMaterial')
    
    # Link: Vertex Color → Base Color
    links.new(vc_node.outputs['Color'], bsdf.inputs['Base Color'])
    # Link: BSDF → Output
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    # Position nodes
    vc_node.location = (-400, 0)
    bsdf.location = (-100, 0)
    output.location = (200, 0)
    
    # Assign material to mesh
    obj.data.materials.append(mat)
    
    print(f"  [V MATERIAL] Created vertex color material")
    return True

def optimize_mesh(obj):
    """Run all optimization steps on a single mesh object."""
    print(f"\n[OPTIMIZING] {obj.name}")
    
    # Step 1: Merge by distance
    if MERGE_DISTANCE > 0:
        merge_by_distance(obj, MERGE_DISTANCE)
        print(f"  [CLEANUP] Merged vertices by distance ({MERGE_DISTANCE})")
    
    # Step 2: Recalculate normals
    if RECALC_NORMALS:
        recalculate_normals(obj)
        print(f"  [NORMALS] Recalculated (outside)")
    
    # Step 3: Delete loose geometry
    delete_loose(obj)
    print(f"  [CLEANUP] Deleted loose geometry")
    
    # Step 4: Delete degenerate faces
    delete_degenerate(obj)
    print(f"  [CLEANUP] Removed degenerate faces")
    
    # Step 5: Fill holes
    if FILL_HOLES:
        fill_holes(obj)
        print(f"  [HOLES] Attempted to fill holes")
    
    # Step 6: Check non-manifold
    if CHECK_NON_MANIFOLD:
        non_manifold = count_non_manifold(obj)
        if non_manifold > 0:
            print(f"  [WARNING] {non_manifold} non-manifold elements found (holes, doubles, or internal faces)")
        else:
            print(f"  [MANIFOLD] Geometry is clean")
    
    # Step 7: Bake texture to vertex colors (if enabled)
    if BAKE_TEXTURE_TO_VERTEX_COLORS:
        if bake_texture_to_vertex_colors(obj):
            # Solidify vertex colors (remove gradients, make solid per face)
            if SOLIDIFY_VERTEX_COLORS:
                solidify_vertex_colors(obj)
            # Now set up vertex color material
            setup_vertex_color_material(obj)
        else:
            print(f"  [BAKE] Keeping original textured material")
    
    # Step 8: Vertex color mode (for pre-painted models)
    elif VERTEX_COLOR_MODE:
        if has_vertex_colors(obj):
            if SOLIDIFY_VERTEX_COLORS:
                solidify_vertex_colors(obj)
            setup_vertex_color_material(obj)
            print(f"  [VCOLOR] Replaced textures with vertex color material")
        else:
            print(f"  [VCOLOR] WARNING: No vertex colors found, keeping textured material")

def run_optimization_pipeline():
    """Run the full optimization pipeline on selected meshes."""
    meshes = get_selected_mesh_objects()
    
    if not meshes:
        print("\n[ERROR] No mesh objects selected!")
        print("Select one or more meshes in the viewport, then run this script again.")
        return False
    
    print("\n" + "="*60)
    print("SPACE-OM-ICIDE MODEL OPTIMIZER")
    print("="*60)
    
    # Initial stats
    initial_tris = count_total_triangles(meshes)
    print(f"\n[BEFORE] {len(meshes)} selected mesh(es), {initial_tris} triangles")
    
    # Optimize each mesh
    for obj in meshes:
        optimize_mesh(obj)
    
    # Apply decimation if target specified
    if TARGET_TRIS is not None and DECIMATE_MODE == "TARGET":
        print(f"\n[DECIMATION] Target: {TARGET_TRIS} tris")
        for obj in meshes:
            apply_decimate(obj, target_tris=TARGET_TRIS)
    elif DECIMATE_MODE == "RATIO":
        print(f"\n[DECIMATION] Ratio: {DECIMATE_RATIO}")
        for obj in meshes:
            apply_decimate(obj, ratio=DECIMATE_RATIO)
    else:
        print(f"\n[DECIMATION] Skipped (no target specified)")
    
    # Post-decimation cleanup (degenerate faces can appear after decimate)
    for obj in meshes:
        delete_degenerate(obj)
    
    # Apply transforms
    if APPLY_TRANSFORMS:
        print(f"\n[TRANSFORMS] Applying to all meshes...")
        for obj in meshes:
            apply_all_transforms(obj)
    
    # Set origin to bottom
    if SET_ORIGIN_TO_BOTTOM:
        print(f"\n[ORIGIN] Setting to bottom for all meshes...")
        # If multiple objects, parent them first or just set individually
        for obj in meshes:
            set_origin_to_bottom(obj)
    
    # Final stats
    final_tris = count_total_triangles(meshes)
    reduction = (1 - final_tris / initial_tris) * 100 if initial_tris > 0 else 0
    
    print("\n" + "="*60)
    print("[RESULTS]")
    print(f"  Initial:   {initial_tris} triangles")
    print(f"  Final:     {final_tris} triangles")
    print(f"  Reduction: {reduction:.1f}%")
    print("="*60)
    
    # Complexity rating
    if final_tris <= 200:
        rating = "PROP ✅"
    elif final_tris <= 600:
        rating = "ENEMY ✅"
    elif final_tris <= 1500:
        rating = "SCENERY ✅"
    elif final_tris <= 3000:
        rating = "BOSS ⚠️"
    elif final_tris <= 6000:
        rating = "HEAVY ⚠️ (consider more decimation)"
    else:
        rating = "TOO HEAVY ❌ (must decimate more)"
    
    print(f"  Rating:    {rating}")
    print("="*60)
    
    return True

def export_gltf_dialog(meshes):
    """Open the glTF export file browser dialog for the given meshes."""
    print(f"\n[EXPORT] Opening glTF export dialog for {len(meshes)} selected mesh(es)...")
    
    # Select only the optimized meshes for export
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:
        obj.select_set(True)
    
    # Use Blender's built-in export operator (opens file browser)
    # The operator automatically shows the file save dialog
    bpy.ops.export_scene.gltf(
        'INVOKE_DEFAULT',  # Opens dialog for user interaction
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_materials='EXPORT',
        export_image_format='JPEG',  # or 'PNG' for lossless
        export_extras=True,
        export_colors='MATERIAL',    # CRITICAL: Export vertex colors (use MATERIAL for vertex color materials)
    )

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    """Main entry point."""
    meshes = get_selected_mesh_objects()
    
    if not meshes:
        print("\n" + "="*60)
        print("[ERROR] No meshes selected!")
        print("="*60)
        print("\nSelect one or more mesh objects in the viewport,")
        print("then run this script again.")
        return
    
    success = run_optimization_pipeline()
    
    if success:
        # Get the optimized meshes (they should still be selected)
        optimized_meshes = get_selected_mesh_objects()
        
        # Small delay to let UI update, then open export dialog
        def open_export_dialog():
            export_gltf_dialog(optimized_meshes)
            return None  # Don't repeat
        
        # Register timer to open dialog after script completes
        bpy.app.timers.register(open_export_dialog, first_interval=0.1)
    else:
        print("\n[ABORTED] Optimization failed.")

# Run it!
main()
