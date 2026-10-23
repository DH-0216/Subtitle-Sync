"""Script to generate a pixel-perfect, modern app icon for Subtitle Sync (.ico and .png).
"""
import math
from PIL import Image, ImageDraw, ImageFilter


def create_curved_arrow(cx, cy, r_mid, width, start_deg, end_deg, head_len, head_flare):
    """Generates a single continuous polygon for a curved arrow, eliminating seams and dots."""
    r_in = r_mid - width / 2.0
    r_out = r_mid + width / 2.0
    points = []

    # 1. Outer arc from start to end
    steps = 48
    for i in range(steps + 1):
        deg = start_deg + (end_deg - start_deg) * (i / steps)
        rad = math.radians(deg)
        points.append((cx + r_out * math.cos(rad), cy + r_out * math.sin(rad)))

    # 2. Seamless integrated arrowhead at end_deg
    rad_end = math.radians(end_deg)
    tx = -math.sin(rad_end)  # Tangent (clockwise direction)
    ty = math.cos(rad_end)
    nx = math.cos(rad_end)   # Outward normal
    ny = math.sin(rad_end)

    # Outer wing flare
    points.append((cx + (r_out + head_flare) * nx, cy + (r_out + head_flare) * ny))
    # Arrow tip extending along tangent
    points.append((cx + r_mid * nx + head_len * tx, cy + r_mid * ny + head_len * ty))
    # Inner wing flare
    points.append((cx + (r_in - head_flare) * nx, cy + (r_in - head_flare) * ny))

    # 3. Inner arc from end back to start
    for i in range(steps, -1, -1):
        deg = start_deg + (end_deg - start_deg) * (i / steps)
        rad = math.radians(deg)
        points.append((cx + r_in * math.cos(rad), cy + r_in * math.sin(rad)))

    return points


def create_app_icon(output_ico_path="app_icon.ico", output_png_path="app_icon.png"):
    size = 1024
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # 1. Subtle drop shadow for main squircle
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_draw.rounded_rectangle([70, 85, 954, 965], radius=210, fill=(0, 0, 0, 95))
    shadow = shadow.filter(ImageFilter.GaussianBlur(35))
    img.alpha_composite(shadow)

    # 2. Main squircle background with vertical gradient
    bg_mask = Image.new("L", (size, size), 0)
    m_draw = ImageDraw.Draw(bg_mask)
    m_draw.rounded_rectangle([70, 70, 954, 954], radius=210, fill=255)

    gradient = Image.new("RGBA", (size, size))
    g_draw = ImageDraw.Draw(gradient)
    c_top = (99, 102, 241)     # Indigo 500
    c_bot = (67, 56, 202)      # Indigo 700 / Deep Violet
    for y in range(size):
        ratio = y / size
        r = int(c_top[0] * (1 - ratio) + c_bot[0] * ratio)
        g = int(c_top[1] * (1 - ratio) + c_bot[1] * ratio)
        b = int(c_top[2] * (1 - ratio) + c_bot[2] * ratio)
        g_draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    bg_tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_tile.paste(gradient, mask=bg_mask)
    img.alpha_composite(bg_tile)

    # Squircle border highlight
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([70, 70, 954, 954], radius=210, outline=(255, 255, 255, 60), width=6)

    # 3. Screen Box (Properly sized with generous margins so sound bars stay well inside)
    # Box top is at y=170, bottom at y=740. Total height = 570px.
    screen_rect = [170, 170, 854, 740]
    draw.rounded_rectangle(
        screen_rect,
        radius=50,
        fill=(24, 28, 42, 245),
        outline=(255, 255, 255, 45),
        width=5
    )

    # 4. Audio Sound Waveform (Strictly contained inside screen)
    # wave_center_y = 350. Max height = 210, so highest point = 350 - 105 = 245.
    # Box top is 170, so there is 75px of clean space above the tallest bar!
    wave_center_y = 350
    bar_width = 18
    gap = 22
    # Symmetrical, natural audio peaks
    heights = [35, 65, 110, 160, 210, 135, 175, 220, 150, 95, 185, 215, 130, 65, 30]
    start_x = 245
    for i, h in enumerate(heights):
        bx = start_x + i * (bar_width + gap)
        # Sky-blue color with subtle intensity gradient
        alpha = min(255, int(190 + (h / 220) * 65))
        draw.rounded_rectangle(
            [bx, wave_center_y - h // 2, bx + bar_width, wave_center_y + h // 2],
            radius=9,
            fill=(56, 189, 248, alpha)
        )

    # 5. Subtitle Display Bar (Cleanly positioned below waveform, before green badge)
    sub_bg = [235, 520, 680, 595]
    draw.rounded_rectangle(
        sub_bg,
        radius=18,
        fill=(15, 17, 26, 230),
        outline=(255, 255, 255, 25),
        width=3
    )

    # Subtitle text pills
    draw.rounded_rectangle([265, 545, 475, 572], radius=9, fill=(255, 255, 255, 235))
    draw.rounded_rectangle([495, 545, 650, 572], radius=9, fill=(251, 191, 36, 240))  # Amber highlight

    # 6. Glowing Sync Badge (Bottom Right)
    badge_center = (755, 730)
    badge_radius = 150

    # Badge shadow
    b_shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bs_draw = ImageDraw.Draw(b_shadow)
    bs_draw.ellipse(
        [badge_center[0] - badge_radius, badge_center[1] - badge_radius + 15,
         badge_center[0] + badge_radius, badge_center[1] + badge_radius + 15],
        fill=(0, 0, 0, 120)
    )
    b_shadow = b_shadow.filter(ImageFilter.GaussianBlur(25))
    img.alpha_composite(b_shadow)

    # Badge circle (Emerald Green)
    draw = ImageDraw.Draw(img)
    draw.ellipse(
        [badge_center[0] - badge_radius, badge_center[1] - badge_radius,
         badge_center[0] + badge_radius, badge_center[1] + badge_radius],
        fill=(16, 185, 129, 255),  # Emerald 500
        outline=(255, 255, 255, 220),
        width=8
    )

    # 7. Unified Curved Sync Arrows (Continuous polygons - NO dots, NO gaps)
    cx, cy = badge_center
    r_mid = 75
    arc_w = 19
    head_len = 34
    head_flare = 16

    # Upper-right curved arrow
    arrow1_poly = create_curved_arrow(
        cx, cy, r_mid=r_mid, width=arc_w,
        start_deg=220, end_deg=345,
        head_len=head_len, head_flare=head_flare
    )
    draw.polygon(arrow1_poly, fill=(255, 255, 255, 255))

    # Lower-left curved arrow (Exact 180° rotational symmetry)
    arrow2_poly = create_curved_arrow(
        cx, cy, r_mid=r_mid, width=arc_w,
        start_deg=40, end_deg=165,
        head_len=head_len, head_flare=head_flare
    )
    draw.polygon(arrow2_poly, fill=(255, 255, 255, 255))

    # Save high-res PNG
    img.save(output_png_path, "PNG")

    # Save multi-resolution Windows ICO
    icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save(output_ico_path, format="ICO", sizes=icon_sizes)
    print(f"Generated {output_ico_path} and {output_png_path} successfully.")


if __name__ == "__main__":
    create_app_icon()
