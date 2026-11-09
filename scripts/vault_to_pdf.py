"""Builds one PDF from the Obsidian vault dokumentace_md (ESPDeck).

Usage (Windows, needs `pip install reportlab`; fonts from C:/Windows/Fonts):
    python scripts/vault_to_pdf.py dokumentace_md "ESPDeck dokumentace.pdf"
New notes must be added to PARTS below to appear in the PDF.
"""
import re
import sys
from datetime import date
from pathlib import Path

from reportlab.graphics.shapes import Drawing, Line, Polygon, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, KeepTogether, PageBreak, PageTemplate, Paragraph,
                                Preformatted, Spacer, Table, TableStyle)
from reportlab.platypus.tableofcontents import TableOfContents

VAULT = Path(sys.argv[1])
OUT = Path(sys.argv[2])

F = "C:/Windows/Fonts/"
pdfmetrics.registerFont(TTFont("UI", F + "segoeui.ttf"))
pdfmetrics.registerFont(TTFont("UI-B", F + "segoeuib.ttf"))
pdfmetrics.registerFont(TTFont("UI-SB", F + "seguisb.ttf"))
pdfmetrics.registerFont(TTFont("Mono", F + "consola.ttf"))
pdfmetrics.registerFontFamily("UI", normal="UI", bold="UI-B", italic="UI", boldItalic="UI-B")

INK = colors.HexColor("#1d1d1f")
MUTED = colors.HexColor("#6e6e73")
ACCENT = colors.HexColor("#007aff")
LINE = colors.HexColor("#d9d9de")
SOFT = colors.HexColor("#f5f5f7")
WARN = colors.HexColor("#fff4e5")
WARN_EDGE = colors.HexColor("#ff9500")
INFO = colors.HexColor("#eaf3ff")

base = ParagraphStyle("base", fontName="UI", fontSize=9.6, leading=14, textColor=INK, alignment=TA_LEFT)
S = {
    "body": base,
    "small": ParagraphStyle("small", parent=base, fontSize=8.4, leading=11.5),
    "cell": ParagraphStyle("cell", parent=base, fontSize=8.6, leading=11.8),
    "cellh": ParagraphStyle("cellh", parent=base, fontName="UI-SB", fontSize=8.6, leading=11.8, textColor=MUTED),
    "bullet": ParagraphStyle("bullet", parent=base, leftIndent=12, bulletIndent=2, spaceAfter=2),
    "h1": ParagraphStyle("h1", parent=base, fontName="UI-B", fontSize=20, leading=25, spaceAfter=4, textColor=INK),
    "kicker": ParagraphStyle("kicker", parent=base, fontName="UI-SB", fontSize=8.5, leading=11, textColor=ACCENT),
    "h2": ParagraphStyle("h2", parent=base, fontName="UI-B", fontSize=13, leading=17, spaceBefore=12, spaceAfter=5),
    "h3": ParagraphStyle("h3", parent=base, fontName="UI-SB", fontSize=10.8, leading=14, spaceBefore=8, spaceAfter=3),
    "code": ParagraphStyle("code", fontName="Mono", fontSize=8.3, leading=11, textColor=INK),
    "meta": ParagraphStyle("meta", parent=base, fontSize=8.2, leading=11, textColor=MUTED, spaceAfter=10),
}

# Order of the document: (part title, [note paths])
PARTS = [
    ("Projekt", ["ESPDeck.md", "Stav projektu.md", "Technická rozhodnutí.md"]),
    ("Hardware", ["HW/HW zapojení.md", "HW/Moduly a BOM.md", "HW/Oživení a diagnostika.md"]),
    ("Firmware", ["Firmware/Přehled firmwaru.md", "Firmware/Obrazovky a ovládání.md",
                  "Firmware/Dotykové plošky.md", "Firmware/Síťové funkce.md"]),
    ("Komunikace", ["Komunikace/Protokol deck–PC.md"]),
    ("Aplikace", ["Aplikace/Přehled aplikace.md", "Aplikace/Zkratky na ploškách.md", "Aplikace/Editor UI.md"]),
    ("Grafika", ["Grafika/Animace a Display Designer.md"]),
    ("Otevřené otázky", ["Otevřené otázky.md"]),
    ("Deník", sorted(str(p.relative_to(VAULT)).replace("\\", "/") for p in (VAULT / "Deník").glob("*.md"))),
]

GLYPHS = {"✅": "\x01G", "🟡": "\x01O", "❚❚": "‖", "▶": "►"}
DOTS = {"\x01G": '<font color="#34c759">●</font>', "\x01O": '<font color="#ff9500">●</font>'}


def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def inline(t):
    for k, v in GLYPHS.items():
        t = t.replace(k, v)
    t = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", t)
    t = re.sub(r"\[\[(?:[^\]]*/)?([^\]]+)\]\]", r"\1", t)
    parts = re.split(r"(`[^`]+`)", t)
    out = []
    for p in parts:
        if p.startswith("`") and p.endswith("`") and len(p) > 1:
            out.append(f'<font name="Mono" size="8.4" color="#c4321a">{esc(p[1:-1])}</font>')
        else:
            p = esc(p)
            p = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", p)
            p = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\w)", r'<font color="#6e6e73">\1</font>', p)
            for k, v in DOTS.items():
                p = p.replace(k, v)
            out.append(p)
    return "".join(out)


def table(rows, width):
    head, body = rows[0], rows[1:]
    n = len(head)
    data = [[Paragraph(inline(c), S["cellh"]) for c in head]]
    for r in body:
        r = (r + [""] * n)[:n]
        data.append([Paragraph(inline(c), S["cell"]) for c in r])
    # Column widths by content length, with a floor.
    lens = [max(len(re.sub(r"[`*\[\]]", "", (row + [""] * n)[i])) for row in rows) for i in range(n)]
    lens = [min(max(l, 14), 60) for l in lens]
    # Never narrower than the longest word (so "BLUETOOTH" doesn't split).
    floor = [max((pdfmetrics.stringWidth(w, "UI-B", 8.8) for row in rows
                  for w in re.sub(r"[`*\[\]]", "", (row + [""] * n)[i]).split()), default=0) + 12
             for i in range(n)]
    tot = sum(lens)
    cw = [max(width * l / tot, f) for l, f in zip(lens, floor)]
    extra = sum(cw) - width
    if extra > 0:  # take the excess from the columns that have room
        slack = [c - f for c, f in zip(cw, floor)]
        s = sum(slack) or 1
        cw = [c - extra * sl / s for c, sl in zip(cw, slack)]
    t = Table(data, colWidths=cw, repeatRows=1)
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, INK),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def callout(kind, title, lines, width):
    bg, edge = (WARN, WARN_EDGE) if kind in ("warning", "caution") else (INFO, ACCENT)
    content = []
    if title:
        content.append(Paragraph(f"<b>{inline(title)}</b>", S["body"]))
    for l in lines:
        if l.startswith("- "):
            content.append(Paragraph(inline(l[2:]), S["bullet"], bulletText="•"))
        else:
            content.append(Paragraph(inline(l), S["body"]))
    t = Table([[content]], colWidths=[width])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LINEBEFORE", (0, 0), (0, -1), 2.5, edge),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


def code_block(lines, width):
    t = Table([[Preformatted("\n".join(lines), S["code"])]], colWidths=[width])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT),
        ("BOX", (0, 0), (-1, -1), 0.4, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def system_diagram(width):
    h = 150
    d = Drawing(width, h)

    def box(x, y, w, bh, title, sub, fill):
        d.add(Rect(x, y, w, bh, rx=6, ry=6, fillColor=fill, strokeColor=LINE, strokeWidth=0.8))
        d.add(String(x + w / 2, y + bh - 17, title, fontName="UI-B", fontSize=9.5, fillColor=INK, textAnchor="middle"))
        for i, s in enumerate(sub):
            d.add(String(x + w / 2, y + bh - 31 - i * 11, s, fontName="UI", fontSize=7.6, fillColor=MUTED, textAnchor="middle"))

    def arrow(x1, y1, x2, y2, label, dx=0, dy=0):
        d.add(Line(x1, y1, x2, y2, strokeColor=ACCENT, strokeWidth=1.2))
        import math
        a = math.atan2(y2 - y1, x2 - x1)
        p = [x2, y2, x2 - 7 * math.cos(a - 0.4), y2 - 7 * math.sin(a - 0.4), x2 - 7 * math.cos(a + 0.4), y2 - 7 * math.sin(a + 0.4)]
        d.add(Polygon(p, fillColor=ACCENT, strokeColor=ACCENT))
        d.add(String((x1 + x2) / 2 + dx, (y1 + y2) / 2 + dy, label, fontName="UI", fontSize=7.4, fillColor=ACCENT, textAnchor="middle"))

    bw = 150
    box(0, 45, bw, 60, "ESPDeck (ESP32-S3)", ["OLED · 6 plošek · enkodér", "firmware C++ / Arduino"], SOFT)
    box(width - bw, 85, bw, 60, "espdeck.exe (PC)", ["Rust + egui", "zkratky přes enigo"], SOFT)
    box(width - bw, 5, bw, 60, "Domácí síť", ["Bluesound (BluOS :11000)", "světla (HTTP :8181)"], SOFT)
    arrow(bw, 92, width - bw, 115, "TCP :4545 · JSON řádky · mDNS", dy=14)
    arrow(bw, 58, width - bw, 35, "HTTP GET", dy=-18)
    return d


def parse(path, width):
    text = (VAULT / path).read_text(encoding="utf-8")
    meta = {}
    if text.startswith("---"):
        fm, text = text[3:].split("\n---", 1)
        for l in fm.strip().splitlines():
            if ":" in l:
                k, v = l.split(":", 1)
                meta[k.strip()] = v.strip()
    lines = text.strip("\n").splitlines()
    flow, title = [], path
    i = 0
    while i < len(lines):
        l = lines[i]
        s = l.strip()
        if not s:
            i += 1
            continue
        if s.startswith("# "):
            title = s[2:].strip()
            i += 1
            continue
        if s.startswith(("←", "→", "Historie:")):  # vault navigation
            i += 1
            continue
        if s == "![[zapojeni_hw.svg]]":  # wiring diagram: drawn as vector, scaled to the page width
            from reportlab.graphics.shapes import Drawing as _D
            sys.path.insert(0, str(Path(__file__).parent))
            import hw_diagram
            src = hw_diagram.diagram()
            k = width / src.width
            dd = _D(width, src.height * k)
            for el in src.contents:
                el.scale(k, k)
                dd.add(el)
            flow.append(Spacer(1, 4))
            flow.append(dd)
            flow.append(Spacer(1, 6))
            i += 1
            continue
        if s.startswith("```"):
            block = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                block.append(lines[i])
                i += 1
            i += 1
            if path == "ESPDeck.md":
                flow.append(system_diagram(width))
            else:
                flow.append(code_block(block, width))
            flow.append(Spacer(1, 6))
            continue
        if s.startswith("> "):
            m = re.match(r">\s*\[!(\w+)\]\s*(.*)", s)
            kind, ctitle = (m.group(1).lower(), m.group(2)) if m else ("note", "")
            body = [] if m else [s[2:]]
            i += 1
            while i < len(lines) and lines[i].strip().startswith(">"):
                body.append(lines[i].strip()[1:].strip())
                i += 1
            flow.append(callout(kind, ctitle, body, width))
            flow.append(Spacer(1, 8))
            continue
        if s.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?", c) for c in cells):
                    rows.append(cells)
                i += 1
            flow.append(table(rows, width))
            flow.append(Spacer(1, 8))
            continue
        if len(s) > 2 and s[0] == "*" and s[-1] == "*" and s[1] != "*":  # whole-line italic note
            flow.append(Paragraph(f'<font color="#6e6e73">{inline(s[1:-1])}</font>', S["small"]))
            flow.append(Spacer(1, 6))
            i += 1
            continue
        if s.startswith("### "):
            flow.append(Paragraph(inline(s[4:]), S["h3"]))
        elif s.startswith("## "):
            flow.append(Paragraph(inline(s[3:]), S["h2"]))
        elif re.match(r"- \[[ x]\] ", s):
            flow.append(Paragraph(inline(s[6:]), S["bullet"], bulletText="☐" if s[3] == " " else "☑"))
        elif s.startswith("- "):
            flow.append(Paragraph(inline(s[2:]), S["bullet"], bulletText="•"))
        elif re.match(r"\d+\. ", s):
            n, rest = s.split(". ", 1)
            flow.append(Paragraph(inline(rest), S["bullet"], bulletText=f"{n}."))
        else:
            flow.append(Paragraph(inline(s), S["body"]))
            flow.append(Spacer(1, 4))
        i += 1
    return title, meta, flow


class Doc(BaseDocTemplate):
    def afterFlowable(self, f):
        if isinstance(f, Paragraph) and getattr(f, "_toc", None) is not None:
            level, text = f._toc
            key = f"k{id(f)}"
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, level=level, closed=level > 0)
            self.notify("TOCEntry", (level, text, self.page, key))


def cover(c, doc):
    w, h = A4
    c.setFillColor(INK)
    c.rect(0, 0, w, h, fill=1, stroke=0)
    # Pixel deck motif: 6x3 grid
    x0, y0, cell = 22 * mm, h - 120 * mm, 13 * mm
    c.setFillColor(colors.HexColor("#2c2c2e"))
    c.roundRect(x0 - 6, y0 - 6, cell * 6 + 12 - 4, cell * 3 + 12 - 4, 8, fill=1, stroke=0)
    layout = {(0, 0): "oled", (1, 0): "oled", (0, 1): "oled", (1, 1): "oled",
              (2, 2): "pad", (3, 2): "pad", (4, 2): "pad", (2, 1): "pad", (3, 1): "pad", (4, 1): "pad",
              (5, 2): "enc", (5, 1): "enc"}
    for (cx, cy), k in layout.items():
        x, y = x0 + cx * cell, y0 + (2 - cy) * cell
        if k == "pad":
            c.setFillColor(colors.HexColor("#f4f4f6"))
            c.roundRect(x + 2, y + 2, cell - 8, cell - 8, 5, fill=1, stroke=0)
        elif k == "enc":
            c.setFillColor(colors.HexColor("#8e8e93"))
            c.circle(x + cell / 2 - 2, y + cell / 2 - 2, cell / 2 - 5, fill=1, stroke=0)
    c.setFillColor(colors.black)
    c.roundRect(x0 + 2, y0 + cell + 2, cell * 2 - 8, cell * 2 - 8, 4, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#f2f2f2"))
    c.setFont("Mono", 11)
    c.drawString(x0 + 9, y0 + cell * 2 + 2, "12:34")

    c.setFillColor(colors.white)
    c.setFont("UI-B", 40)
    c.drawString(22 * mm, h - 150 * mm, "ESPDeck")
    c.setFont("UI", 15)
    c.setFillColor(colors.HexColor("#c7c7cc"))
    c.drawString(22 * mm, h - 162 * mm, "Technická dokumentace – skutečný stav projektu")
    c.setFont("UI", 9.5)
    c.setFillColor(colors.HexColor("#8e8e93"))
    y = 40 * mm
    for line in [
        f"Stav k {date.today().strftime('%d. %m. %Y')}",
        "Vygenerováno z Obsidian vaultu dokumentace_md",
        "ESP32-S3 · C++ firmware (PlatformIO) · Rust / egui aplikace",
    ]:
        c.drawString(22 * mm, y, line)
        y -= 5.5 * mm
    c.setFillColor(ACCENT)
    c.rect(22 * mm, h - 168 * mm, 18 * mm, 1.4 * mm, fill=1, stroke=0)


def page(c, doc):
    w, h = A4
    c.setFont("UI", 7.8)
    c.setFillColor(MUTED)
    c.drawString(20 * mm, 12 * mm, "ESPDeck – technická dokumentace")
    c.drawRightString(w - 20 * mm, 12 * mm, str(doc.page))
    c.setStrokeColor(LINE)
    c.setLineWidth(0.4)
    c.line(20 * mm, 16 * mm, w - 20 * mm, 16 * mm)


def build():
    doc = Doc(str(OUT), pagesize=A4, title="ESPDeck – technická dokumentace", author="ESPDeck",
              leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=22 * mm)
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f")
    doc.addPageTemplates([PageTemplate("cover", [frame], onPage=cover), PageTemplate("body", [frame], onPage=page)])
    W = doc.width

    from reportlab.platypus import NextPageTemplate
    story = [NextPageTemplate("body"), PageBreak()]

    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle("t0", parent=base, fontName="UI-B", fontSize=10.5, leading=15, spaceBefore=7),
        ParagraphStyle("t1", parent=base, fontSize=9.4, leading=13, leftIndent=14),
    ]
    toc.dotsMinLevel = 1
    story += [Paragraph("Obsah", S["h1"]), Spacer(1, 8), toc, PageBreak()]

    for pi, (part, notes) in enumerate(PARTS):
        for ni, path in enumerate(notes):
            title, meta, flow = parse(path, W)
            if ni == 0:
                k = Paragraph(f"{pi + 1:02d} · {part.upper()}", S["kicker"])
                k._toc = (0, f"{pi + 1}. {part}")
                story.append(k)
            h = Paragraph(inline(title), S["h1"])
            h._toc = (1, title)
            bits = []
            for key in ("cesta", "zdroj", "status", "aktualizováno", "datum"):
                if key in meta:
                    bits.append(f"{key}: {meta[key]}")
            header = [h]
            if bits:
                header.append(Paragraph(esc("  ·  ".join(bits)), S["meta"]))
            else:
                header.append(Spacer(1, 6))
            story.append(KeepTogether(header + flow[:1]))
            story += flow[1:]
            # Diary entries flow on one page; other notes start fresh.
            if part == "Deník" and ni < len(notes) - 1:
                story.append(Spacer(1, 16))
            else:
                story.append(PageBreak())
    if isinstance(story[-1], PageBreak):
        story.pop()
    doc.multiBuild(story)


build()
print("OK", OUT)
