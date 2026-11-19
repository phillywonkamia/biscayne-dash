# BISCAYNE DASH — the world, built by Blender from code.
# Run:  blender -b --python build_world.py
# Out:  assets/world.glb  (every game piece)  +  assets/blender_preview.png (Blender's own render)
#       assets/world.blend (open it in Blender and look around)
import bpy, math, os, random

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'assets')
random.seed(305)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# ------------------------------------------------------------ materials
def mat(name, color, emit=0.0, metal=0.0, rough=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    if emit:
        p.inputs['Emission Color'].default_value = (*color, 1)
        p.inputs['Emission Strength'].default_value = emit
    return m

PINK   = mat('CandyPink',  (1.0, 0.08, 0.45), metal=0.6, rough=0.25)
CHROME = mat('Chrome',     (0.9, 0.9, 0.95),  metal=1.0, rough=0.1)
GLASS  = mat('Glass',      (0.02, 0.03, 0.06), metal=0.3, rough=0.05)
TIRE   = mat('Tire',       (0.02, 0.02, 0.02), rough=0.9)
HEAD   = mat('Headlight',  (1.0, 0.95, 0.8), emit=8)
TAIL   = mat('Taillight',  (1.0, 0.0, 0.05), emit=6)
COP_B  = mat('CopBlack',   (0.03, 0.03, 0.03), metal=0.5, rough=0.3)
COP_W  = mat('CopWhite',   (0.9, 0.9, 0.9), rough=0.4)
SIREN_R= mat('SirenRed',   (1.0, 0.0, 0.0), emit=12)
SIREN_B= mat('SirenBlue',  (0.0, 0.2, 1.0), emit=12)
TEAL   = mat('Teal',       (0.0, 0.55, 0.6), metal=0.5, rough=0.3)
TRUNK  = mat('PalmTrunk',  (0.25, 0.16, 0.08), rough=0.9)
LEAF   = mat('PalmLeaf',   (0.05, 0.35, 0.1), rough=0.7)
COIN   = mat('GECoin',     (0.1, 1.0, 0.35), emit=6, metal=0.8)
ASPH   = mat('Asphalt',    (0.04, 0.04, 0.05), metal=0.2, rough=0.35)
LINE   = mat('LaneLine',   (1.0, 0.85, 0.2), emit=1.5)
WALK   = mat('Sidewalk',   (0.18, 0.18, 0.2), rough=0.8)
NEONS  = [mat('NeonPink', (1.0, 0.1, 0.6), emit=10), mat('NeonCyan', (0.0, 0.9, 1.0), emit=10),
          mat('NeonPurple', (0.6, 0.1, 1.0), emit=10), mat('NeonOrange', (1.0, 0.45, 0.0), emit=10)]
WALLS  = [mat('Wall1', (0.08, 0.07, 0.12)), mat('Wall2', (0.12, 0.09, 0.1)), mat('Wall3', (0.06, 0.09, 0.1))]
WINDOW = mat('Window', (1.0, 0.8, 0.5), emit=3)

# ------------------------------------------------------------ helpers
def box(name, size, loc, m, parent=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object; o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = o.modifiers.new('bev', 'BEVEL'); b.width = bevel; b.segments = 3
    o.data.materials.append(m)
    if parent: o.parent = parent
    return o

def cyl(name, r, depth, loc, m, rot=(0, 0, 0), parent=None, verts=24):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.object; o.name = name
    o.data.materials.append(m)
    if parent: o.parent = parent
    return o

def root(name, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None); sc.collection.objects.link(e); e.location = loc
    return e

# Blender is Z-up; the glTF exporter converts to Y-up for the browser. Car faces -Y here (= forward in game).
def car(name, body, top, x=0, lights=True, siren=False):
    r = root(name, (x, 0, 0))
    box(name + '_Body', (1.9, 4.6, 0.55), (x, 0, 0.6), body, r, bevel=0.12)
    box(name + '_Cabin', (1.7, 2.3, 0.5), (x, 0.3, 1.1), top, r, bevel=0.15)
    box(name + '_Glass', (1.72, 2.0, 0.36), (x, 0.3, 1.12), GLASS, r)
    box(name + '_BumperF', (1.95, 0.15, 0.18), (x, -2.32, 0.45), CHROME, r)
    box(name + '_BumperR', (1.95, 0.15, 0.18), (x, 2.32, 0.45), CHROME, r)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(name + '_Tire', 0.42, 0.32, (x + sx * 0.92, sy * 1.45, 0.42), TIRE, (0, math.pi / 2, 0), r)
            cyl(name + '_Rim', 0.26, 0.34, (x + sx * 0.92, sy * 1.45, 0.42), CHROME, (0, math.pi / 2, 0), r)
        if lights:
            box(name + '_Head', (0.4, 0.06, 0.16), (x + sx * 0.62, -2.31, 0.68), HEAD, r)
            box(name + '_Tail', (0.45, 0.06, 0.14), (x + sx * 0.6, 2.31, 0.68), TAIL, r)
    if siren:
        box(name + '_SirenR', (0.6, 0.25, 0.14), (x - 0.32, 0.3, 1.42), SIREN_R, r)
        box(name + '_SirenB', (0.6, 0.25, 0.14), (x + 0.32, 0.3, 1.42), SIREN_B, r)
    return r

def palm(name, x):
    r = root(name, (x, 0, 0))
    for i in range(7):  # leaning, segmented trunk
        cyl(name + '_Trunk', 0.22 - i * 0.015, 1.2, (x + i * 0.09, 0, 0.6 + i * 1.15), TRUNK, (0, 0.08, 0), r, verts=10)
    tip = (x + 0.65, 0, 8.3)
    for k in range(8):  # fronds
        a = k * math.tau / 8
        f = box(name + '_Frond', (0.35, 3.0, 0.05), (tip[0] + math.cos(a) * 1.3, tip[1] + math.sin(a) * 1.3, tip[2] - 0.35), LEAF, r)
        f.rotation_euler = (-0.5, 0, a - math.pi / 2)
    return r

def building(name, x, w, d, h, wall, neon):
    r = root(name, (x, 0, 0))
    box(name + '_Wall', (w, d, h), (x, 0, h / 2), wall, r)
    face = -1 if x > 0 else 1   # windows face the road
    rows, cols = int(h // 3), int(d // 2.5)
    for i in range(rows):
        for j in range(cols):
            if random.random() < 0.55:
                box(name + '_Win', (0.05, 1.2, 1.3), (x + face * w / 2, -d / 2 + 1.25 + j * 2.5, 2 + i * 3), WINDOW, r)
    box(name + '_NeonTop', (0.15, d * 0.9, 0.3), (x + face * (w / 2 + 0.1), 0, h - 0.6), neon, r)
    box(name + '_NeonSign', (0.2, d * 0.5, 1.4), (x + face * (w / 2 + 0.2), 0, h * 0.45), neon, r)
    return r

# ------------------------------------------------------------ the pieces
car('Player', PINK, PINK)                      # the candy-pink ride
car('Traffic_Teal', TEAL, TEAL, x=6)           # civilian
car('Traffic_Cop', COP_B, COP_W, x=12, siren=True)   # Miami-Dade's finest
palm('Palm', -9)
for i, (w, d, h) in enumerate([(8, 14, 18), (9, 12, 30), (7, 16, 12)]):
    building('Building_%d' % i, -20 - i * 12, w, d, h, WALLS[i], NEONS[i])

c = root('Coin', (0, -8, 0))
o = cyl('Coin_Disc', 0.55, 0.12, (0, -8, 1.2), COIN, (math.pi / 2, 0, 0), c, verts=32)

# one road tile (40 m), the game repeats it forever
t = root('RoadTile', (0, 20, 0))
box('Road_Asphalt', (14, 40, 0.1), (0, 20, -0.05), ASPH, t)
for lx in (-2.33, 2.33):
    for k in range(5):
        box('Road_Dash', (0.15, 3, 0.02), (lx, 20 - 16 + k * 8, 0.01), LINE, t)
for sx in (-1, 1):
    box('Road_Walk', (4, 40, 0.3), (sx * 9, 20, 0.15), WALK, t)
    box('Road_Curb', (0.25, 40, 0.32), (sx * 7.1, 20, 0.16), CHROME, t)

# put every piece back on the origin so the game can place them
for o in bpy.data.objects:
    if o.parent is None and o.type == 'EMPTY':
        dx, dy = o.location.x, o.location.y
        o.location = (0, 0, 0)
        for ch in o.children:
            ch.location.x -= dx; ch.location.y -= dy

# apply bevels, export
for o in bpy.data.objects:
    if o.type == 'MESH' and o.modifiers:
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)

os.makedirs(OUT, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'world.glb'), export_format='GLB', export_yup=True)

# ------------------------------------------------------------ Blender's own beauty shot of the "toybox"
lay = {'Player': (0, 0), 'Traffic_Teal': (-3.2, 7), 'Traffic_Cop': (3.2, 12), 'Palm': (-9, 4),
       'Building_0': (-14, 10), 'Building_1': (15, 22), 'Building_2': (-14, 26), 'Coin': (0, -6), 'RoadTile': (0, -8)}
for n, (x, y) in lay.items():
    o = bpy.data.objects[n]; o.location = (x, y, 0)
    if n.startswith('Building_1'): o.rotation_euler = (0, 0, math.pi)
w = bpy.data.worlds.new('night'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.01, 0.005, 0.03, 1)
cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (7, -14, 5.5); cam.rotation_euler = (math.radians(74), 0, math.radians(28)); cam.data.lens = 26
sun = bpy.data.objects.new('Moon', bpy.data.lights.new('Moon', 'SUN')); sc.collection.objects.link(sun)
sun.data.energy = 0.4; sun.data.color = (0.5, 0.6, 1.0); sun.rotation_euler = (0.8, 0.3, 0.5)
sc.render.engine = 'BLENDER_EEVEE_NEXT'
try:
    sc.eevee.use_bloom = True
except Exception:
    pass
sc.render.resolution_x, sc.render.resolution_y = 1600, 900
sc.render.filepath = os.path.join(OUT, 'blender_preview.png')
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'world.blend'))
print('BISCAYNE DASH: world built')
