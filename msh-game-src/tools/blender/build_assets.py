# Build the world props in Blender and export them as GLB for the Three.js game.
#
#   /tmp/blendenv/bin/python tools/blender/build_assets.py            # export all
#   /tmp/blendenv/bin/python tools/blender/build_assets.py --preview  # + Cycles contact sheet
#
# Conventions (glTF side): Y-up, metres, origin at ground-centre (y=0 is the ground),
# "front" faces +Z.  Blender is Z-up and the exporter maps Blender (x, y, z) -> glTF
# (x, z, -y), so in this script the FRONT of an asset is Blender -Y.
# Materials: Principled base colour only, no image textures (project rule).

import bpy, bmesh, math, os, random, sys
from mathutils import Vector, Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'src', 'assets', 'models')
os.makedirs(OUT, exist_ok=True)
PREVIEW = '--preview' in sys.argv
TAU = math.pi * 2


# ---------------------------------------------------------------- helpers
def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexcol(h):
    h = h.lstrip('#')
    return tuple(srgb_to_lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)


_mats = {}


def mat(name, hexc, metallic=0.0, rough=0.85, double=False):
    key = (name, hexc, metallic, rough, double)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = hexcol(hexc)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = rough
    m.diffuse_color = hexcol(hexc)
    m.use_backface_culling = not double
    _mats[key] = m
    return m


def obj_from_bm(name, bm, material, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    if material is not None:
        o.data.materials.append(material)
    return o


def box(name, size, loc, material, rot=(0, 0, 0), bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect='EDGES')
    o = obj_from_bm(name, bm, material)
    o.location = loc
    o.rotation_euler = rot
    return o


def cyl(name, r1, r2, depth, loc, material, segs=12, rot=(0, 0, 0), caps=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=segs,
                          radius1=r1, radius2=r2, depth=depth)
    o = obj_from_bm(name, bm, material)
    o.location = loc
    o.rotation_euler = rot
    return o


def torus(name, R, r, loc, material, maj=32, mino=5, rot=(0, 0, 0)):
    bm = bmesh.new()
    verts = []
    for i in range(maj):
        a = i / maj * TAU
        ring = []
        for j in range(mino):
            b = j / mino * TAU
            x = (R + r * math.cos(b)) * math.cos(a)
            y = (R + r * math.cos(b)) * math.sin(a)
            z = r * math.sin(b)
            ring.append(bm.verts.new((x, y, z)))
        verts.append(ring)
    for i in range(maj):
        for j in range(mino):
            a, b = verts[i][j], verts[(i + 1) % maj][j]
            c, d = verts[(i + 1) % maj][(j + 1) % mino], verts[i][(j + 1) % mino]
            bm.faces.new((a, b, c, d))
    o = obj_from_bm(name, bm, material)
    o.location = loc
    o.rotation_euler = rot
    return o


def lathe(name, profile, material, segs=24, cap_top=False, cap_bottom=False, jitter=0.0, seed=0):
    """Surface of revolution around Z from a list of (radius, z)."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    rings = []
    for (r, z) in profile:
        ring = []
        for i in range(segs):
            a = i / segs * TAU
            rr = r * (1 + (rnd.uniform(-jitter, jitter) if r > 1e-4 else 0))
            ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(segs):
            a, b = rings[k][i], rings[k][(i + 1) % segs]
            c, d = rings[k + 1][(i + 1) % segs], rings[k + 1][i]
            try:
                bm.faces.new((a, b, c, d))
            except ValueError:
                pass
    if cap_top:
        bm.faces.new(list(reversed(rings[-1])))
    if cap_bottom:
        bm.faces.new(rings[0])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, material)


def ico(name, radius, loc, material, subdiv=1, jitter=0.0, scale=(1, 1, 1), seed=0):
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    for v in bm.verts:
        v.co *= 1 + rnd.uniform(-jitter, jitter)
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    o = obj_from_bm(name, bm, material)
    o.location = loc
    return o


def strip_along(name, pts, width, material, up=Vector((0, 0, 1)), thick=0.02):
    """Flat strap following a polyline (e.g. a rope over the ger roof)."""
    bm = bmesh.new()
    left, right = [], []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        side = t.cross(up).normalized() * (width / 2)
        left.append(bm.verts.new(p + side))
        right.append(bm.verts.new(p - side))
    for i in range(len(pts) - 1):
        bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if thick:
        res = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
        nv = [e for e in res['geom'] if isinstance(e, bmesh.types.BMVert)]
        for v in nv:
            v.co += v.normal * -thick if False else Vector((0, 0, 0))
    o = obj_from_bm(name, bm, material)
    o.data.materials[0].use_backface_culling = False
    return o


def cone_between(name, p_top, p_bot, r_top, r_bot, material, segs=5):
    """Tapered strand from p_top (radius r_top) to p_bot (radius r_bot)."""
    d = p_bot - p_top
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=segs, radius1=r_bot, radius2=r_top, depth=d.length)
    o = obj_from_bm(name, bm, material)
    o.location = (p_top + p_bot) / 2
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, -1)).rotation_difference(d.normalized())
    return o


def join(name, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o


def ground(o, recenter=True):
    """Shift mesh so the bbox bottom is z=0 and (optionally) the xy centre is the origin."""
    me = o.data
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    dx = -(min(xs) + max(xs)) / 2 if recenter else 0
    dy = -(min(ys) + max(ys)) / 2 if recenter else 0
    dz = -min(zs)
    for v in me.vertices:
        v.co += Vector((dx, dy, dz))
    o.location = (0, 0, 0)
    return o


def export(o, name):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_apply=True,
        export_yup=True, export_materials='EXPORT', export_cameras=False, export_lights=False,
        export_animations=False, export_skins=False, export_morph=False, export_texcoords=False,
        export_normals=True, export_tangents=False, export_vertex_color='ACTIVE',
        export_image_format='NONE')
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    print(f'  {name}.glb  {os.path.getsize(path) / 1024:.1f} KB  {tris} tris')
    return path


# ---------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
for m in list(bpy.data.materials):
    bpy.data.materials.remove(m)

FELT = mat('Felt', '#ece4d2')
FELT_SHADE = mat('FeltShade', '#d9cfb9')
ROPE = mat('Rope', '#4a3524')
WOOD = mat('Wood', '#8a6a44')
WOOD_DARK = mat('WoodDark', '#5c3e24')
WOOD_CART = mat('WoodCart', '#7a5532')
DOOR = mat('DoorPaint', '#b5452d')
ORNAMENT = mat('Ornament', '#e3b04b')
METAL = mat('Metal', '#3b3b3e', metallic=0.6, rough=0.5)
STEEL = mat('Steel', '#b9b6ae', metallic=0.8, rough=0.35)
OPENING = mat('Opening', '#2c2018')

built = {}

# ================================================================ 1. ger
parts = []
R, WALL = 3.0, 1.7
# felt wall with a slight outward belly; bottom skirt slightly darker
parts.append(lathe('wall', [(2.97, 0.0), (3.02, 0.6), (3.03, 1.2), (3.0, WALL)], FELT, segs=28))
skirt = lathe('skirt', [(3.0, 0.0), (3.035, 0.22)], FELT_SHADE, segs=28)
parts.append(skirt)
# domed roof from the eave to the crown
roof_prof = [(3.18, WALL - 0.04), (2.75, 2.0), (2.15, 2.33), (1.45, 2.62), (0.62, 2.86)]
parts.append(lathe('roof', roof_prof, FELT, segs=28))
# wooden eave trim and crown ring (toono) with the smoke opening
parts.append(torus('eave', 3.07, 0.05, (0, 0, WALL - 0.02), WOOD, maj=36, mino=4))
parts.append(torus('toono', 0.6, 0.08, (0, 0, 2.88), WOOD, maj=20, mino=5))
parts.append(cyl('opening', 0.56, 0.56, 0.04, (0, 0, 2.86), OPENING, segs=20))
# chimney pipe ~0.9 m above the crown, with a small cap
parts.append(cyl('pipe', 0.09, 0.09, 1.55, (0.25, 0.1, 2.98), METAL, segs=10))
parts.append(cyl('pipecap', 0.16, 0.05, 0.12, (0.25, 0.1, 3.8), METAL, segs=10))
# three rope bands around the wall, two on the roof
for z in (0.42, 0.98, 1.5):
    parts.append(torus(f'band{z}', 3.06, 0.035, (0, 0, z), ROPE, maj=40, mino=4))


def roof_r(z):
    for (r1, z1), (r2, z2) in zip(roof_prof, roof_prof[1:]):
        if z1 <= z <= z2:
            k = (z - z1) / (z2 - z1)
            return r1 + (r2 - r1) * k
    return roof_prof[-1][0]


for z in (2.1, 2.5):
    parts.append(torus(f'rband{z}', roof_r(z) + 0.03, 0.03, (0, 0, z), ROPE, maj=36, mino=4))
# crossing straps over the roof (pairs of diagonals between bands)
for i in range(8):
    a = i / 8 * TAU + TAU / 16
    pts = []
    for k in range(9):
        z = WALL + (2.86 - WALL) * k / 8
        r = roof_r(z) + 0.035
        aa = a + (k / 8) * 0.35
        pts.append(Vector((r * math.cos(aa), r * math.sin(aa), z)))
    parts.append(strip_along(f'strap{i}', pts, 0.06, ROPE))
# door on the front (Blender -Y), frame, lintel, ornament, step
dy = -3.06
parts.append(box('doorframe', (1.12, 0.14, 1.66), (0, dy, 0.83), WOOD_DARK, bevel=0.01))
parts.append(box('door', (0.9, 0.1, 1.46), (0, dy - 0.04, 0.75), DOOR, bevel=0.01))
parts.append(box('lintel', (1.3, 0.18, 0.12), (0, dy - 0.02, 1.68), WOOD_DARK, bevel=0.01))
parts.append(box('doorsplit', (0.04, 0.03, 1.4), (0, dy - 0.1, 0.75), WOOD_DARK))
# endless-knot style ornament: a diamond of bars with little loops at the corners
oz, oy = 0.98, dy - 0.11
for k in range(4):
    a = k * math.pi / 2 + math.pi / 4
    cx, cz = math.cos(a) * 0.12, math.sin(a) * 0.12
    parts.append(box(f'orn{k}', (0.24, 0.03, 0.035), (cx, oy, oz + cz), ORNAMENT, rot=(0, -a + math.pi / 2, 0)))
    parts.append(torus(f'loop{k}', 0.05, 0.014, (math.cos(a - math.pi / 4) * 0.2, oy, oz + math.sin(a - math.pi / 4) * 0.2),
                       ORNAMENT, maj=10, mino=3, rot=(math.pi / 2, 0, 0)))
parts.append(box('ornX', (0.03, 0.03, 0.22), (0, oy, oz), ORNAMENT))
parts.append(box('ornZ', (0.22, 0.03, 0.03), (0, oy, oz), ORNAMENT))
parts.append(box('step', (1.3, 0.42, 0.1), (0, dy - 0.22, 0.05), WOOD, bevel=0.015))
ger = join('ger', parts)
ground(ger, recenter=False)
built['ger'] = ger

# ================================================================ 2. cart (тэрэг)
parts = []
WHEEL_R = 0.65
for sx in (-1, 1):
    x = sx * 0.78
    parts.append(torus(f'rim{sx}', WHEEL_R - 0.04, 0.05, (x, 0.2, WHEEL_R), WOOD_DARK, maj=24, mino=4, rot=(0, math.pi / 2, 0)))
    parts.append(cyl(f'hub{sx}', 0.11, 0.11, 0.2, (x, 0.2, WHEEL_R), WOOD_DARK, segs=10, rot=(0, math.pi / 2, 0)))
    for k in range(10):
        a = k / 10 * TAU
        parts.append(box(f'spoke{sx}{k}', (0.05, 0.05, WHEEL_R - 0.08),
                         (x, 0.2 + math.sin(a) * (WHEEL_R - 0.08) / 2, WHEEL_R + math.cos(a) * (WHEEL_R - 0.08) / 2),
                         WOOD_CART, rot=(a, 0, 0)))
parts.append(cyl('axle', 0.05, 0.05, 1.75, (0, 0.2, WHEEL_R), WOOD_DARK, segs=8, rot=(0, math.pi / 2, 0)))
# bed: planks + side rails
for k in range(6):
    parts.append(box(f'plank{k}', (1.3, 0.28, 0.06), (0, 0.95 - k * 0.3, WHEEL_R + 0.18), WOOD_CART, bevel=0.008))
for sx in (-1, 1):
    parts.append(box(f'rail{sx}', (0.07, 1.85, 0.12), (sx * 0.64, 0.2, WHEEL_R + 0.3), WOOD_DARK, bevel=0.01))
    for k in range(4):
        parts.append(box(f'stake{sx}{k}', (0.06, 0.06, 0.32), (sx * 0.64, 0.95 - k * 0.5, WHEEL_R + 0.3), WOOD_DARK))
# long shafts sloping down to the ground in front (Blender -Y)
for sx in (-1, 1):
    p0, p1 = Vector((sx * 0.45, -0.7, WHEEL_R + 0.12)), Vector((sx * 0.3, -3.1, 0.38))
    d = p1 - p0
    o = box(f'shaft{sx}', (0.08, d.length, 0.08), (p0 + p1) / 2, WOOD_DARK)
    o.rotation_euler = (math.atan2(d.z, -d.y) * -1, 0, math.atan2(d.x, -d.y))
    parts.append(o)
parts.append(box('yoke', (0.9, 0.08, 0.08), (0, -3.0, 0.42), WOOD_DARK))
parts.append(box('prop', (0.06, 0.06, 0.42), (0, -2.95, 0.2), WOOD_DARK))
cart = join('cart', parts)
ground(cart)
built['cart'] = cart

# ================================================================ 3. tug (war banner)
parts = []
POLE = 3.2
HAIR_B = mat('Horsehair', '#1d1916', rough=0.95)
HAIR_W = mat('HorsehairWhite', '#e9e4da', rough=0.95)
parts.append(cyl('pole', 0.04, 0.032, POLE, (0, 0, POLE / 2), WOOD_DARK, segs=8))
parts.append(cyl('collar', 0.07, 0.07, 0.08, (0, 0, POLE - 0.02), STEEL, segs=10))
parts.append(cyl('blade', 0.05, 0.0, 0.42, (0, 0, POLE + 0.23), STEEL, segs=4))
for sx in (-1, 1):  # trident side prongs curving up
    parts.append(box(f'arm{sx}', (0.16, 0.025, 0.025), (sx * 0.08, 0, POLE + 0.06), STEEL))
    parts.append(cyl(f'prong{sx}', 0.025, 0.0, 0.24, (sx * 0.16, 0, POLE + 0.17), STEEL, segs=4, rot=(0, sx * -0.2, 0)))
parts.append(ico('knob', 0.075, (0, 0, POLE - 0.1), STEEL, subdiv=1))
rnd = random.Random(7)
for k in range(72):  # big drooping horsehair tassel hanging below the blade
    a = rnd.uniform(0, TAU)
    r0 = rnd.uniform(0.03, 0.11)
    r1 = r0 + rnd.uniform(0.08, 0.24)
    L = rnd.uniform(0.5, 0.8)
    top = Vector((math.cos(a) * r0, math.sin(a) * r0, POLE - 0.16 - rnd.uniform(0, 0.06)))
    bot = Vector((math.cos(a) * r1, math.sin(a) * r1, top.z - L))
    m = HAIR_W if k % 5 == 0 else HAIR_B
    parts.append(cone_between(f'hair{k}', top, bot, rnd.uniform(0.03, 0.05), 0.004, m, segs=4))
parts.append(torus('hairring', 0.075, 0.03, (0, 0, POLE - 0.17), STEEL, maj=12, mino=4))
tug = join('tug', parts)
ground(tug)
built['tug'] = tug

# ================================================================ 4. rocks
ROCK1 = mat('Rock', '#9a8f88')
ROCK2 = mat('RockDark', '#8a7f7a')
ROCK_MOSS = mat('RockMoss', '#7c8a4a')
for name, size, scl, seed in (('rock_a', 0.8, (1.15, 1.0, 0.95), 3), ('rock_b', 1.1, (1.0, 0.85, 0.85), 11), ('rock_c', 1.4, (1.25, 1.05, 0.72), 21)):
    rnd = random.Random(seed)
    bm = bmesh.new()
    # convex hull of jittered points on an ellipsoid -> clean faceted boulder, no craters
    pts = []
    for i in range(26):
        u, v = rnd.uniform(-1, 1), rnd.uniform(0, TAU)
        r = math.sqrt(1 - u * u)
        p = Vector((r * math.cos(v) * scl[0], r * math.sin(v) * scl[1], u * scl[2])) * (size / 2) * rnd.uniform(0.85, 1.05)
        pts.append(p)
    zmin = min(p.z for p in pts)
    cut = zmin + size * scl[2] * 0.12
    for p in pts:
        if p.z < cut:
            p.z = cut  # flat base
    for p in pts:
        bm.verts.new(p)
    res = bmesh.ops.convex_hull(bm, input=bm.verts)
    junk = {e for e in list(res['geom_interior']) + list(res['geom_unused']) if isinstance(e, bmesh.types.BMVert)}
    if junk:
        bmesh.ops.delete(bm, geom=list(junk), context='VERTS')
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(6), verts=bm.verts, edges=bm.edges)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj_from_bm(name, bm, ROCK1 if seed % 2 else ROCK2)
    o.data.materials.append(ROCK_MOSS)
    # mossy tops: faces pointing up get the moss material
    for p in o.data.polygons:
        if p.normal.z > 0.82 and rnd.random() < 0.7:
            p.material_index = 1
    ground(o)
    built[name] = o

# ================================================================ 5. fence
parts = []
FENCE_POST = mat('FencePost', '#7a5c3e')
FENCE_RAIL = mat('FenceRail', '#8c6d4c')
rnd = random.Random(5)
for k, x in enumerate((-2.0, 0.0, 2.0)):
    parts.append(box(f'post{k}', (0.12, 0.12, 1.15), (x, 0, 0.575), FENCE_POST, rot=(rnd.uniform(-0.05, 0.05), rnd.uniform(-0.05, 0.05), rnd.uniform(0, 0.4)), bevel=0.012))
    parts.append(cyl(f'cap{k}', 0.07, 0.05, 0.06, (x, 0, 1.17), FENCE_POST, segs=6))
for k, z in enumerate((0.45, 0.88)):
    parts.append(box(f'rail{k}', (4.1, 0.07, 0.09), (0, -0.07, z), FENCE_RAIL, rot=(0, rnd.uniform(-0.02, 0.02), 0), bevel=0.01))
fence = join('fence', parts)
ground(fence)
built['fence'] = fence

# ================================================================ 6. woodpile
parts = []
LOG = mat('LogBark', '#6b4a2e')
LOG_END = mat('LogEnd', '#c9a273')
rnd = random.Random(9)
row_counts = [4, 3, 2, 1]
r = 0.1
for row, n in enumerate(row_counts):
    for i in range(n):
        x = (i - (n - 1) / 2) * (2 * r + 0.01)
        z = r + row * (2 * r * 0.87)
        o = cyl(f'log{row}{i}', r * rnd.uniform(0.9, 1.05), r * rnd.uniform(0.9, 1.05), 1.0 + rnd.uniform(-0.08, 0.08),
                (0, 0, 0), LOG, segs=8, rot=(math.pi / 2, 0, 0))
        o.data.materials.append(LOG_END)
        for p in o.data.polygons:  # cut ends (caps) get the pale end-grain material
            if abs(p.normal.z) > 0.9:
                p.material_index = 1
        o.location = (x - 0.25, rnd.uniform(-0.05, 0.05), z)
        o.rotation_euler = (math.pi / 2, 0, rnd.uniform(-0.06, 0.06))
        parts.append(o)
stump = cyl('stump', 0.24, 0.22, 0.42, (0.62, -0.05, 0.21), LOG, segs=10)
stump.data.materials.append(LOG_END)
for p in stump.data.polygons:
    if p.normal.z > 0.9:
        p.material_index = 1
parts.append(stump)
handle = box('handle', (0.04, 0.04, 0.6), (0.68, -0.05, 0.62), WOOD, rot=(0, 0.6, 0))
head = box('axehead', (0.16, 0.03, 0.1), (0.57, -0.05, 0.43), STEEL, rot=(0, 0.6, 0))
parts += [handle, head]
woodpile = join('woodpile', parts)
ground(woodpile)
built['woodpile'] = woodpile

# ================================================================ 7. pine
parts = []
NEEDLE1 = mat('Needles', '#3f5a2c')
NEEDLE2 = mat('NeedlesLight', '#4c6b33')
BARK = mat('Bark', '#5a3d27')
parts.append(cyl('trunk', 0.2, 0.06, 8.0, (0, 0, 4.0), BARK, segs=7))
tiers = [(1.5, 2.1, 2.7), (2.8, 1.75, 2.4), (4.0, 1.4, 2.1), (5.1, 1.05, 1.8), (6.1, 0.72, 1.5), (7.0, 0.42, 1.2)]
for k, (z, rad, h) in enumerate(tiers):
    o = lathe(f'tier{k}', [(rad, z), (rad * 0.82, z + 0.12), (0.0, z + h)], NEEDLE1 if k % 2 == 0 else NEEDLE2,
              segs=8, cap_bottom=True, jitter=0.12, seed=k + 1)
    o.rotation_euler = (0, 0, k * 0.4)
    parts.append(o)
pine = join('pine', parts)
ground(pine)
built['pine'] = pine

# ================================================================ 8. berry bush (мойл)
parts = []
LEAF1 = mat('Leaves', '#3d5a26')
LEAF2 = mat('LeavesLight', '#4f6f2e')
BERRY = mat('Berry', '#b3202a', rough=0.45)
BERRY_D = mat('BerryDark', '#6e1018', rough=0.45)
STEM = mat('Stem', '#5a3d27')
rnd = random.Random(13)
clusters = []
for k in range(7):
    a = k / 7 * TAU + rnd.uniform(-0.3, 0.3)
    rr = 0.18 if k else 0.0
    c = Vector((math.cos(a) * rr * 1.6, math.sin(a) * rr * 1.6, 0.42 + rnd.uniform(-0.05, 0.25)))
    if k == 0:
        c = Vector((0, 0, 0.62))
    s = rnd.uniform(0.24, 0.32)
    parts.append(ico(f'leaf{k}', s, c, LEAF1 if k % 2 else LEAF2, subdiv=1, jitter=0.25, scale=(1, 1, 0.8), seed=k + 30))
    parts.append(cyl(f'stem{k}', 0.025, 0.015, c.z, (c.x * 0.5, c.y * 0.5, c.z / 2), STEM, segs=5,
                     rot=(-c.y * 0.9, c.x * 0.9, 0)))
    clusters.append((c, s))
for k, (c, s) in enumerate(clusters):
    for j in range(rnd.randint(2, 3)):
        a, b = rnd.uniform(0, TAU), rnd.uniform(-0.2, 1.0)
        base = c + Vector((math.cos(a) * math.cos(b), math.sin(a) * math.cos(b), math.sin(b) * 0.7)) * s * 1.0
        for q in range(5):
            off = Vector((rnd.uniform(-0.05, 0.05), rnd.uniform(-0.05, 0.05), rnd.uniform(-0.07, 0.02)))
            parts.append(ico(f'berry{k}{j}{q}', 0.042, base + off, BERRY if q % 3 else BERRY_D, subdiv=0))
bush = join('berry_bush', parts)
ground(bush)
built['berry_bush'] = bush

# ================================================================ 9. grass clump (vertex colours, instanced)
GRASS = mat('Grass', '#ffffff', rough=0.9, double=True)
_attr = GRASS.node_tree.nodes.new('ShaderNodeVertexColor')
_attr.layer_name = 'COLOR_0'
GRASS.node_tree.links.new(_attr.outputs['Color'], GRASS.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
bm = bmesh.new()
col_layer = bm.loops.layers.color.new('COLOR_0')
base_c, tip_c = Vector(hexcol('#6f8a30')), Vector(hexcol('#c9b25a'))
rnd = random.Random(17)
for b in range(8):
    a = b / 8 * TAU + rnd.uniform(-0.3, 0.3)
    h = rnd.uniform(0.38, 0.55)
    w = rnd.uniform(0.035, 0.05)
    lean = rnd.uniform(0.15, 0.35)
    ox, oy = math.cos(a) * 0.04, math.sin(a) * 0.04
    dirv = Vector((math.cos(a), math.sin(a), 0))
    side = Vector((-math.sin(a), math.cos(a), 0))
    rows = []
    for k in range(3):
        t = k / 3
        c = Vector((ox, oy, 0)) + dirv * (lean * h * t * t) + Vector((0, 0, h * t))
        ww = w * (1 - t * 0.8)
        rows.append((bm.verts.new(c + side * ww), bm.verts.new(c - side * ww), t))
    tip = bm.verts.new(Vector((ox, oy, 0)) + dirv * lean * h + Vector((0, 0, h)))
    for k in range(2):
        (a1, b1, _), (a2, b2, _) = rows[k], rows[k + 1]
        bm.faces.new((a1, b1, b2, a2))
    bm.faces.new((rows[2][0], rows[2][1], tip))
bm.verts.ensure_lookup_table()
hmax = max(v.co.z for v in bm.verts)
for f in bm.faces:
    for l in f.loops:
        t = l.vert.co.z / hmax
        c = base_c.lerp(tip_c, t)
        l[col_layer] = (c.x, c.y, c.z, 1.0)
grass = obj_from_bm('grass_clump', bm, GRASS, smooth=True)
grass.data.color_attributes.active_color = grass.data.color_attributes['COLOR_0']
ground(grass)
built['grass_clump'] = grass

# ================================================================ 10. saddle
parts = []
SEAT = mat('SaddleSeat', '#8e2a24')
BLANKET = mat('SaddleBlanket', '#6e2220')
TRIM = mat('SaddleTrim', '#d6a35e')
SWOOD = mat('SaddleWood', '#6a4426')
STRAP = mat('Strap', '#3b2416')
parts.append(box('blanket', (0.34, 0.78, 0.03), (0, 0, 0.015), BLANKET, bevel=0.006))
for sx in (-1, 1):
    ang = sx * math.radians(55)
    cx = sx * (0.17 + math.cos(math.radians(55)) * 0.15)
    cz = 0.015 - math.sin(math.radians(55)) * 0.15
    parts.append(box(f'flap{sx}', (0.3, 0.78, 0.03), (cx, 0, cz), BLANKET, rot=(0, ang, 0), bevel=0.006))
    ex = sx * (0.17 + math.cos(math.radians(55)) * 0.3)
    ez = 0.015 - math.sin(math.radians(55)) * 0.3
    parts.append(box(f'trim{sx}', (0.035, 0.8, 0.035), (ex, 0, ez), TRIM))
for sx in (-1, 1):  # side bars of the wooden saddle tree
    parts.append(box(f'bar{sx}', (0.08, 0.6, 0.06), (sx * 0.14, 0, 0.06), SWOOD, bevel=0.01))
parts.append(box('seat', (0.34, 0.5, 0.09), (0, 0.02, 0.12), SEAT, bevel=0.025))
# high front pommel (front = Blender -Y) and lower cantle at the back
parts.append(box('pommel', (0.36, 0.07, 0.3), (0, -0.28, 0.2), SWOOD, bevel=0.02))
parts.append(cyl('pommelboss', 0.055, 0.055, 0.02, (0, -0.32, 0.25), TRIM, segs=10, rot=(math.pi / 2, 0, 0)))
parts.append(box('cantle', (0.34, 0.07, 0.22), (0, 0.29, 0.16), SWOOD, bevel=0.02))
for sx in (-1, 1):
    parts.append(box(f'leather{sx}', (0.025, 0.05, 0.42), (sx * 0.24, 0.0, -0.13), STRAP))
    parts.append(torus(f'stirrup{sx}', 0.065, 0.015, (sx * 0.245, 0.0, -0.38), STEEL, maj=12, mino=4, rot=(0, math.pi / 2, 0)))
    parts.append(box(f'tread{sx}', (0.04, 0.12, 0.025), (sx * 0.245, 0.0, -0.44), STEEL))
saddle = join('saddle', parts)
# origin = seat underside centre: put the blanket bottom (z=0 before stirrups) at the origin
me = saddle.data
xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]
for v in me.vertices:
    v.co += Vector((-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, 0))
built['saddle'] = saddle

# ---------------------------------------------------------------- export
print('Exporting to', OUT)
for name, o in built.items():
    export(o, name)

# ---------------------------------------------------------------- preview contact sheet
if PREVIEW:
    layout = {
        'ger': (0, 4), 'cart': (-7.5, 3), 'tug': (6.3, 4.2), 'rock_a': (8.5, 1.0), 'rock_b': (9.9, 2.8),
        'rock_c': (10.6, 0.2), 'fence': (-4.2, -2.6), 'woodpile': (2.6, -2.4), 'pine': (-11.5, 6),
        'berry_bush': (5.0, -2.0), 'grass_clump': (6.4, -2.4), 'saddle': (-0.6, -2.6),
    }
    for name, (x, y) in layout.items():
        built[name].location = (x, y, 0.45 if name == 'saddle' else 0)
    for k in range(40):  # a little meadow of grass instances around the props
        g = built['grass_clump'].copy()
        g.location = (random.uniform(-12, 12), random.uniform(-4, -1), 0)
        g.rotation_euler = (0, 0, random.uniform(0, TAU))
        bpy.context.scene.collection.objects.link(g)
    bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0))
    gp = bpy.context.active_object
    gp.data.materials.append(mat('PreviewGround', '#8f9a5a'))
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 4.0
    sun.color = (1.0, 0.86, 0.68)
    so = bpy.data.objects.new('sun', sun)
    so.rotation_euler = (math.radians(55), 0, math.radians(-35))
    bpy.context.scene.collection.objects.link(so)
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.9, 0.62, 0.38, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    bpy.context.scene.world = world
    cam_d = bpy.data.cameras.new('cam')
    cam_d.lens = 32
    cam = bpy.data.objects.new('cam', cam_d)
    view = sys.argv[sys.argv.index('--view') + 1] if '--view' in sys.argv else 'front'
    if view == 'close':
        cam.location = (2.2, -9.0, 2.6)
        cam.rotation_euler = (math.radians(80), 0, math.radians(4))
        cam_d.lens = 38
    elif view == 'back':
        cam.location = (0, 22, 7.5)
        cam.rotation_euler = (math.radians(74), 0, math.radians(180))
    else:
        cam.location = (0, -20, 7.5)
        cam.rotation_euler = (math.radians(74), 0, 0)
    bpy.context.scene.collection.objects.link(cam)
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 16
    sc.cycles.use_denoising = False
    sc.render.resolution_x = 1400
    sc.render.resolution_y = 720
    sc.render.filepath = {'front': '/tmp/assets_preview.png', 'back': '/tmp/assets_preview_back.png', 'close': '/tmp/assets_preview_close.png'}[view]
    bpy.ops.render.render(write_still=True)
    print('preview ->', sc.render.filepath)
