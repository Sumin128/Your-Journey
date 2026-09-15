"""Build the deterministic, game-ready Mirelons Jagd die as a dependency-free GLB."""

import json
import math
import struct
from pathlib import Path

OUT = Path(__file__).parents[2] / "images" / "mirelons-jagd" / "wuerfel.glb"
HALF = 0.5
BEVEL = 0.075
INNER = HALF - BEVEL
SEG = 8


def normalized(v):
    length = math.sqrt(sum(c * c for c in v))
    return tuple(c / length for c in v)


class Geometry:
    def __init__(self):
        self.positions = []
        self.normals = []
        self.indices = []

    def vertex(self, p, n):
        self.positions.append(tuple(p))
        self.normals.append(normalized(n))
        return len(self.positions) - 1

    def triangle(self, a, b, c):
        pa, pb, pc = self.positions[a], self.positions[b], self.positions[c]
        ab = tuple(pb[i] - pa[i] for i in range(3))
        ac = tuple(pc[i] - pa[i] for i in range(3))
        cross = (
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0],
        )
        n = tuple(sum(self.normals[x][i] for x in (a, b, c)) for i in range(3))
        if sum(cross[i] * n[i] for i in range(3)) < 0:
            b, c = c, b
        self.indices.extend((a, b, c))

    def quad(self, p0, p1, p2, p3, normal):
        ids = [self.vertex(p, normal) for p in (p0, p1, p2, p3)]
        self.triangle(ids[0], ids[1], ids[2])
        self.triangle(ids[0], ids[2], ids[3])


def build_body():
    g = Geometry()
    # Six flat face centers.
    g.quad((HALF, -INNER, -INNER), (HALF, INNER, -INNER), (HALF, INNER, INNER), (HALF, -INNER, INNER), (1, 0, 0))
    g.quad((-HALF, -INNER, INNER), (-HALF, INNER, INNER), (-HALF, INNER, -INNER), (-HALF, -INNER, -INNER), (-1, 0, 0))
    g.quad((-INNER, HALF, -INNER), (-INNER, HALF, INNER), (INNER, HALF, INNER), (INNER, HALF, -INNER), (0, 1, 0))
    g.quad((-INNER, -HALF, INNER), (-INNER, -HALF, -INNER), (INNER, -HALF, -INNER), (INNER, -HALF, INNER), (0, -1, 0))
    g.quad((-INNER, -INNER, HALF), (INNER, -INNER, HALF), (INNER, INNER, HALF), (-INNER, INNER, HALF), (0, 0, 1))
    g.quad((INNER, -INNER, -HALF), (-INNER, -INNER, -HALF), (-INNER, INNER, -HALF), (INNER, INNER, -HALF), (0, 0, -1))

    # Twelve rounded edges.
    for axis in range(3):
        other = [i for i in range(3) if i != axis]
        for s1 in (-1, 1):
            for s2 in (-1, 1):
                rings = []
                for step in range(SEG + 1):
                    angle = step * math.pi / (2 * SEG)
                    n = [0.0, 0.0, 0.0]
                    n[other[0]] = s1 * math.cos(angle)
                    n[other[1]] = s2 * math.sin(angle)
                    row = []
                    for along in (-INNER, INNER):
                        p = [0.0, 0.0, 0.0]
                        p[axis] = along
                        p[other[0]] = s1 * INNER + BEVEL * n[other[0]]
                        p[other[1]] = s2 * INNER + BEVEL * n[other[1]]
                        row.append(g.vertex(p, n))
                    rings.append(row)
                for step in range(SEG):
                    a, b = rings[step]
                    c, d = rings[step + 1]
                    g.triangle(a, b, d)
                    g.triangle(a, d, c)

    # Eight rounded corners.
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                grid = []
                for ti in range(SEG + 1):
                    theta = ti * math.pi / (2 * SEG)
                    row = []
                    for pi in range(SEG + 1):
                        phi = pi * math.pi / (2 * SEG)
                        n = (
                            sx * math.sin(theta) * math.cos(phi),
                            sy * math.sin(theta) * math.sin(phi),
                            sz * math.cos(theta),
                        )
                        p = (sx * INNER + BEVEL * n[0], sy * INNER + BEVEL * n[1], sz * INNER + BEVEL * n[2])
                        row.append(g.vertex(p, n))
                    grid.append(row)
                for ti in range(SEG):
                    for pi in range(SEG):
                        a, b = grid[ti][pi], grid[ti][pi + 1]
                        c, d = grid[ti + 1][pi], grid[ti + 1][pi + 1]
                        g.triangle(a, b, d)
                        g.triangle(a, d, c)
    return g


PIPS = {
    1: [(0, 0)],
    2: [(-1, 1), (1, -1)],
    3: [(-1, 1), (0, 0), (1, -1)],
    4: [(-1, -1), (-1, 1), (1, -1), (1, 1)],
    5: [(-1, -1), (-1, 1), (0, 0), (1, -1), (1, 1)],
    6: [(-1, -1), (-1, 0), (-1, 1), (1, -1), (1, 0), (1, 1)],
}


def add_disk(g, center, normal, u, v, radius, segments=20):
    center_id = g.vertex(center, normal)
    rim = []
    for i in range(segments):
        a = i * 2 * math.pi / segments
        p = tuple(center[j] + radius * (math.cos(a) * u[j] + math.sin(a) * v[j]) for j in range(3))
        rim.append(g.vertex(p, normal))
    for i in range(segments):
        g.triangle(center_id, rim[i], rim[(i + 1) % segments])


def build_pips(radius, lift):
    g = Geometry()
    # Opposites: 1/6, 2/5, 3/4.
    faces = [
        (1, (0, 1, 0), (1, 0, 0), (0, 0, -1)),
        (6, (0, -1, 0), (1, 0, 0), (0, 0, 1)),
        (2, (1, 0, 0), (0, 0, -1), (0, 1, 0)),
        (5, (-1, 0, 0), (0, 0, 1), (0, 1, 0)),
        (3, (0, 0, 1), (1, 0, 0), (0, 1, 0)),
        (4, (0, 0, -1), (-1, 0, 0), (0, 1, 0)),
    ]
    spacing = 0.19
    for value, n, u, v in faces:
        surface = HALF + lift
        for px, py in PIPS[value]:
            center = tuple(n[j] * surface + u[j] * px * spacing + v[j] * py * spacing for j in range(3))
            add_disk(g, center, n, u, v, radius)
    return g


class Buffer:
    def __init__(self):
        self.data = bytearray()
        self.views = []
        self.accessors = []

    def add(self, raw, target):
        while len(self.data) % 4:
            self.data.append(0)
        offset = len(self.data)
        self.data.extend(raw)
        self.views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(raw), "target": target})
        return len(self.views) - 1

    def accessor(self, values, component_type, kind, target, minimum=None, maximum=None):
        if component_type == 5126:
            raw = b"".join(struct.pack("<" + "f" * len(v), *v) for v in values)
        else:
            flat = [x for v in values for x in (v if isinstance(v, tuple) else (v,))]
            raw = struct.pack("<" + "H" * len(flat), *flat)
        view = self.add(raw, target)
        acc = {"bufferView": view, "componentType": component_type, "count": len(values), "type": kind}
        if minimum is not None:
            acc["min"] = minimum
            acc["max"] = maximum
        self.accessors.append(acc)
        return len(self.accessors) - 1


def primitive(buffer, geometry, material):
    mins = [min(p[i] for p in geometry.positions) for i in range(3)]
    maxs = [max(p[i] for p in geometry.positions) for i in range(3)]
    pos = buffer.accessor(geometry.positions, 5126, "VEC3", 34962, mins, maxs)
    nor = buffer.accessor(geometry.normals, 5126, "VEC3", 34962)
    idx = buffer.accessor([(i,) for i in geometry.indices], 5123, "SCALAR", 34963)
    return {"attributes": {"POSITION": pos, "NORMAL": nor}, "indices": idx, "material": material}


def main():
    body = build_body()
    ring = build_pips(0.073, 0.002)
    gold = build_pips(0.058, 0.003)
    buffer = Buffer()
    doc = {
        "asset": {"version": "2.0", "generator": "Mirelon deterministic die builder"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "MirelonWuerfel"}],
        "meshes": [{"name": "MirelonWuerfel", "primitives": [
            primitive(buffer, body, 0), primitive(buffer, ring, 1), primitive(buffer, gold, 2)
        ]}],
        "materials": [
            {"name": "Elfenbein", "pbrMetallicRoughness": {"baseColorFactor": [0.94, 0.86, 0.67, 1], "metallicFactor": 0.0, "roughnessFactor": 0.34}},
            {"name": "PunktRand", "pbrMetallicRoughness": {"baseColorFactor": [0.19, 0.09, 0.025, 1], "metallicFactor": 0.15, "roughnessFactor": 0.35}},
            {"name": "Honiggold", "pbrMetallicRoughness": {"baseColorFactor": [0.88, 0.52, 0.08, 1], "metallicFactor": 0.45, "roughnessFactor": 0.24}},
        ],
        "buffers": [{"byteLength": len(buffer.data)}],
        "bufferViews": buffer.views,
        "accessors": buffer.accessors,
        "extras": {"game": "Mirelons Jagd", "oppositeFaces": [[1, 6], [2, 5], [3, 4]], "units": "1 meter cube before runtime scaling"},
    }
    json_bytes = json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    while len(json_bytes) % 4:
        json_bytes += b" "
    while len(buffer.data) % 4:
        buffer.data.append(0)
    total = 12 + 8 + len(json_bytes) + 8 + len(buffer.data)
    glb = struct.pack("<4sII", b"glTF", 2, total)
    glb += struct.pack("<II", len(json_bytes), 0x4E4F534A) + json_bytes
    glb += struct.pack("<II", len(buffer.data), 0x004E4942) + bytes(buffer.data)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(glb)
    print(OUT)
    print(f"vertices={len(body.positions)+len(ring.positions)+len(gold.positions)} triangles={(len(body.indices)+len(ring.indices)+len(gold.indices))//3} bytes={len(glb)}")


if __name__ == "__main__":
    main()
