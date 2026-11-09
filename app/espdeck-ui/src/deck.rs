//! The deck drawn as the hardware looks: a grey plate with the OLED, touch
//! pads and rotary encoders on a 6×3 grid.

use eframe::egui::{Align2, Color32, Id, Pos2, Rect, Stroke, StrokeKind, Ui, Vec2};

use crate::draw;
use crate::model::{COLS, Deck, Element, Kind, ROWS, SLOTS};
use crate::theme;

/// What the OLED shows on the plate.
pub enum OledFace<'a> {
    /// Left-aligned title, rule and status line (hardware view).
    Status { title: &'a str, line: &'a str },
    /// Centred small line over a big one (idle screen).
    Idle { top: &'a str, big: &'a str },
}

pub enum DeckEvent {
    Select(String),
    MoveTo(usize),
}

pub struct DeckStyle {
    /// Slot size and gap between slots.
    pub slot: f32,
    pub gap: f32,
    pub padding: f32,
    pub radius: f32,
    /// Empty slots are drawn and clickable (hardware layout).
    pub show_free: bool,
}

impl DeckStyle {
    pub fn size(&self) -> Vec2 {
        let w = COLS as f32 * self.slot + (COLS - 1) as f32 * self.gap;
        let h = ROWS as f32 * self.slot + (ROWS - 1) as f32 * self.gap;
        Vec2::new(w, h) + Vec2::splat(2.0 * self.padding)
    }
}

pub fn draw_deck(
    ui: &Ui,
    plate: Rect,
    style: &DeckStyle,
    deck: &Deck,
    selected: &str,
    face: OledFace,
) -> Option<DeckEvent> {
    let p = ui.painter();
    draw::shadow(p, plate, style.radius, 20, 40, 45);
    draw::shadow(p, plate, style.radius, 2, 6, 14);
    p.rect_filled(plate, style.radius, theme::PLATE);
    p.rect_stroke(plate, style.radius, Stroke::new(0.6, Color32::from_black_alpha(20)), StrokeKind::Inside);
    p.line_segment(
        [
            Pos2::new(plate.left() + style.radius, plate.top() + 1.0),
            Pos2::new(plate.right() - style.radius, plate.top() + 1.0),
        ],
        Stroke::new(1.0, Color32::WHITE),
    );

    let origin = plate.min + Vec2::splat(style.padding);
    let (s, g) = (style.slot, style.gap);
    let slot_pos = |slot: usize| {
        origin + Vec2::new((slot % COLS) as f32 * (s + g), (slot / COLS) as f32 * (s + g))
    };
    let mut event = None;

    if style.show_free {
        let occupied = deck.occupied(None);
        for slot in (0..SLOTS).filter(|&i| !occupied[i]) {
            let r = Rect::from_min_size(slot_pos(slot), Vec2::splat(s));
            let resp = draw::hit(ui, r, ("free-slot", slot));
            if resp.hovered() {
                p.rect_filled(r, 16.0, Color32::from_rgba_unmultiplied(0, 122, 255, 15));
            }
            draw::dashed_rounded_rect(p, r.shrink(0.75), 16.0, Stroke::new(1.5, Color32::from_black_alpha(36)));
            if resp.clicked() {
                event = Some(DeckEvent::MoveTo(slot));
            }
        }
    }

    for el in &deck.els {
        let target = slot_pos(el.slot);
        let ctx = ui.ctx();
        let key = (el.id.as_str(), s as u32);
        let x = ctx.animate_value_with_time(Id::new(("el-x", key)), target.x, 0.25);
        let y = ctx.animate_value_with_time(Id::new(("el-y", key)), target.y, 0.25);
        let w = if el.kind == Kind::Oled { 2.0 * s + g } else { s };
        let rect = Rect::from_min_size(Pos2::new(x, y), Vec2::new(w, s));
        let resp = draw::hit(ui, rect, ("element", el.id.as_str()));
        draw_element(ui, rect, s, el, &face);
        if el.id == selected {
            if el.kind == Kind::Enc {
                p.circle_stroke(rect.center(), s / 2.0 + 1.5, Stroke::new(3.0, theme::ACCENT));
            } else {
                let radius = if s > 70.0 { 18.0 } else { 14.0 };
                p.rect_stroke(rect, radius, Stroke::new(3.0, theme::ACCENT), StrokeKind::Outside);
            }
        }
        if resp.clicked() {
            event = Some(DeckEvent::Select(el.id.clone()));
        }
    }
    event
}

fn draw_element(ui: &Ui, rect: Rect, s: f32, el: &Element, face: &OledFace) {
    let p = ui.painter();
    let k = s / 88.0;
    let c = rect.center();
    match el.kind {
        Kind::Oled => {
            let screen = Rect::from_center_size(c, Vec2::new(2.0 * s, s));
            let r = 6.0 * k;
            p.rect_filled(screen, r, Color32::from_rgb(5, 5, 5));
            p.rect_stroke(screen, r, Stroke::new(3.0 * k, Color32::from_rgb(0x1a, 0x1a, 0x1a)), StrokeKind::Inside);
            match face {
                OledFace::Status { title, line } => {
                    let x = screen.left() + 14.0 * k;
                    let mid = screen.center().y;
                    p.text(Pos2::new(x, mid - 4.0 * k), Align2::LEFT_BOTTOM, *title, theme::pixel(15.0 * k), theme::OLED_INK);
                    p.line_segment(
                        [Pos2::new(x, mid), Pos2::new(screen.right() - 14.0 * k, mid)],
                        Stroke::new(1.0, theme::OLED_INK.gamma_multiply(0.9)),
                    );
                    p.text(Pos2::new(x, mid + 5.0 * k), Align2::LEFT_TOP, *line, theme::pixel(10.0 * k), theme::OLED_INK);
                }
                OledFace::Idle { top, big } => {
                    // The design's 7 px / 18 px at the 64 px slot.
                    let k = s / 64.0;
                    p.text(c - Vec2::new(0.0, 8.0 * k), Align2::CENTER_CENTER, *top, theme::pixel(7.0 * k), theme::OLED_INK);
                    p.text(c + Vec2::new(0.0, 6.0 * k), Align2::CENTER_CENTER, *big, theme::pixel(18.0 * k), theme::OLED_INK);
                }
            }
        }
        Kind::Touch => {
            let pad = Rect::from_center_size(c, Vec2::splat(s - 12.0 * k));
            let r = 18.0 * k;
            draw::shadow(p, pad, r, 1, 2, 20);
            p.rect_filled(pad, r, theme::PAD);
            p.rect_stroke(pad, r, Stroke::new(0.6, Color32::from_black_alpha(30)), StrokeKind::Inside);
            p.circle_stroke(c, 17.0 * k, Stroke::new(1.5, Color32::from_black_alpha(46)));
            p.text(c, Align2::CENTER_CENTER, &el.id, theme::semibold(11.0 * k.max(0.9)), theme::ICON);
        }
        Kind::Enc => {
            let radius = (s - 12.0 * k) / 2.0;
            draw::shadow(p, Rect::from_center_size(c, Vec2::splat(2.0 * radius)), radius, (4.0 * k) as i8, 10, 60);
            p.circle_filled(c, radius + 4.0 * k, theme::KNOB_RING);
            p.circle_filled(c, radius, theme::KNOB);
            let tick = Rect::from_center_size(
                Pos2::new(c.x, c.y - radius + 8.0 * k + 6.0 * k),
                Vec2::new(3.0, 12.0 * k),
            );
            p.rect_filled(tick, 2.0, theme::BG);
            p.text(
                Pos2::new(c.x, c.y + radius - 10.0 * k),
                Align2::CENTER_BOTTOM,
                &el.id,
                theme::semibold(11.0 * k.max(0.9)),
                Color32::from_rgb(0xc7, 0xc7, 0xcc),
            );
        }
    }
}
