"""ESPDeck wiring diagram (the real ESP32-S3 build), drawn with ReportLab.

Used by vault_to_pdf.py (vector in the PDF) and runnable on its own to write
the SVG that the Obsidian note embeds:
    python scripts/hw_diagram.py dokumentace_md/HW/zapojeni_hw.svg
Pins come from ESP_C++_kod/test_obrazovky/src/main.cpp – keep them in sync.
"""
import sys

from reportlab.graphics.shapes import Circle, Drawing, Group, Line, Rect, String
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

F = "C:/Windows/Fonts/"
for name, file in (("UI", "segoeui.ttf"), ("UI-B", "segoeuib.ttf"), ("UI-SB", "seguisb.ttf"), ("Mono", "consola.ttf")):
    try:
        pdfmetrics.getFont(name)
    except KeyError:
        pdfmetrics.registerFont(TTFont(name, F + file))

INK = colors.HexColor("#1d1d1f")
MUTED = colors.HexColor("#6e6e73")
BOARD = colors.HexColor("#1f5f3a")
BOARD_EDGE = colors.HexColor("#14402a")
MODULE = colors.HexColor("#f5f5f7")
EDGE = colors.HexColor("#c7c7cc")

W_3V3 = colors.HexColor("#e0362c")
W_GND = colors.HexColor("#1d1d1f")
W_SDA = colors.HexColor("#1a73e8")
W_SCL = colors.HexColor("#e2b100")
W_A = colors.HexColor("#2e9d4f")
W_B = colors.HexColor("#9a9aa0")
W_KEY = colors.HexColor("#f08a00")
W_TOUCH = colors.HexColor("#8e44ad")

WIDTH, HEIGHT = 482, 340


def txt(g, x, y, s, size=7.5, font="UI", color=INK, anchor="start"):
    g.add(String(x, y, s, fontName=font, fontSize=size, fillColor=color, textAnchor=anchor))


def wire(g, x1, x2, y, color, label=None):
    g.add(Line(x1, y, x2, y, strokeColor=color, strokeWidth=2.2, strokeLineCap=1))
    g.add(Circle(x1, y, 2.3, fillColor=color, strokeColor=None))
    g.add(Circle(x2, y, 2.3, fillColor=color, strokeColor=None))
    if label:
        txt(g, (x1 + x2) / 2, y + 3.5, label, 6.4, "UI", MUTED, "middle")


def diagram():
    d = Drawing(WIDTH, HEIGHT)
    g = Group()
    d.add(g)

    # ---------------- ESP32-S3 DevKit
    bx0, bx1, by0, by1 = 168, 300, 46, 318
    g.add(Rect(bx0, by0, bx1 - bx0, by1 - by0, rx=6, ry=6, fillColor=BOARD, strokeColor=BOARD_EDGE, strokeWidth=1))
    # module can + USB
    g.add(Rect(bx0 + 14, by1 - 66, 62, 52, rx=2, ry=2, fillColor=colors.HexColor("#c9ccd1"), strokeColor=None))
    txt(g, bx0 + 45, by1 - 36, "ESP32-S3", 8.5, "UI-B", INK, "middle")
    txt(g, bx0 + 45, by1 - 47, "WROOM-1 N16", 6.8, "UI", INK, "middle")
    g.add(Rect((bx0 + bx1) / 2 - 14, by0 - 6, 28, 12, rx=2, ry=2, fillColor=colors.HexColor("#8e8e93"), strokeColor=None))
    txt(g, (bx0 + bx1) / 2, by0 + 10, "USB (CH9102)", 6.2, "UI", colors.white, "middle")
    txt(g, (bx0 + bx1) / 2, by1 + 7, "LaskaKit ESP32-S3-DevKit", 8.5, "UI-B", INK, "middle")

    def pin_r(y, label):  # pin on the right board edge
        g.add(Rect(bx1 - 5, y - 3, 5, 6, fillColor=colors.HexColor("#d4af37"), strokeColor=None))
        txt(g, bx1 - 8, y - 2.5, label, 6.8, "Mono", colors.white, "end")

    def pin_l(y, label):
        g.add(Rect(bx0, y - 3, 5, 6, fillColor=colors.HexColor("#d4af37"), strokeColor=None))
        txt(g, bx0 + 8, y - 2.5, label, 6.8, "Mono", colors.white, "start")

    # ---------------- OLED via μŠup
    oy = [282, 270, 258, 246]  # 3V3, GND, SDA, SCL
    g.add(Rect(bx1 - 3, oy[-1] - 9, 10, oy[0] - oy[-1] + 18, rx=2, ry=2, fillColor=colors.HexColor("#f2f2f2"),
               strokeColor=EDGE, strokeWidth=0.6))
    txt(g, bx1 - 8, oy[0] + 13, "μŠup", 6.8, "UI-SB", colors.white, "end")
    for y, l in zip(oy, ["3V3", "GND", "IO42 SDA", "IO2 SCL"]):
        txt(g, bx1 - 8, y - 2.5, l, 6.8, "Mono", colors.white, "end")
    txt(g, bx1 - 8, oy[-1] - 18, "napájení: IO47 = HIGH", 6.2, "UI", colors.HexColor("#cfe8d6"), "end")

    ox0, ox1 = 372, 462
    g.add(Rect(ox0, 222, ox1 - ox0, 82, rx=4, ry=4, fillColor=colors.HexColor("#0b3d6e"), strokeColor=None))
    g.add(Rect(ox0 + 14, 236, ox1 - ox0 - 22, 54, rx=1, ry=1, fillColor=colors.black, strokeColor=None))
    txt(g, ox0 + 14 + (ox1 - ox0 - 22) / 2, 260, "12:34", 13, "Mono", colors.HexColor("#f2f2f2"), "middle")
    txt(g, (ox0 + ox1) / 2, 309, "OLED 1,3\" SH1106 128×64", 7.6, "UI-B", INK, "middle")
    txt(g, (ox0 + ox1) / 2, 213, "I²C 0x3C · 400 kHz · pull-up 10 kΩ na modulu", 6.2, "UI", MUTED, "middle")
    for y, c, l, ml in zip(oy, [W_3V3, W_GND, W_SDA, W_SCL], ["3V3", "GND", "SDA", "SCL"], ["VCC", "GND", "SDA", "SCL"]):
        wire(g, bx1 + 7, ox0, y, c, l)
        txt(g, ox0 + 3, y - 2.5, ml, 6, "Mono", colors.white)

    # ---------------- Encoder
    ey = [168, 156, 144, 132, 120]  # 3V3, GND, S1, S2, Key
    for y, l in zip(ey, ["3V3", "GND", "IO15", "IO16", "IO17"]):
        pin_r(y, l)
    ex0, ex1 = 372, 462
    g.add(Rect(ex0, 104, ex1 - ex0, 80, rx=4, ry=4, fillColor=colors.HexColor("#1b4fa0"), strokeColor=None))
    g.add(Circle(ex0 + 58, 144, 20, fillColor=colors.HexColor("#3a3a3c"), strokeColor=colors.HexColor("#8e8e93"),
                 strokeWidth=2))
    g.add(Circle(ex0 + 58, 144, 7, fillColor=colors.HexColor("#c7c7cc"), strokeColor=None))
    txt(g, (ex0 + ex1) / 2, 189, "Rotační enkodér s tlačítkem", 7.6, "UI-B", INK, "middle")
    txt(g, (ex0 + ex1) / 2, 95, "20 pulzů/ot. · RC filtr na modulu", 6.2, "UI", MUTED, "middle")
    for y, c, l, ml in zip(ey, [W_3V3, W_GND, W_A, W_B, W_KEY], ["3V3 (ne 5 V!)", "GND", "A", "B", "tlačítko"],
                           ["5V", "GND", "S1", "S2", "Key"]):
        wire(g, bx1, ex0, y, c, l)
        txt(g, ex0 + 3, y - 2.5, ml, 6, "Mono", colors.white)

    # ---------------- Touch pads
    pads = [(1, 4), (2, 5), (3, 6), (4, 7), (5, 8), (6, 1)]
    py0, step = 262, 30
    txt(g, 44, 290, "Dotykové plošky", 8, "UI-B", INK, "middle")
    for i, (n, gpio) in enumerate(pads):
        y = py0 - i * step
        pin_l(y, f"IO{gpio}")
        g.add(Circle(44, y, 11, fillColor=colors.HexColor("#d98c4a"), strokeColor=colors.HexColor("#a5622b"),
                     strokeWidth=1))
        txt(g, 44, y - 3, f"P{n}", 7.2, "UI-B", colors.white, "middle")
        wire(g, 56, bx0, y, W_TOUCH, f"T{gpio}")
    txt(g, 44, py0 - 5 * step - 22, "ploška 6 na IO1:", 6.2, "UI", MUTED, "middle")
    txt(g, 44, py0 - 5 * step - 30, "IO10 není vyvedený", 6.2, "UI", MUTED, "middle")

    # ---------------- Legend
    lx, ly = 8, 18
    items = [(W_3V3, "3V3"), (W_GND, "GND"), (W_SDA, "I²C SDA"), (W_SCL, "I²C SCL"), (W_A, "enkodér A"),
             (W_B, "enkodér B"), (W_KEY, "tlačítko"), (W_TOUCH, "dotyk")]
    x = lx
    for c, l in items:
        g.add(Line(x, ly + 2.5, x + 12, ly + 2.5, strokeColor=c, strokeWidth=2.2))
        txt(g, x + 15, ly, l, 6.4, "UI", MUTED)
        x += 15 + pdfmetrics.stringWidth(l, "UI", 6.4) + 12
    txt(g, lx, ly - 11, "Barvy vodičů jen pro přehlednost · logické zapojení, ne poloha pinů na desce", 6.2, "UI",
        MUTED)
    return d


def write_svg(path):
    from reportlab.graphics import renderSVG
    renderSVG.drawToFile(diagram(), path)
    # Font names → real system fonts, so the SVG renders the same in Obsidian.
    s = open(path, encoding="utf-8").read()
    for a, b in (('font-family="UI-B"', 'font-family="Segoe UI" font-weight="bold"'),
                 ('font-family="UI-SB"', 'font-family="Segoe UI" font-weight="600"'),
                 ('font-family="Mono"', 'font-family="Consolas, monospace"'),
                 ('font-family="UI"', 'font-family="Segoe UI, sans-serif"')):
        s = s.replace(a, b)
    s = s.replace("font-family: UI-B", "font-family: Segoe UI; font-weight: bold") \
         .replace("font-family: UI-SB", "font-family: Segoe UI; font-weight: 600") \
         .replace("font-family: Mono", "font-family: Consolas, monospace") \
         .replace("font-family: UI", "font-family: Segoe UI, sans-serif")
    open(path, "w", encoding="utf-8").write(s)


if __name__ == "__main__":
    write_svg(sys.argv[1] if len(sys.argv) > 1 else "zapojeni_hw.svg")
    print("OK")
