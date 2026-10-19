#!/usr/bin/env python3
import os
import subprocess
from PIL import Image, ImageDraw, ImageFilter

def create_flowml_icon(size=1024):
    """
    Creates a high-resolution FlowML Studio logo & macOS icon.
    Deep obsidian/indigo squircle base with glowing multi-node AI pipeline circuit.
    """
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = size // 2, size // 2
    margin = int(size * 0.08)
    corner_radius = int(size * 0.22)

    # 1. Soft Shadow
    shadow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_layer)
    shadow_box = [margin, margin + 25, size - margin, size - margin + 25]
    s_draw.rounded_rectangle(shadow_box, radius=corner_radius, fill=(0, 0, 0, 160))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(32))
    img.alpha_composite(shadow_layer)

    # 2. Main Squircle Body with Deep Indigo/Obsidian Gradient
    base_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(base_layer)
    body_box = [margin, margin, size - margin, size - margin]
    b_draw.rounded_rectangle(body_box, radius=corner_radius, fill=(15, 23, 42, 255))

    # Gradient overlay
    for i in range(margin, size - margin):
        factor = (i - margin) / (size - 2 * margin)
        # Gradient from deep violet/indigo (24, 18, 56) to dark slate (11, 15, 29)
        r = int(28 + (12 - 28) * factor)
        g = int(22 + (15 - 22) * factor)
        b = int(66 + (28 - 66) * factor)
        b_draw.line([(margin, i), (size - margin, i)], fill=(r, g, b, 255))

    # Mask gradient to rounded squircle
    mask = Image.new("L", (size, size), 0)
    m_draw = ImageDraw.Draw(mask)
    m_draw.rounded_rectangle(body_box, radius=corner_radius, fill=255)
    base_layer.putalpha(mask)

    # Metallic / Neon Border Stroke
    b_draw = ImageDraw.Draw(base_layer)
    b_draw.rounded_rectangle(body_box, radius=corner_radius, outline=(124, 58, 237, 200), width=6)
    img.alpha_composite(base_layer)

    # 3. Pipeline Wire Connections & Glowing Circuit
    nodes = [
        (cx - 240, cy - 140), # 0: Data Ingest (Cyan)
        (cx + 240, cy - 140), # 1: Preprocess (Purple)
        (cx + 240, cy + 140), # 2: Evaluation / Metrics (Emerald)
        (cx - 240, cy + 140), # 3: Inference / Output (Amber)
    ]

    wire_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    w_draw = ImageDraw.Draw(wire_layer)

    connections = [(0, 1), (1, 2), (2, 3), (0, 3)]
    for n1, n2 in connections:
        p1 = nodes[n1]
        p2 = nodes[n2]
        # Multi-layer glow
        w_draw.line([p1, p2], fill=(124, 58, 237, 100), width=24)
        w_draw.line([p1, p2], fill=(6, 182, 212, 160), width=12)
        w_draw.line([p1, p2], fill=(255, 255, 255, 230), width=4)

    # Connect nodes to center
    for n in nodes:
        w_draw.line([n, (cx, cy)], fill=(99, 102, 241, 120), width=10)
        w_draw.line([n, (cx, cy)], fill=(255, 255, 255, 200), width=3)

    wire_layer = wire_layer.filter(ImageFilter.GaussianBlur(3))
    img.alpha_composite(wire_layer)

    # 4. Central Processor Core (AI Brain / Neural Hub)
    core_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    c_draw = ImageDraw.Draw(core_layer)

    # Central Core Squircle Plate
    core_box = [cx - 130, cy - 130, cx + 130, cy + 130]
    c_draw.rounded_rectangle(core_box, radius=36, fill=(18, 24, 46, 240), outline=(124, 58, 237, 230), width=5)

    inner_box = [cx - 90, cy - 90, cx + 90, cy + 90]
    c_draw.rounded_rectangle(inner_box, radius=24, fill=(30, 41, 75, 245), outline=(6, 182, 212, 220), width=4)

    # Geometric Circuit / Flow "F" & "ML" Motif
    c_draw.line([(cx - 48, cy - 48), (cx + 48, cy - 48)], fill=(255, 255, 255, 240), width=8)
    c_draw.line([(cx - 48, cy - 48), (cx - 48, cy + 48)], fill=(255, 255, 255, 240), width=8)
    c_draw.line([(cx - 48, cy), (cx + 24, cy)], fill=(124, 58, 237, 255), width=8)
    c_draw.line([(cx + 10, cy), (cx + 48, cy + 48)], fill=(6, 182, 212, 255), width=8)
    c_draw.line([(cx - 10, cy + 48), (cx + 48, cy + 48)], fill=(6, 182, 212, 255), width=8)

    # Radiant Center Pip
    c_draw.ellipse([cx - 12, cy - 12, cx + 12, cy + 12], fill=(255, 255, 255, 255))

    img.alpha_composite(core_layer)

    # 5. Pipeline Satellite Nodes
    node_colors = [
        (6, 182, 212),    # Node 0: Cyan
        (168, 85, 247),   # Node 1: Purple
        (16, 185, 129),   # Node 2: Emerald
        (245, 158, 11),   # Node 3: Amber
    ]

    node_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    nd_draw = ImageDraw.Draw(node_layer)

    for i, (nx, ny) in enumerate(nodes):
        nc = node_colors[i]
        # Outer glow
        nd_draw.ellipse([nx - 42, ny - 42, nx + 42, ny + 42], fill=(nc[0], nc[1], nc[2], 120))
        # Inner plate
        nd_draw.ellipse([nx - 28, ny - 28, nx + 28, ny + 28], fill=(15, 23, 42, 240), outline=(nc[0], nc[1], nc[2], 255), width=4)
        # White center pip
        nd_draw.ellipse([nx - 10, ny - 10, nx + 10, ny + 10], fill=(255, 255, 255, 255))

    img.alpha_composite(node_layer)

    # 6. Bottom Typography Banner: "FLOWML"
    txt_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    t_draw = ImageDraw.Draw(txt_layer)
    bar_y = cy + 280
    bar_w = 260
    t_draw.rounded_rectangle([cx - bar_w // 2, bar_y, cx + bar_w // 2, bar_y + 36], radius=18, fill=(15, 23, 42, 210), outline=(124, 58, 237, 200), width=2)
    # Circuit dots
    t_draw.ellipse([cx - 80, bar_y + 13, cx - 70, bar_y + 23], fill=(6, 182, 212, 255))
    t_draw.ellipse([cx + 70, bar_y + 13, cx + 80, bar_y + 23], fill=(124, 58, 237, 255))
    t_draw.line([(cx - 45, bar_y + 18), (cx + 45, bar_y + 18)], fill=(255, 255, 255, 220), width=4)

    img.alpha_composite(txt_layer)
    return img

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    assets_dir = os.path.join(base_dir, "assets")
    os.makedirs(assets_dir, exist_ok=True)

    print("Generating 1024x1024 FlowML Master Logo...")
    icon_1024 = create_flowml_icon(1024)
    icon_1024_path = os.path.join(assets_dir, "flowml_icon_1024.png")
    icon_1024.save(icon_1024_path, "PNG")

    icon_512 = icon_1024.resize((512, 512), Image.Resampling.LANCZOS)
    icon_512_path = os.path.join(assets_dir, "flowml_icon_512.png")
    icon_512.save(icon_512_path, "PNG")

    # Save to frontend public directory and electron folder
    frontend_public = os.path.join(base_dir, "Source Code", "frontend", "public")
    electron_dir = os.path.join(base_dir, "Source Code", "frontend", "electron")
    os.makedirs(frontend_public, exist_ok=True)
    os.makedirs(electron_dir, exist_ok=True)

    icon_1024.save(os.path.join(frontend_public, "app-icon.png"), "PNG")
    icon_512.save(os.path.join(electron_dir, "icon.png"), "PNG")
    print(f"Saved icons to frontend/public and electron/")

    # Generate macOS iconset for iconutil
    iconset_dir = os.path.join(assets_dir, "FlowML.iconset")
    os.makedirs(iconset_dir, exist_ok=True)

    sizes = [
        ("icon_16x16.png", 16),
        ("icon_16x16@2x.png", 32),
        ("icon_32x32.png", 32),
        ("icon_32x32@2x.png", 64),
        ("icon_128x128.png", 128),
        ("icon_128x128@2x.png", 256),
        ("icon_256x256.png", 256),
        ("icon_256x256@2x.png", 512),
        ("icon_512x512.png", 512),
        ("icon_512x512@2x.png", 1024),
    ]

    for fname, sz in sizes:
        resized = icon_1024.resize((sz, sz), Image.Resampling.LANCZOS)
        resized.save(os.path.join(iconset_dir, fname), "PNG")

    # Run iconutil to compile FlowML.icns
    icns_path = os.path.join(assets_dir, "FlowML.icns")
    cmd = ["iconutil", "-c", "icns", iconset_dir, "-o", icns_path]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0:
        print(f"Successfully compiled native macOS icon: {icns_path}")
    else:
        print(f"iconutil warning: {res.stderr}")

    # Copy to Mac Desktop App Bundle
    desktop_app_resources = "/Users/kush/Desktop/FlowML Studio.app/Contents/Resources"
    if os.path.exists(desktop_app_resources):
        dest_icns = os.path.join(desktop_app_resources, "app.icns")
        with open(icns_path, "rb") as src, open(dest_icns, "wb") as dst:
            dst.write(src.read())
        print(f"Updated Desktop app icon at: {dest_icns}")

if __name__ == "__main__":
    main()
