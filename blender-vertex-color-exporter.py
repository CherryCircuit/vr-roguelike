"""
Blender Vertex Color Model Exporter
====================================
Bakes textures to vertex colors and exports selected meshes as individual GLBs.

Usage:
  1. Select one or more mesh objects
  2. Run this script (Alt+P in Text Editor)
  3. Choose export folder when prompted
  4. Each selected mesh exports as a separate .glb file

Requirements:
  - Objects must have UV maps (for texture baking)
  - Objects must have materials with texture nodes
  - Blender 5.0+ (uses color_attributes, not vertex_colors)

What it does:
  1. Cleans geometry (merge doubles, recalc normals, triangulate)
  2. Bakes texture colors to vertex colors (EMIT mode = raw color, no lighting)
  3. Solidifies colors per face (removes gradient banding)
  4. Connects vertex color attribute to material Base Color
  5. Removes image texture nodes (no textures needed)
  6. Exports each object as GLB with vertex colors only

Output:
  - Clean GLBs with no textures, no UVs, just vertex colors
  - Perfect for low-poly VR games (Quest-friendly file sizes)
"""

import bpy
import bmesh
import os

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

CONFIG = {
    'color_attr_name': "Col",       # Vertex color attribute name
    'merge_distance': 0.0001,       # Vertex merge threshold
    'triangulate': True,            # Convert quads/ngons to tris
    'solidify_colors': True,        # Average vertex colors per face
    'flat_shading': True,           # Disable smooth shading
}

# Legacy names for backward compatibility
COLOR_ATTR_NAME = CONFIG['color_attr_name']
MERGE_DISTANCE = CONFIG['merge_distance']


def ensure_object_mode():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')


def get_selected_mesh_objects():
    objs = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    if not objs:
        raise Exception("Select one or more mesh objects first.")
    return objs


def ensure_material(obj):
    if not obj.data.materials:
        mat = bpy.data.materials.new(name=f"{obj.name}_Material")
        mat.use_nodes = True
        obj.data.materials.append(mat)

    mat = obj.active_material
    if mat is None:
        mat = obj.data.materials[0]

    if mat.users > 1:
        mat = mat.copy()
        for i, slot in enumerate(obj.material_slots):
            if slot.material:
                obj.material_slots[i].material = mat
        obj.active_material = mat

    mat.use_nodes = True
    return mat


def ensure_color_attribute(mesh, name):
    attrs = mesh.color_attributes

    if name in attrs:
        attr = attrs[name]
    else:
        attr = attrs.new(name=name, type='BYTE_COLOR', domain='CORNER')

    try:
        attrs.active_color = attr
    except Exception:
        pass

    try:
        attrs.active = attr
    except Exception:
        pass

    try:
        for i, a in enumerate(attrs):
            if a.name == name:
                if hasattr(attrs, "active_color_index"):
                    attrs.active_color_index = i
                if hasattr(attrs, "active_index"):
                    attrs.active_index = i
                break
    except Exception:
        pass

    return attr


def find_principled_bsdf(mat):
    nt = mat.node_tree
    if not nt:
        return None
    for node in nt.nodes:
        if node.type == 'BSDF_PRINCIPLED':
            return node
    return None


def remove_image_texture_nodes(mat):
    nt = mat.node_tree
    if not nt:
        return
    for node in list(nt.nodes):
        if node.type == 'TEX_IMAGE':
            nt.nodes.remove(node)


def connect_color_attribute_to_base_color(mat, attr_name):
    nt = mat.node_tree
    if not nt:
        return

    bsdf = find_principled_bsdf(mat)
    if not bsdf:
        raise Exception(f"No Principled BSDF found in material '{mat.name}'.")

    attr_node = None
    for node in nt.nodes:
        if node.type == 'ATTRIBUTE' and getattr(node, "attribute_name", "") == attr_name:
            attr_node = node
            break

    if attr_node is None:
        attr_node = nt.nodes.new("ShaderNodeAttribute")
        attr_node.attribute_name = attr_name
        attr_node.name = f"VC_{attr_name}"
        attr_node.location = (bsdf.location.x - 300, bsdf.location.y)

    base_color_input = bsdf.inputs.get("Base Color")
    if base_color_input is None:
        raise Exception("Could not find Base Color input.")

    for link in list(base_color_input.links):
        nt.links.remove(link)

    nt.links.new(attr_node.outputs["Color"], base_color_input)

    out = None
    for node in nt.nodes:
        if node.type == 'OUTPUT_MATERIAL':
            out = node
            break

    if out is not None:
        surf = out.inputs.get("Surface")
        if surf:
            has_bsdf_link = any(link.from_node == bsdf for link in surf.links)
            if not has_bsdf_link:
                for link in list(surf.links):
                    nt.links.remove(link)
                nt.links.new(bsdf.outputs["BSDF"], surf)


def setup_emit_bake_material(mat):
    nt = mat.node_tree
    bsdf = find_principled_bsdf(mat)
    if not bsdf:
        raise Exception(f"No Principled BSDF found in material '{mat.name}'.")

    out = None
    for node in nt.nodes:
        if node.type == 'OUTPUT_MATERIAL':
            out = node
            break
    if out is None:
        out = nt.nodes.new("ShaderNodeOutputMaterial")

    emit = nt.nodes.get("__TEMP_EMIT_BAKE__")
    if emit is None:
        emit = nt.nodes.new("ShaderNodeEmission")
        emit.name = "__TEMP_EMIT_BAKE__"

    emit.location = (out.location.x - 250, out.location.y)

    base_color_input = bsdf.inputs.get("Base Color")
    if base_color_input is None:
        raise Exception("Could not find Base Color input.")

    for link in list(emit.inputs["Color"].links):
        nt.links.remove(link)

    if base_color_input.links:
        src_socket = base_color_input.links[0].from_socket
        nt.links.new(src_socket, emit.inputs["Color"])
    else:
        emit.inputs["Color"].default_value = base_color_input.default_value

    for link in list(out.inputs["Surface"].links):
        nt.links.remove(link)
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])


def cleanup_geometry(obj, merge_distance=MERGE_DISTANCE):
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)

    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=merge_distance)

    faces = list(bm.faces)
    if faces:
        bmesh.ops.recalc_face_normals(bm, faces=faces)

    faces = list(bm.faces)
    if faces:
        bmesh.ops.triangulate(
            bm,
            faces=faces,
            quad_method='BEAUTY',
            ngon_method='BEAUTY'
        )

    bm.to_mesh(mesh)
    bm.free()

    try:
        mesh.normals_split_custom_set_from_vertices([])
    except Exception:
        pass

    for poly in mesh.polygons:
        poly.use_smooth = False

    mesh.update()


def bake_object_to_vertex_colors_emit(obj):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'

    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    scene.cycles.bake_type = 'EMIT'
    scene.render.bake.target = 'VERTEX_COLORS'

    bpy.ops.object.bake(type='EMIT')


def solidify_face_colors(obj, attr_name):
    mesh = obj.data
    attr = mesh.color_attributes.get(attr_name)
    if attr is None:
        raise Exception(f"Color attribute '{attr_name}' not found on {obj.name}.")
    if attr.domain != 'CORNER':
        raise Exception(f"Color attribute '{attr_name}' must be CORNER domain.")

    data = attr.data

    for poly in mesh.polygons:
        loop_indices = poly.loop_indices
        if not loop_indices:
            continue

        r = g = b = a = 0.0
        count = len(loop_indices)

        for li in loop_indices:
            c = data[li].color
            r += c[0]
            g += c[1]
            b += c[2]
            a += c[3]

        avg = (r / count, g / count, b / count, a / count)

        for li in loop_indices:
            data[li].color = avg

    mesh.update()


def process_object(obj):
    if not obj.data.uv_layers:
        print(f"Skipping {obj.name}: no UV map")
        return False

    cleanup_geometry(obj)

    mat = ensure_material(obj)
    ensure_color_attribute(obj.data, COLOR_ATTR_NAME)

    setup_emit_bake_material(mat)
    bake_object_to_vertex_colors_emit(obj)
    solidify_face_colors(obj, COLOR_ATTR_NAME)

    connect_color_attribute_to_base_color(mat, COLOR_ATTR_NAME)
    remove_image_texture_nodes(mat)

    for poly in obj.data.polygons:
        poly.use_smooth = False

    print(f"Processed: {obj.name}")
    return True


class EXPORT_OT_vertex_color_glbs(bpy.types.Operator):
    bl_idname = "export_scene.vertex_color_glbs"
    bl_label = "Export Selected Objects as Individual Clean GLBs"
    bl_options = {'REGISTER', 'UNDO'}

    directory: bpy.props.StringProperty(
        name="Export Folder",
        subtype='DIR_PATH'
    )

    def execute(self, context):
        ensure_object_mode()
        original_selection = list(context.selected_objects)
        original_active = context.view_layer.objects.active

        mesh_objects = [o for o in original_selection if o.type == 'MESH']
        if not mesh_objects:
            self.report({'ERROR'}, "No mesh objects selected.")
            return {'CANCELLED'}

        exported_count = 0

        for obj in mesh_objects:
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)
            context.view_layer.objects.active = obj

            safe_name = bpy.path.clean_name(obj.name)
            filepath = os.path.join(self.directory, f"{safe_name}.glb")

            bpy.ops.export_scene.gltf(
                filepath=filepath,
                export_format='GLB',
                use_selection=True,
                export_texcoords=False,
                export_normals=True,
                export_tangents=False,
                export_materials='EXPORT',
                export_image_format='NONE',
                export_vertex_color='ACTIVE',
            )

            exported_count += 1

        bpy.ops.object.select_all(action='DESELECT')
        for obj in original_selection:
            obj.select_set(True)
        if original_active:
            context.view_layer.objects.active = original_active

        self.report({'INFO'}, f"Exported {exported_count} GLB files.")
        return {'FINISHED'}

    def invoke(self, context, event):
        context.window_manager.fileselect_add(self)
        return {'RUNNING_MODAL'}


def register_export_operator():
    try:
        bpy.utils.register_class(EXPORT_OT_vertex_color_glbs)
    except ValueError:
        pass


def run_all():
    ensure_object_mode()
    objs = get_selected_mesh_objects()

    processed = 0
    for obj in objs:
        try:
            if process_object(obj):
                processed += 1
        except Exception as e:
            print(f"Failed on {obj.name}: {e}")

    print(f"Finished processing {processed} object(s).")

    register_export_operator()
    bpy.ops.export_scene.vertex_color_glbs('INVOKE_DEFAULT')


run_all()