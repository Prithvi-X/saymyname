"""
Production-Ready Blender 4.x Python Scene Builder for SayMyName Hero Sculpture
Asset: 3D-01 — "Two Lights Across the Interval"
Authoritative Brand Language: Document 10 (THE INTERVAL) — Mineral Night Palette

Usage when Blender is available:
  blender -b -P build_two_lights_scene.py
Produces:
  two-lights.blend (packed) + 16-bit PNG Cycles renders for AVIF/WebP mastering.
"""

import math
import os

try:
    import bpy
    import bmesh
except ImportError as exc:
    raise SystemExit(
        "This script must be executed inside Blender (`blender -b -P build_two_lights_scene.py`)."
    ) from exc


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def create_ceramic_basalt_material(name="CeramicBasalt"):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.014, 0.017, 0.022, 1.0)  # Deep Mineral Charcoal
    bsdf.inputs["Roughness"].default_value = 0.72
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.42

    tex_coord = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 42.0
    noise.inputs["Detail"].default_value = 8.0
    noise.inputs["Roughness"].default_value = 0.65

    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[0].color = (0.64, 0.64, 0.64, 1.0)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (0.82, 0.82, 0.82, 1.0)

    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.035
    bump.inputs["Distance"].default_value = 0.002

    links.new(tex_coord.outputs["Object"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Roughness"])
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def create_warm_alloy_material(name="BrushedEmberAlloy"):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.76, 0.41, 0.25, 1.0)  # Warm Ember Brushed Alloy
    bsdf.inputs["Metallic"].default_value = 0.92
    bsdf.inputs["Roughness"].default_value = 0.34
    return mat


def build_monolith(name, size_xyz, location_xyz, rot_z_deg, mat_body, mat_bevel):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location_xyz)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size_xyz
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler = (0.0, 0.0, math.radians(rot_z_deg))

    bevel = obj.modifiers.new(name="ArchitecturalBevel", type="BEVEL")
    bevel.width = 0.035
    bevel.segments = 4
    bevel.limit_method = "ANGLE"

    obj.data.materials.append(mat_body)
    obj.data.materials.append(mat_bevel)
    bpy.ops.object.shade_smooth()
    return obj


def setup_scene():
    clear_scene()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 256
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"

    # Mineral Night World Stage (#0B0D10 calibrated linear)
    world = bpy.data.worlds.new("MineralNightWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.004, 0.005, 0.007, 1.0)
    bg.inputs["Strength"].default_value = 1.0

    mat_body = create_ceramic_basalt_material()
    mat_alloy = create_warm_alloy_material()

    # Asymmetric Two Lights Monoliths separated by the deliberate interval
    build_monolith("LeftMonolith", (0.72, 0.62, 2.25), (-0.49, 0.08, 1.125), 7.5, mat_body, mat_alloy)
    build_monolith("RightMonolith", (0.78, 0.66, 2.48), (0.50, -0.06, 1.24), -5.0, mat_body, mat_alloy)

    # Dark Obsidian Ground Floor for real contact shadow
    bpy.ops.mesh.primitive_plane_add(size=24.0, location=(0.0, 0.0, 0.0))
    floor = bpy.context.active_object
    floor.name = "StageFloor"
    floor_mat = bpy.data.materials.new("StageSlateFloor")
    floor_mat.use_nodes = True
    bsdf = floor_mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.007, 0.009, 0.012, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.85
    floor.data.materials.append(floor_mat)

    # Primary Ember Interval Key Light recessed slightly behind gap
    bpy.ops.object.light_add(type="AREA", location=(0.02, 0.72, 1.25))
    ember_key = bpy.context.active_object
    ember_key.name = "EmberIntervalKey"
    ember_key.data.shape = "RECTANGLE"
    ember_key.data.size = 0.22
    ember_key.data.size_y = 1.85
    ember_key.data.color = (0.92, 0.50, 0.32)  # Ember #E18A62 temperature
    ember_key.data.energy = 68.0
    ember_key.rotation_euler = (math.radians(-90), 0.0, math.radians(180))

    # Restrained Iris Rim Fill (Left Edge Silhouette Separation)
    bpy.ops.object.light_add(type="AREA", location=(-2.4, -1.6, 2.2))
    iris_rim = bpy.context.active_object
    iris_rim.name = "IrisSilhouetteRim"
    iris_rim.data.size = 1.4
    iris_rim.data.color = (0.52, 0.50, 0.82)  # Iris #8580C4
    iris_rim.data.energy = 24.0
    iris_rim.rotation_euler = (math.radians(62), 0.0, math.radians(-52))

    # Camera Framing
    bpy.ops.object.camera_add(location=(0.14, -4.35, 1.32), rotation=(math.radians(88.5), 0.0, math.radians(2.0)))
    cam = bpy.context.active_object
    cam.data.lens = 68.0
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = 4.35
    cam.data.dof.aperture_fstop = 4.0
    scene.camera = cam

    out_dir = os.path.dirname(os.path.abspath(__file__))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "two-lights.blend"))

    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_depth = "16"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 1320
    scene.render.filepath = os.path.join(out_dir, "two-lights-desktop-master.png")
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    setup_scene()
