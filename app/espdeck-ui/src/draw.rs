//! Painting helpers: the design's small controls and its icons, which are
//! 24×24 SVG paths redrawn here as strokes.

use std::f32::consts::{FRAC_PI_2, PI};

use eframe::egui::{
    self, Align2, Color32, CornerRadius, CursorIcon, FontId, Id, Painter, Pos2, Rect, Response,
    Sense, Shadow, Shape, Stroke, StrokeKind, Ui, Vec2, epaint::Mesh,
};

use crate::theme;

pub fn text_width(painter: &Painter, text: &str, font: FontId) -> f32 {
    painter
        .layout_no_wrap(text.to_owned(), font, Color32::BLACK)
        .size()
        .x
}

/// Text shortened with "…" to fit `max` points.
pub fn ellipsize(painter: &Painter, text: &str, font: &FontId, max: f32) -> String {
    if text_width(painter, text, font.clone()) <= max {
        return text.to_owned();
    }
    let mut chars: Vec<char> = text.chars().collect();
    while !chars.is_empty() {
        chars.pop();
        let s: String = chars.iter().collect::<String>() + "…";
        if text_width(painter, &s, font.clone()) <= max {
            return s;
        }
    }
    "…".into()
}

pub fn shadow(painter: &Painter, rect: Rect, radius: f32, offset_y: i8, blur: u8, alpha: u8) {
    let shape = Shadow {
        offset: [0, offset_y],
        blur,
        spread: 0,
        color: Color32::from_black_alpha(alpha),
    }
    .as_shape(rect, CornerRadius::from(radius));
    painter.add(shape);
}

/// Clickable area with a pointing-hand cursor.
pub fn hit(ui: &Ui, rect: Rect, id: impl std::hash::Hash + std::fmt::Debug) -> Response {
    let r = ui.interact(rect, Id::new(id), Sense::click());
    if r.hovered() {
        ui.ctx().set_cursor_icon(CursorIcon::PointingHand);
    }
    r
}

/// Points along a rounded rectangle, clockwise from the top-left corner.
fn rounded_path(rect: Rect, r: f32) -> Vec<Pos2> {
    let r = r.min(rect.width() / 2.0).min(rect.height() / 2.0);
    let mut pts = Vec::new();
    let corners = [
        (Pos2::new(rect.left() + r, rect.top() + r), PI),
        (Pos2::new(rect.right() - r, rect.top() + r), -FRAC_PI_2),
        (Pos2::new(rect.right() - r, rect.bottom() - r), 0.0),
        (Pos2::new(rect.left() + r, rect.bottom() - r), FRAC_PI_2),
    ];
    for (c, start) in corners {
        for i in 0..=8 {
            let a = start + FRAC_PI_2 * i as f32 / 8.0;
            pts.push(c + r * Vec2::angled(a));
        }
    }
    pts.push(pts[0]);
    pts
}

pub fn dashed_rounded_rect(painter: &Painter, rect: Rect, r: f32, stroke: Stroke) {
    let path = rounded_path(rect, r);
    painter.extend(Shape::dashed_line(&path, stroke, 4.0, 3.0));
}

/// An arc from angle `a0` to `a1` (radians, y down).
pub fn arc(painter: &Painter, c: Pos2, r: f32, a0: f32, a1: f32, stroke: Stroke) {
    let n = 16;
    let pts: Vec<Pos2> = (0..=n)
        .map(|i| c + r * Vec2::angled(a0 + (a1 - a0) * i as f32 / n as f32))
        .collect();
    painter.add(Shape::line(pts, stroke));
}

/// iOS-style switch, 32×18. Returns true when clicked.
pub fn switch(ui: &Ui, rect: Rect, id: &str, on: bool) -> bool {
    let response = hit(ui, rect, ("switch", id));
    let t = ui
        .ctx()
        .animate_bool_with_time(Id::new(("switch-anim", id)), on, 0.15);
    let p = ui.painter();
    let track = lerp_color(theme::SWITCH_OFF, theme::GREEN, t);
    p.rect_filled(rect, 9.0, track);
    let knob_x = egui::lerp(rect.left() + 9.0..=rect.right() - 9.0, t);
    let c = Pos2::new(knob_x, rect.center().y);
    p.circle_filled(c + Vec2::new(0.0, 1.0), 8.0, Color32::from_black_alpha(40));
    p.circle_filled(c, 8.0, Color32::WHITE);
    response.clicked()
}

pub fn lerp_color(a: Color32, b: Color32, t: f32) -> Color32 {
    let l = |x: u8, y: u8| (x as f32 + (y as f32 - x as f32) * t).round() as u8;
    Color32::from_rgb(l(a.r(), b.r()), l(a.g(), b.g()), l(a.b(), b.b()))
}

/// The −/+ stepper. Returns -1, 0 or 1.
pub fn stepper(ui: &Ui, right_center: Pos2, id: &str) -> i32 {
    let rect = Rect::from_min_size(
        Pos2::new(right_center.x - 52.5, right_center.y - 11.0),
        Vec2::new(52.5, 22.0),
    );
    let p = ui.painter();
    p.rect_filled(rect, 6.0, theme::QUIET);
    let minus = Rect::from_min_size(rect.min, Vec2::new(26.0, 22.0));
    let plus = Rect::from_min_size(rect.min + Vec2::new(26.5, 0.0), Vec2::new(26.0, 22.0));
    p.line_segment(
        [Pos2::new(minus.right() + 0.25, rect.top() + 4.0), Pos2::new(minus.right() + 0.25, rect.bottom() - 4.0)],
        Stroke::new(1.0, Color32::from_black_alpha(30)),
    );
    let mut out = 0;
    for (r, sign, glyph) in [(minus, -1, "−"), (plus, 1, "+")] {
        let resp = hit(ui, r, ("stepper", id, sign));
        if resp.hovered() {
            p.rect_filled(r, 6.0, theme::QUIET);
        }
        p.text(r.center(), Align2::CENTER_CENTER, glyph, theme::regular(15.0), theme::TEXT);
        if resp.clicked() {
            out = sign;
        }
    }
    out
}

/// White rounded group box with rows separated by hairlines. `heights`
/// gives each row's height; returns each row's rect.
pub fn group(painter: &Painter, x: f32, y: f32, w: f32, heights: &[f32]) -> Vec<Rect> {
    let total: f32 = heights.iter().sum();
    let outer = Rect::from_min_size(Pos2::new(x, y), Vec2::new(w, total));
    shadow(painter, outer, 10.0, 1, 2, 10);
    painter.rect_filled(outer, 10.0, Color32::WHITE);
    painter.rect_stroke(outer, 10.0, Stroke::new(0.6, Color32::from_black_alpha(30)), StrokeKind::Outside);
    let mut rows = Vec::new();
    let mut top = y;
    for (i, h) in heights.iter().enumerate() {
        let r = Rect::from_min_size(Pos2::new(x, top), Vec2::new(w, *h));
        if i > 0 {
            painter.line_segment(
                [Pos2::new(x + 12.0, top), Pos2::new(x + w, top)],
                Stroke::new(0.6, Color32::from_black_alpha(28)),
            );
        }
        rows.push(r);
        top += h;
    }
    rows
}

/// Small grey section heading above a group; returns the y below it.
pub fn heading(painter: &Painter, x: f32, y: f32, text: &str) -> f32 {
    painter.text(
        Pos2::new(x + 12.0, y),
        Align2::LEFT_TOP,
        text,
        theme::semibold(11.0),
        theme::SECONDARY,
    );
    y + 19.0
}

/// A flat rounded button; returns its response.
pub fn button(
    ui: &Ui,
    rect: Rect,
    id: &str,
    label: &str,
    font: FontId,
    fill: Color32,
    text: Color32,
) -> Response {
    let r = hit(ui, rect, ("button", id));
    let p = ui.painter();
    let fill = if r.is_pointer_button_down_on() {
        fill.gamma_multiply(0.85)
    } else {
        fill
    };
    p.rect_filled(rect, 6.0, fill);
    if r.hovered() {
        p.rect_filled(rect, 6.0, Color32::from_black_alpha(10));
    }
    p.text(rect.center(), Align2::CENTER_CENTER, label, font, text);
    r
}

/// The up/down chevron of pop-up buttons, 9×12.
pub fn updown(painter: &Painter, c: Pos2, color: Color32) {
    let s = Stroke::new(1.3, color);
    let o = c - Vec2::new(4.5, 6.0);
    let p = |x: f32, y: f32| o + Vec2::new(x, y);
    painter.add(Shape::line(vec![p(1.5, 4.5), p(4.5, 1.5), p(7.5, 4.5)], s));
    painter.add(Shape::line(vec![p(1.5, 7.5), p(4.5, 10.5), p(7.5, 7.5)], s));
}

/// Maps the design's 24×24 SVG coordinates into a square of `size`.
pub struct Icon {
    origin: Pos2,
    k: f32,
}

impl Icon {
    pub fn new(center: Pos2, size: f32) -> Self {
        Self {
            origin: center - Vec2::splat(size / 2.0),
            k: size / 24.0,
        }
    }
    pub fn p(&self, x: f32, y: f32) -> Pos2 {
        self.origin + Vec2::new(x, y) * self.k
    }
    pub fn s(&self, v: f32) -> f32 {
        v * self.k
    }
    pub fn line(&self, painter: &Painter, pts: &[(f32, f32)], width: f32, color: Color32) {
        let pts = pts.iter().map(|&(x, y)| self.p(x, y)).collect();
        painter.add(Shape::line(pts, Stroke::new(self.s(width), color)));
    }
    pub fn rect(&self, painter: &Painter, x: f32, y: f32, w: f32, h: f32, r: f32, width: f32, color: Color32) {
        let rect = Rect::from_min_max(self.p(x, y), self.p(x + w, y + h));
        painter.rect_stroke(rect, self.s(r), Stroke::new(self.s(width), color), StrokeKind::Middle);
    }
    pub fn circle(&self, painter: &Painter, x: f32, y: f32, r: f32, width: f32, color: Color32) {
        painter.circle_stroke(self.p(x, y), self.s(r), Stroke::new(self.s(width), color));
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Glyph {
    Deck,
    Bolt,
    Lines,
    Screen,
    Bluetooth,
    Chip,
    Gear,
    Undo,
    Wifi,
    Plus,
    Check,
}

pub fn glyph(painter: &Painter, center: Pos2, size: f32, glyph: Glyph, color: Color32, width: f32) {
    let i = Icon::new(center, size);
    match glyph {
        Glyph::Deck => i.rect(painter, 3.0, 5.0, 18.0, 14.0, 3.0, width, color),
        Glyph::Bolt => {
            // M13 2 4 14h7l-1 8 9-12h-7z, as two filled quads.
            let v = [(13.0, 2.0), (4.0, 14.0), (11.0, 14.0), (10.0, 22.0), (19.0, 10.0), (12.0, 10.0)];
            let mut mesh = Mesh::default();
            for (x, y) in v {
                mesh.colored_vertex(i.p(x, y), color);
            }
            for t in [[0, 1, 2], [0, 2, 5], [2, 3, 4], [2, 4, 5]] {
                mesh.add_triangle(t[0], t[1], t[2]);
            }
            painter.add(mesh);
        }
        Glyph::Lines => {
            for (y, x1) in [(7.0, 19.0), (12.0, 19.0), (17.0, 14.0)] {
                i.line(painter, &[(5.0, y), (x1, y)], width, color);
            }
        }
        Glyph::Screen => i.rect(painter, 3.0, 7.0, 18.0, 10.0, 1.0, width, color),
        Glyph::Bluetooth => i.line(
            painter,
            &[(7.0, 7.0), (17.0, 17.0), (12.0, 22.0), (12.0, 2.0), (17.0, 7.0), (7.0, 17.0)],
            width,
            color,
        ),
        Glyph::Chip => i.rect(painter, 6.0, 6.0, 12.0, 12.0, 2.0, width, color),
        Glyph::Gear => i.circle(painter, 12.0, 12.0, 3.5, width, color),
        Glyph::Undo => {
            i.line(painter, &[(9.0, 14.0), (4.0, 9.0), (9.0, 4.0)], width, color);
            i.line(painter, &[(4.0, 9.0), (15.0, 9.0)], width, color);
            arc(painter, i.p(15.0, 14.0), i.s(5.0), -FRAC_PI_2, FRAC_PI_2, Stroke::new(i.s(width), color));
            i.line(painter, &[(15.0, 19.0), (12.0, 19.0)], width, color);
        }
        Glyph::Wifi => {
            let s = Stroke::new(i.s(width), color);
            // Chords 5→19 at y 12.5 (r 10) and 8.5→15.5 at y 16 (r 5).
            let a1 = (7.0f32 / 10.0).asin();
            arc(painter, i.p(12.0, 12.5 + 51f32.sqrt()), i.s(10.0), -FRAC_PI_2 - a1, -FRAC_PI_2 + a1, s);
            let a2 = (3.5f32 / 5.0).asin();
            arc(painter, i.p(12.0, 16.0 + 12.75f32.sqrt()), i.s(5.0), -FRAC_PI_2 - a2, -FRAC_PI_2 + a2, s);
            painter.circle_filled(i.p(12.0, 19.5), i.s(width * 0.6), color);
        }
        Glyph::Plus => {
            i.line(painter, &[(12.0, 5.0), (12.0, 19.0)], width, color);
            i.line(painter, &[(5.0, 12.0), (19.0, 12.0)], width, color);
        }
        Glyph::Check => i.line(painter, &[(5.0, 12.0), (10.0, 17.0), (20.0, 7.0)], width, color),
    }
}

/// The deck icon in the sidebar's device card.
pub fn deck_logo(painter: &Painter, center: Pos2, size: f32, color: Color32) {
    let i = Icon::new(center, size);
    i.rect(painter, 3.0, 5.0, 9.0, 6.0, 1.0, 2.0, color);
    i.circle(painter, 17.5, 8.0, 3.0, 2.0, color);
    for x in [6.0, 12.0, 18.0] {
        i.circle(painter, x, 17.0, 2.0, 2.0, color);
    }
}
