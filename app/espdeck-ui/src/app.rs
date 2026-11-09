//! The editor window, following the UI design: a sidebar, a header with the
//! Hardware / Functions switch, the deck in the middle and an inspector on
//! the right. The design's macOS title row is replaced by [`TitleBar`].

use std::collections::HashMap;

use eframe::egui::{
    self, Align2, Color32, CursorIcon, Id, Painter, Pos2, Rect, Sense, Stroke, StrokeKind, Ui,
    Vec2,
};

use crate::actions::{self, PADS};
use crate::deck::{DeckEvent, DeckStyle, OledFace, draw_deck};
use crate::link::{Link, Status};
use crate::draw::{self, Glyph};
use crate::model::{self, Deck, Kind, PAGES, TOUCH_GPIO_TOTAL, Via};
use crate::theme;
use crate::titlebar::{self, TitleBar};

const SIDEBAR_W: f32 = 232.0;
const HEADER_H: f32 = 52.0;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Nav {
    Deck,
    Actions,
    Profiles,
    Screens,
    Connections,
    Device,
    Settings,
}

impl Nav {
    fn label(self) -> &'static str {
        match self {
            Nav::Deck => "Deck",
            Nav::Actions => "Actions",
            Nav::Profiles => "Profiles",
            Nav::Screens => "OLED Screens",
            Nav::Connections => "Connections",
            Nav::Device => "Device",
            Nav::Settings => "Settings",
        }
    }
    fn icon(self) -> (Color32, Glyph) {
        match self {
            Nav::Deck => (theme::ACCENT, Glyph::Deck),
            Nav::Actions => (theme::ORANGE, Glyph::Bolt),
            Nav::Profiles => (theme::INDIGO, Glyph::Lines),
            Nav::Screens => (theme::TEXT, Glyph::Screen),
            Nav::Connections => (theme::ACCENT, Glyph::Bluetooth),
            Nav::Device => (theme::GRAY, Glyph::Chip),
            Nav::Settings => (theme::GRAY, Glyph::Gear),
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Mode {
    Hardware,
    Functions,
}

pub struct EditorApp {
    titlebar: TitleBar,
    nav: Nav,
    mode: Mode,
    deck: Deck,
    /// Selection in the hardware layout and in the functions editor.
    hw_sel: String,
    fn_sel: String,
    page: usize,
    /// Chosen display template per part (OLED: the idle screen).
    display: HashMap<String, usize>,
    wifi: bool,
    ble_hid: bool,
    oled_rotate: bool,
    enc_reverse: bool,
    sensitivity: f32,
    /// Live Wi-Fi link to the deck (runs PC actions in the background).
    link: Link,
}

impl EditorApp {
    pub fn new(cc: &eframe::CreationContext<'_>) -> Self {
        theme::install_fonts(&cc.egui_ctx);
        cc.egui_ctx.set_visuals(egui::Visuals::light());
        Self {
            titlebar: TitleBar::new(),
            nav: Nav::Deck,
            mode: Mode::Hardware,
            deck: Deck::new(),
            hw_sel: "T3".into(),
            fn_sel: "E2".into(),
            page: 0,
            display: HashMap::new(),
            wifi: true,
            ble_hid: true,
            oled_rotate: false,
            enc_reverse: false,
            sensitivity: 0.55,
            link: Link::start(cc.egui_ctx.clone()),
        }
    }
}

impl eframe::App for EditorApp {
    fn clear_color(&self, _visuals: &egui::Visuals) -> [f32; 4] {
        egui::Rgba::from(theme::BG).to_array()
    }

    fn ui(&mut self, ui: &mut Ui, _frame: &mut eframe::Frame) {
        let ctx = ui.ctx().clone();
        let full = ctx.content_rect();
        let body = Rect::from_min_max(full.min + Vec2::new(0.0, titlebar::HEIGHT), full.max);
        let p = ui.painter().clone();
        p.rect_filled(full, 0.0, theme::BG);

        let sidebar = Rect::from_min_max(body.min, Pos2::new(body.left() + SIDEBAR_W, body.bottom()));
        let main = Rect::from_min_max(Pos2::new(sidebar.right(), body.top()), body.max);
        self.sidebar(ui, &p, sidebar);
        let header = Rect::from_min_size(main.min, Vec2::new(main.width(), HEADER_H));
        let content = Rect::from_min_max(Pos2::new(main.left(), header.bottom()), main.max);
        self.header(ui, &p, header);
        match (self.nav, self.mode) {
            (Nav::Deck, Mode::Hardware) => self.hardware(ui, &p, content),
            (Nav::Deck, Mode::Functions) => self.functions(ui, &p, content),
            (Nav::Connections, _) => self.connections(ui, content),
            _ => {
                p.text(
                    content.center(),
                    Align2::CENTER_CENTER,
                    format!("{} isn't in the UI design yet.", self.nav.label()),
                    theme::regular(13.0),
                    theme::SECONDARY,
                );
            }
        }

        self.titlebar.show(&ctx, true);
    }
}

fn hline(p: &Painter, a: Pos2, b: Pos2) {
    p.line_segment([a, b], Stroke::new(1.0, theme::HAIRLINE));
}

fn row_text(p: &Painter, row: Rect, left: &str, right: &str, right_font: egui::FontId) {
    p.text(Pos2::new(row.left() + 12.0, row.center().y), Align2::LEFT_CENTER, left, theme::regular(13.0), theme::TEXT);
    if !right.is_empty() {
        p.text(Pos2::new(row.right() - 12.0, row.center().y), Align2::RIGHT_CENTER, right, right_font, theme::SECONDARY);
    }
}

fn two_line(p: &Painter, row: Rect, title: &str, sub: &str) {
    let x = row.left() + 12.0;
    p.text(Pos2::new(x, row.center().y - 1.0), Align2::LEFT_BOTTOM, title, theme::regular(13.0), theme::TEXT);
    p.text(Pos2::new(x, row.center().y + 1.0), Align2::LEFT_TOP, sub, theme::regular(11.0), theme::SECONDARY);
}

fn switch_at(ui: &Ui, row: Rect, id: &str, value: &mut bool) {
    let r = Rect::from_min_size(Pos2::new(row.right() - 12.0 - 32.0, row.center().y - 9.0), Vec2::new(32.0, 18.0));
    if draw::switch(ui, r, id, *value) {
        *value = !*value;
    }
}

/// A segmented control; returns the clicked index.
fn segmented(ui: &Ui, p: &Painter, center: Pos2, labels: &[&str], selected: usize, id: &str, plus: bool) -> Option<usize> {
    let font = theme::regular(13.0);
    let widths: Vec<f32> = labels.iter().map(|l| draw::text_width(p, l, font.clone()) + 32.0).collect();
    let extra = if plus { 31.0 } else { 0.0 };
    let total = widths.iter().sum::<f32>() + extra + 4.0;
    let outer = Rect::from_center_size(center, Vec2::new(total, 28.0));
    p.rect_filled(outer, 7.0, theme::QUIET);
    let mut x = outer.left() + 2.0;
    let mut clicked = None;
    for (i, (label, w)) in labels.iter().zip(&widths).enumerate() {
        let r = Rect::from_min_size(Pos2::new(x, outer.top() + 2.0), Vec2::new(*w, 24.0));
        x += w;
        if i == selected {
            draw::shadow(p, r, 5.0, 1, 2, 30);
            p.rect_filled(r, 5.0, Color32::WHITE);
        }
        if draw::hit(ui, r, (id, i)).clicked() {
            clicked = Some(i);
        }
        p.text(r.center(), Align2::CENTER_CENTER, *label, font.clone(), theme::TEXT);
    }
    if plus {
        let r = Rect::from_min_size(Pos2::new(x, outer.top() + 2.0), Vec2::new(31.0, 24.0));
        let resp = draw::hit(ui, r, (id, "plus"));
        if resp.hovered() {
            p.rect_filled(r, 5.0, theme::QUIET);
        }
        resp.on_hover_text("Add page");
        draw::glyph(p, r.center(), 11.0, Glyph::Plus, theme::ICON, 2.6);
    }
    clicked
}

impl EditorApp {
    fn sidebar(&mut self, ui: &Ui, p: &Painter, rect: Rect) {
        p.rect_filled(rect, 0.0, theme::SIDEBAR);
        hline(p, rect.right_top(), rect.right_bottom());

        // Device card.
        let top = rect.top() + 14.0;
        let tile = Rect::from_min_size(Pos2::new(rect.left() + 18.0, top), Vec2::splat(36.0));
        p.rect_filled(tile, 9.0, theme::TEXT);
        draw::deck_logo(p, tile.center(), 18.0, Color32::WHITE);
        let tx = tile.right() + 10.0;
        p.text(Pos2::new(tx, tile.center().y), Align2::LEFT_BOTTOM, "Desk Deck", theme::semibold(13.0), theme::TEXT);
        p.text(Pos2::new(tx, tile.center().y + 1.0), Align2::LEFT_TOP, "Standalone · Wi-Fi + BLE", theme::regular(11.0), theme::SECONDARY);

        let mut y = tile.bottom() + 18.0;
        let groups: [&[Nav]; 2] = [
            &[Nav::Deck, Nav::Actions, Nav::Profiles, Nav::Screens, Nav::Connections],
            &[Nav::Device, Nav::Settings],
        ];
        for (gi, items) in groups.iter().enumerate() {
            if gi > 0 {
                y += 14.0;
            }
            for &nav in *items {
                let r = Rect::from_min_size(Pos2::new(rect.left() + 10.0, y), Vec2::new(rect.width() - 20.0, 30.0));
                y += 30.0;
                let resp = draw::hit(ui, r, ("nav", nav.label()));
                let on = self.nav == nav;
                if on {
                    p.rect_filled(r, 7.0, theme::ACCENT);
                } else if resp.hovered() {
                    p.rect_filled(r, 7.0, Color32::from_black_alpha(10));
                }
                let (color, glyph) = nav.icon();
                let sq = Rect::from_min_size(Pos2::new(r.left() + 8.0, r.center().y - 10.0), Vec2::splat(20.0));
                let sq_fill = if on { Color32::from_white_alpha(64) } else { color };
                p.rect_filled(sq, 5.0, sq_fill);
                draw::glyph(p, sq.center(), 12.0, glyph, Color32::WHITE, 2.4);
                let text = if on { Color32::WHITE } else { theme::TEXT };
                p.text(Pos2::new(sq.right() + 8.0, r.center().y), Align2::LEFT_CENTER, nav.label(), theme::regular(13.0), text);
                if resp.clicked() {
                    self.nav = nav;
                }
            }
        }
    }

    fn header(&mut self, ui: &Ui, p: &Painter, rect: Rect) {
        p.rect_filled(rect, 0.0, theme::HEADER);
        hline(p, rect.left_bottom(), rect.right_bottom());
        let cy = rect.center().y;
        let title = self.nav.label();
        let title_r = p.text(Pos2::new(rect.left() + 20.0, cy), Align2::LEFT_CENTER, title, theme::semibold(15.0), theme::TEXT);
        if self.nav != Nav::Deck {
            return;
        }

        // Send to Device, then the mode-specific items leftwards.
        let send = Rect::from_min_size(Pos2::new(rect.right() - 14.0 - 116.0, cy - 14.0), Vec2::new(116.0, 28.0));
        draw::button(ui, send, "send", "Send to Device", theme::semibold(13.0), theme::ACCENT, Color32::WHITE)
            .on_hover_text("No deck connected yet");
        let mut right = send.left() - 10.0;
        match self.mode {
            Mode::Hardware => {
                let undo = Rect::from_min_size(Pos2::new(right - 32.0, cy - 14.0), Vec2::new(32.0, 28.0));
                let resp = draw::hit(ui, undo, "undo");
                if resp.hovered() {
                    p.rect_filled(undo, 6.0, theme::QUIET);
                }
                resp.on_hover_text("Undo");
                draw::glyph(p, undo.center(), 16.0, Glyph::Undo, theme::ICON, 1.8);
            }
            Mode::Functions => {
                right += 6.0;
                for (label, glyph, color) in [
                    ("2 paired", Glyph::Bluetooth, theme::ACCENT),
                    ("Home-5G", Glyph::Wifi, theme::GREEN),
                ] {
                    let w = draw::text_width(p, label, theme::regular(12.0)) + 20.0 + 19.0;
                    let chip = Rect::from_min_size(Pos2::new(right - w, cy - 12.0), Vec2::new(w, 24.0));
                    right = chip.left() - 8.0;
                    p.rect_filled(chip, 12.0, Color32::from_black_alpha(13));
                    draw::glyph(p, Pos2::new(chip.left() + 16.5, cy), 13.0, glyph, color, 2.2);
                    p.text(Pos2::new(chip.left() + 29.0, cy), Align2::LEFT_CENTER, label, theme::regular(12.0), theme::TEXT);
                }
                // Page pop-up next to the title.
                let label = PAGES[self.page];
                let w = draw::text_width(p, label, theme::regular(13.0)) + 31.0;
                let pop = Rect::from_min_size(Pos2::new(title_r.right() + 16.0, cy - 12.0), Vec2::new(w, 24.0));
                let resp = draw::hit(ui, pop, "page-pop");
                p.rect_filled(pop, 6.0, Color32::from_black_alpha(13));
                p.text(Pos2::new(pop.left() + 10.0, cy), Align2::LEFT_CENTER, label, theme::regular(13.0), theme::TEXT);
                draw::updown(p, Pos2::new(pop.right() - 11.0, cy), theme::TEXT);
                if resp.clicked() {
                    self.page = (self.page + 1) % PAGES.len();
                }
            }
        }

        let selected = if self.mode == Mode::Hardware { 0 } else { 1 };
        if let Some(i) = segmented(ui, p, Pos2::new(rect.center().x, cy), &["Hardware", "Functions"], selected, "mode", false) {
            self.mode = if i == 0 { Mode::Hardware } else { Mode::Functions };
        }
    }

    // ---- A · Hardware layout ------------------------------------------------

    fn hardware(&mut self, ui: &Ui, p: &Painter, rect: Rect) {
        let inspector = Rect::from_min_max(Pos2::new(rect.right() - 300.0, rect.top()), rect.max);
        let stage = Rect::from_min_max(rect.min, Pos2::new(inspector.left(), rect.bottom()));

        if !self.deck.els.iter().any(|e| e.id == self.hw_sel) {
            self.hw_sel = "OLED".into();
        }
        let style = DeckStyle { slot: 88.0, gap: 14.0, padding: 24.0, radius: 28.0, show_free: true };
        let size = style.size();
        let total_h = size.y + 22.0 + 16.0;
        let plate = Rect::from_min_size(
            Pos2::new(stage.center().x - size.x / 2.0, stage.center().y - total_h / 2.0),
            size,
        );
        let face = OledFace::Status { title: "CODING", line: "PAGE 1/3  ·  14:06" };
        match draw_deck(ui, plate, &style, &self.deck, &self.hw_sel, face) {
            Some(DeckEvent::Select(id)) => self.hw_sel = id,
            Some(DeckEvent::MoveTo(slot)) => {
                let id = self.hw_sel.clone();
                self.deck.move_to(&id, slot);
            }
            None => {}
        }
        p.text(
            Pos2::new(stage.center().x, plate.bottom() + 22.0),
            Align2::CENTER_TOP,
            format!("{} selected · click an empty slot to move it there", self.hw_sel),
            theme::regular(12.0),
            theme::SECONDARY,
        );

        self.hardware_inspector(ui, p, inspector);
    }

    fn hardware_inspector(&mut self, ui: &Ui, p: &Painter, rect: Rect) {
        hline(p, rect.left_top(), rect.left_bottom());
        let x = rect.left() + 16.0;
        let w = rect.width() - 32.0;
        let mut y = rect.top() + 20.0;

        y = draw::heading(p, x, y, "Components");
        let rows = draw::group(p, x, y, w, &[36.0, 36.0, 36.0]);
        row_text(p, rows[0], "OLED display", "128 × 64 · 1", theme::regular(13.0));
        for (row, label, kind) in [(rows[1], "Touch pads", Kind::Touch), (rows[2], "Rotary encoders", Kind::Enc)] {
            row_text(p, row, label, "", theme::regular(13.0));
            let step = draw::stepper(ui, Pos2::new(row.right() - 12.0, row.center().y), label);
            p.text(
                Pos2::new(row.right() - 12.0 - 52.5 - 10.0, row.center().y),
                Align2::RIGHT_CENTER,
                self.deck.count(kind).to_string(),
                theme::regular(13.0),
                theme::SECONDARY,
            );
            match step {
                1 => {
                    if let Some(id) = self.deck.add(kind) {
                        self.hw_sel = id;
                    }
                }
                -1 => {
                    if self.deck.remove_last(kind).as_deref() == Some(self.hw_sel.as_str()) {
                        self.hw_sel = "OLED".into();
                    }
                }
                _ => {}
            }
        }
        y = rows[2].bottom() + 6.0;
        p.text(
            Pos2::new(x + 12.0, y),
            Align2::LEFT_TOP,
            format!("Uses {} of {TOUCH_GPIO_TOTAL} touch-capable GPIO pins.", self.deck.count(Kind::Touch)),
            theme::regular(11.0),
            theme::SECONDARY,
        );
        y += 15.0 + 20.0;

        y = draw::heading(p, x, y, "Runs Without a Computer");
        let rows = draw::group(p, x, y, w, &[44.0, 44.0, 44.0]);
        two_line(p, rows[0], "Wi-Fi", "HTTP, MQTT, webhooks");
        switch_at(ui, rows[0], "wifi", &mut self.wifi);
        two_line(p, rows[1], "Bluetooth HID", "Keyboard & media keys to any host");
        switch_at(ui, rows[1], "ble", &mut self.ble_hid);
        two_line(p, rows[2], "Companion app", "Optional, for PC-only actions");
        p.text(Pos2::new(rows[2].right() - 12.0, rows[2].center().y), Align2::RIGHT_CENTER, "Not connected", theme::regular(12.0), theme::SECONDARY);
        y = rows[2].bottom() + 20.0;

        let Some(sel) = self.deck.get(&self.hw_sel).cloned() else {
            return;
        };
        y = draw::heading(p, x, y, &sel.title());
        let position = format!("Row {}, Column {}", sel.row() + 1, sel.col() + 1);
        let mono = theme::mono(12.0);
        match sel.kind {
            Kind::Oled => {
                let rows = draw::group(p, x, y, w, &[36.0; 4]);
                row_text(p, rows[0], "Position", &position, theme::regular(13.0));
                row_text(p, rows[1], "Bus", "I²C · 0x3C", mono.clone());
                row_text(p, rows[2], "SDA / SCL", &format!("GPIO {}", sel.pins()), mono);
                row_text(p, rows[3], "Rotate 180°", "", theme::regular(13.0));
                switch_at(ui, rows[3], "rotate", &mut self.oled_rotate);
            }
            Kind::Touch => {
                let rows = draw::group(p, x, y, w, &[36.0, 36.0, 58.0, 36.0]);
                row_text(p, rows[0], "Position", &position, theme::regular(13.0));
                row_text(p, rows[1], "Pin", "", theme::regular(13.0));
                draw::updown(p, Pos2::new(rows[1].right() - 16.5, rows[1].center().y), theme::SECONDARY);
                p.text(Pos2::new(rows[1].right() - 25.0, rows[1].center().y), Align2::RIGHT_CENTER, format!("GPIO {}", sel.pins()), mono, theme::SECONDARY);
                self.sensitivity_row(ui, p, rows[2]);
                row_text(p, rows[3], "Calibrate", "", theme::regular(13.0));
                let bw = draw::text_width(p, "Touch now…", theme::regular(12.0)) + 20.0;
                let b = Rect::from_min_size(Pos2::new(rows[3].right() - 12.0 - bw, rows[3].center().y - 11.0), Vec2::new(bw, 22.0));
                draw::button(ui, b, "calibrate", "Touch now…", theme::regular(12.0), theme::QUIET, theme::TEXT)
                    .on_hover_text("Needs a connected deck");
            }
            Kind::Enc => {
                let rows = draw::group(p, x, y, w, &[36.0; 4]);
                row_text(p, rows[0], "Position", &position, theme::regular(13.0));
                row_text(p, rows[1], "Pins A / B / SW", &sel.pins(), mono);
                row_text(p, rows[2], "Steps per detent", "", theme::regular(13.0));
                draw::updown(p, Pos2::new(rows[2].right() - 16.5, rows[2].center().y), theme::SECONDARY);
                p.text(Pos2::new(rows[2].right() - 25.0, rows[2].center().y), Align2::RIGHT_CENTER, "4", theme::regular(13.0), theme::SECONDARY);
                row_text(p, rows[3], "Reverse direction", "", theme::regular(13.0));
                switch_at(ui, rows[3], "reverse", &mut self.enc_reverse);
            }
        }

        // Footer.
        let fy = rect.bottom() - 20.0 - 12.0;
        let link = p.text(Pos2::new(x + 4.0, fy), Align2::LEFT_CENTER, "Assign functions →", theme::regular(13.0), theme::ACCENT);
        if draw::hit(ui, link.expand(4.0), "assign").clicked() {
            self.mode = Mode::Functions;
            self.fn_sel = self.hw_sel.clone();
        }
        let bw = draw::text_width(p, "Reset Layout", theme::regular(12.0)) + 20.0;
        let reset = Rect::from_min_size(Pos2::new(rect.right() - 16.0 - 4.0 - bw, fy - 12.0), Vec2::new(bw, 24.0));
        if draw::button(ui, reset, "reset", "Reset Layout", theme::regular(12.0), theme::QUIET, theme::TEXT).clicked() {
            self.deck = Deck::new();
            self.hw_sel = "T3".into();
        }
    }

    fn sensitivity_row(&mut self, ui: &Ui, p: &Painter, row: Rect) {
        let x0 = row.left() + 12.0;
        let x1 = row.right() - 12.0;
        let level = match self.sensitivity {
            v if v < 0.34 => "Low",
            v if v < 0.67 => "Medium",
            _ => "High",
        };
        p.text(Pos2::new(x0, row.top() + 10.0), Align2::LEFT_TOP, "Sensitivity", theme::regular(13.0), theme::TEXT);
        p.text(Pos2::new(x1, row.top() + 10.0), Align2::RIGHT_TOP, level, theme::regular(13.0), theme::SECONDARY);
        let ty = row.bottom() - 16.0;
        let track = Rect::from_min_max(Pos2::new(x0, ty - 2.0), Pos2::new(x1, ty + 2.0));
        let resp = ui.interact(track.expand2(Vec2::new(10.0, 10.0)), Id::new("sensitivity"), Sense::click_and_drag());
        if let Some(pos) = resp.interact_pointer_pos() {
            if resp.dragged() || resp.clicked() {
                self.sensitivity = ((pos.x - x0) / (x1 - x0)).clamp(0.0, 1.0);
            }
        }
        if resp.hovered() || resp.dragged() {
            ui.ctx().set_cursor_icon(CursorIcon::PointingHand);
        }
        p.rect_filled(track, 2.0, theme::SWITCH_OFF);
        let kx = egui::lerp(x0..=x1, self.sensitivity);
        p.rect_filled(Rect::from_min_max(track.min, Pos2::new(kx, track.bottom())), 2.0, theme::ACCENT);
        let knob = Pos2::new(kx.clamp(x0 + 10.0, x1 - 10.0), ty);
        p.circle_filled(knob + Vec2::new(0.0, 1.0), 10.0, Color32::from_black_alpha(45));
        p.circle_filled(knob, 10.0, Color32::WHITE);
        p.circle_stroke(knob, 10.0, Stroke::new(0.5, Color32::from_black_alpha(20)));
    }

    // ---- B · Functions & OLED -----------------------------------------------

    fn functions(&mut self, ui: &Ui, p: &Painter, rect: Rect) {
        let inspector = Rect::from_min_max(Pos2::new(rect.right() - 330.0, rect.top()), rect.max);
        let stage = Rect::from_min_max(rect.min, Pos2::new(inspector.left(), rect.bottom()));
        if !self.deck.els.iter().any(|e| e.id == self.fn_sel) {
            self.fn_sel = "OLED".into();
        }
        let Some(sel) = self.deck.get(&self.fn_sel).cloned() else {
            return;
        };
        let f = model::functions(&sel);
        let is_oled = sel.kind == Kind::Oled;
        let template = self.display.get(&sel.id).copied().unwrap_or(f.feedback.template);

        let style = DeckStyle { slot: 64.0, gap: 10.0, padding: 18.0, radius: 24.0, show_free: false };
        let size = style.size();
        let total = 28.0 + 24.0 + size.y + 24.0 + 212.0 + 10.0 + 16.0;
        let mut y = stage.center().y - total / 2.0;
        let cx = stage.center().x;

        if let Some(i) = segmented(ui, p, Pos2::new(cx, y + 14.0), &PAGES, self.page, "pages", true) {
            self.page = i;
        }
        y += 28.0 + 24.0;

        let idle = self.idle_screen();
        let plate = Rect::from_min_size(Pos2::new(cx - size.x / 2.0, y), size);
        let face = OledFace::Idle { top: &idle.0, big: &idle.1 };
        if let Some(DeckEvent::Select(id)) = draw_deck(ui, plate, &style, &self.deck, &self.fn_sel, face) {
            self.fn_sel = id;
        }
        y = plate.bottom() + 24.0;

        // OLED preview, 128×64 at 3×.
        let (mode, l1, l2, bar, caption) = if is_oled {
            let page = PAGES[self.page].to_uppercase();
            let (m, a, b) = match template {
                0 => (Preview::Big, "WED 4 NOV".to_owned(), "14:06".to_owned()),
                1 => (Preview::Two, page, format!("PAGE {}/3", self.page + 1)),
                _ => (Preview::Two, "WIFI  -52DBM".into(), "BLE  2 PAIRED".into()),
            };
            (m, a, b, 0.0, "Idle screen · 128 × 64".to_owned())
        } else if template == 3 {
            (Preview::Big, idle.0.clone(), idle.1.clone(), 0.0, "Feedback off · idle screen stays visible".to_owned())
        } else {
            let m = [Preview::Bar, Preview::Big, Preview::Two][template.min(2)];
            (m, f.feedback.title.to_owned(), f.feedback.value.to_owned(), f.feedback.bar, format!("Feedback after {} is used · 128 × 64", sel.id))
        };
        let frame = Rect::from_min_size(Pos2::new(cx - 202.0, y), Vec2::new(404.0, 212.0));
        draw::shadow(p, frame, 14.0, 8, 24, 46);
        p.rect_filled(frame, 14.0, Color32::from_rgb(0x1c, 0x1c, 0x1e));
        let screen = frame.shrink(10.0);
        draw_preview(p, screen, mode, &l1, &l2, bar);
        p.text(Pos2::new(cx, frame.bottom() + 10.0), Align2::CENTER_TOP, caption, theme::regular(12.0), theme::SECONDARY);

        self.functions_inspector(ui, p, inspector, &sel, &f, template);
    }

    /// The idle screen chosen for the OLED: (small line, big line).
    fn idle_screen(&self) -> (String, String) {
        match self.display.get("OLED").copied().unwrap_or(0) {
            0 => ("WED 4 NOV".into(), "14:06".into()),
            1 => ("PROFILE HOME".into(), PAGES[self.page].to_uppercase()),
            _ => ("WIFI -52  BLE 2".into(), "ONLINE".into()),
        }
    }

    fn functions_inspector(&mut self, ui: &Ui, p: &Painter, rect: Rect, sel: &model::Element, f: &model::Functions, template: usize) {
        hline(p, rect.left_top(), rect.left_bottom());
        let x = rect.left() + 16.0;
        let w = rect.width() - 32.0;
        let mut y = rect.top() + 20.0;

        // Title row.
        let tile = Rect::from_min_size(Pos2::new(x + 4.0, y), Vec2::splat(40.0));
        p.rect_filled(tile, 10.0, Color32::WHITE);
        p.rect_stroke(tile, 10.0, Stroke::new(0.6, Color32::from_black_alpha(30)), StrokeKind::Outside);
        p.text(tile.center(), Align2::CENTER_CENTER, &sel.id, theme::bold(12.0), theme::ICON);
        let name = if sel.kind == Kind::Oled { "OLED Display".to_owned() } else { sel.title() };
        p.text(Pos2::new(tile.right() + 12.0, tile.center().y + 1.0), Align2::LEFT_BOTTOM, name, theme::semibold(17.0), theme::TEXT);
        p.text(Pos2::new(tile.right() + 12.0, tile.center().y + 3.0), Align2::LEFT_TOP, format!("{} page", PAGES[self.page]), theme::regular(12.0), theme::SECONDARY);
        let badge = "No PC needed";
        let bw = draw::text_width(p, badge, theme::semibold(11.0)) + 16.0;
        let br = Rect::from_min_size(Pos2::new(rect.right() - 16.0 - 4.0 - bw, tile.center().y - 10.0), Vec2::new(bw, 20.0));
        p.rect_filled(br, 10.0, Color32::from_rgba_unmultiplied(52, 199, 89, 36));
        p.text(br.center(), Align2::CENTER_CENTER, badge, theme::semibold(11.0), theme::GREEN_TEXT);
        draw::hit(ui, br, "badge").on_hover_text("Works without a computer");
        y = tile.bottom() + 18.0;

        // Gestures / behaviour.
        y = draw::heading(p, x, y, f.section);
        let rows = draw::group(p, x, y, w, &vec![38.0; f.gestures.len()]);
        for (i, (row, g)) in rows.iter().zip(&f.gestures).enumerate() {
            p.text(Pos2::new(row.left() + 12.0, row.center().y), Align2::LEFT_CENTER, g.gesture, theme::regular(13.0), theme::TEXT);
            let font = theme::regular(13.0);
            let label = draw::ellipsize(p, g.action, &font, 150.0 - 8.0 - 21.0);
            let pw = draw::text_width(p, &label, font.clone()) + 8.0 + 21.0;
            let pop = Rect::from_min_size(Pos2::new(row.right() - 12.0 - pw, row.center().y - 12.0), Vec2::new(pw, 24.0));
            let resp = draw::hit(ui, pop, ("action", sel.id.as_str(), i));
            p.rect_filled(pop, 6.0, Color32::from_black_alpha(13));
            if resp.hovered() {
                p.rect_filled(pop, 6.0, Color32::from_black_alpha(8));
            }
            p.text(Pos2::new(pop.left() + 8.0, row.center().y), Align2::LEFT_CENTER, &label, font, theme::TEXT);
            draw::updown(p, Pos2::new(pop.right() - 10.5, row.center().y), theme::TEXT);
            if label != g.action {
                resp.on_hover_text(g.action);
            }
            let (via, fg, bg) = match g.via {
                Via::Wifi => ("Wi-Fi", theme::GREEN_TEXT, Color32::from_rgba_unmultiplied(52, 199, 89, 36)),
                Via::Ble => ("BLE", theme::BLUE_TEXT, Color32::from_rgba_unmultiplied(0, 122, 255, 31)),
                Via::Device => ("Device", theme::ICON, theme::QUIET),
                Via::None => ("", theme::SECONDARY, Color32::TRANSPARENT),
            };
            if !via.is_empty() {
                let vw = draw::text_width(p, via, theme::semibold(10.0)) + 12.0;
                let vr = Rect::from_min_size(Pos2::new(pop.left() - 6.0 - vw, row.center().y - 8.0), Vec2::new(vw, 16.0));
                p.rect_filled(vr, 8.0, bg);
                p.text(vr.center(), Align2::CENTER_CENTER, via, theme::semibold(10.0), fg);
            }
        }
        y = rows.last().map_or(y, |r| r.bottom()) + 18.0;

        // Display template.
        let (title, templates): (&str, &[(&str, &str)]) = if sel.kind == Kind::Oled {
            ("Idle Screen", &model::IDLE_TEMPLATES)
        } else {
            ("Display Feedback", &model::FEEDBACK_TEMPLATES)
        };
        y = draw::heading(p, x, y, title);
        let rows = draw::group(p, x, y, w, &vec![44.0; templates.len()]);
        for (i, (row, (name, desc))) in rows.iter().zip(templates).enumerate() {
            let resp = draw::hit(ui, *row, ("template", sel.id.as_str(), i));
            if resp.hovered() {
                p.rect_filled(row.shrink(0.5), 0.0, Color32::from_black_alpha(6));
            }
            two_line(p, *row, name, desc);
            if i == template {
                draw::glyph(p, Pos2::new(row.right() - 19.0, row.center().y), 14.0, Glyph::Check, theme::ACCENT, 3.0);
            }
            if resp.clicked() {
                self.display.insert(sel.id.clone(), i);
            }
        }
        y = rows.last().map_or(y, |r| r.bottom()) + 6.0;
        p.text(Pos2::new(x + 12.0, y), Align2::LEFT_TOP, "Built-in layouts only. Text and values come from the action.", theme::regular(11.0), theme::SECONDARY);

        // Footer.
        let fy = rect.bottom() - 20.0 - 12.0;
        let tw = draw::text_width(p, "Test on Device", theme::regular(12.0)) + 20.0;
        let test = Rect::from_min_size(Pos2::new(x + 4.0, fy - 12.0), Vec2::new(tw, 24.0));
        draw::button(ui, test, "test", "Test on Device", theme::regular(12.0), theme::QUIET, theme::TEXT)
            .on_hover_text("Needs a connected deck");
        let cw = draw::text_width(p, "Clear", theme::regular(12.0)) + 20.0;
        let clear = Rect::from_min_size(Pos2::new(rect.right() - 16.0 - 4.0 - cw, fy - 12.0), Vec2::new(cw, 24.0));
        if draw::button(ui, clear, "clear", "Clear", theme::regular(12.0), theme::QUIET, theme::RED).clicked() {
            self.display.remove(&sel.id);
        }
    }
}

#[derive(Clone, Copy)]
enum Preview {
    Bar,
    Big,
    Two,
}

/// The OLED at 3×, with a faint pixel grid.
fn draw_preview(p: &Painter, screen: Rect, mode: Preview, l1: &str, l2: &str, bar: f32) {
    p.rect_filled(screen, 0.0, Color32::BLACK);
    let grid = Stroke::new(1.0, Color32::from_white_alpha(10));
    let mut gx = screen.left();
    while gx < screen.right() {
        p.line_segment([Pos2::new(gx, screen.top()), Pos2::new(gx, screen.bottom())], grid);
        gx += 3.0;
    }
    let mut gy = screen.top();
    while gy < screen.bottom() {
        p.line_segment([Pos2::new(screen.left(), gy), Pos2::new(screen.right(), gy)], grid);
        gy += 3.0;
    }
    let ink = theme::OLED_INK;
    let cy = screen.center().y;
    match mode {
        Preview::Bar => {
            // 24 + 14 + 36 + 14 + 15 tall, centred.
            let x = screen.left() + 30.0;
            let top = cy - 103.0 / 2.0;
            p.text(Pos2::new(x, top), Align2::LEFT_TOP, l1, theme::pixel(24.0), ink);
            p.text(Pos2::new(x, top + 38.0), Align2::LEFT_TOP, l2, theme::pixel(36.0), ink);
            let track = Rect::from_min_max(Pos2::new(x, top + 88.0), Pos2::new(screen.right() - 30.0, top + 103.0));
            p.rect_stroke(track, 0.0, Stroke::new(3.0, ink), StrokeKind::Inside);
            let fill = Rect::from_min_max(track.min, Pos2::new(track.left() + track.width() * bar / 100.0, track.bottom()));
            p.rect_filled(fill, 0.0, ink);
        }
        Preview::Big => {
            p.text(Pos2::new(screen.center().x, cy - 6.0 - 9.0), Align2::CENTER_BOTTOM, l1, theme::pixel(18.0), ink);
            p.text(Pos2::new(screen.center().x, cy - 6.0 + 6.0), Align2::CENTER_TOP, l2, theme::pixel(54.0), ink);
        }
        Preview::Two => {
            let x = screen.left() + 30.0;
            let top = cy - (30.0 + 18.0 + 3.0 + 18.0 + 24.0) / 2.0;
            p.text(Pos2::new(x, top), Align2::LEFT_TOP, l1, theme::pixel(30.0), ink);
            let rule = Rect::from_min_size(Pos2::new(x, top + 48.0), Vec2::new(screen.width() - 60.0, 3.0));
            p.rect_filled(rule, 0.0, ink);
            p.text(Pos2::new(x, top + 69.0), Align2::LEFT_TOP, l2, theme::pixel(24.0), ink);
        }
    }
}

// ------------------------------------------------------------ Connections

impl EditorApp {
    /// Live link to the deck and the pad → PC shortcut table.
    fn connections(&mut self, ui: &mut Ui, rect: Rect) {
        use std::time::Duration;
        use egui::{RichText, TextEdit};

        let (status, log, last_touch, mut bindings) = {
            let s = self.link.shared.lock().unwrap_or_else(|e| e.into_inner());
            (s.status.clone(), s.log.clone(), s.last_touch, s.bindings.clone())
        };
        let before = bindings.clone();
        let flash = Duration::from_millis(700);
        let mut animating = false;

        let area = rect.shrink2(Vec2::new(36.0, 26.0));
        ui.scope_builder(egui::UiBuilder::new().max_rect(area), |ui| {
            ui.spacing_mut().item_spacing = Vec2::new(10.0, 8.0);
            let heading = |t: &str| RichText::new(t).font(theme::semibold(16.0)).color(theme::TEXT);
            let note = |t: &str| RichText::new(t).font(theme::regular(12.5)).color(theme::SECONDARY);

            ui.label(heading("Deck connection"));
            ui.horizontal(|ui| {
                let (color, text) = match &status {
                    Status::Connected { addr, id, fw } => {
                        (theme::GREEN, format!("Connected over Wi-Fi · {} · firmware {fw} · id {id}", addr.ip()))
                    }
                    Status::Searching => (theme::ORANGE, "Looking for ESPDeck on the network…".to_owned()),
                };
                let (dot, _) = ui.allocate_exact_size(Vec2::splat(10.0), Sense::hover());
                ui.painter().circle_filled(dot.center(), 5.0, color);
                ui.label(RichText::new(text).font(theme::regular(13.5)).color(theme::TEXT));
            });
            if status == Status::Searching {
                ui.label(note("The deck needs power and Wi-Fi only – it is found automatically (mDNS, espdeck.local)."));
            }

            ui.add_space(14.0);
            ui.label(heading("Touch pads → PC shortcuts"));
            ui.label(note(
                "Tap a pad on the deck and it lights up here. Examples: Ctrl+C · Win+Shift+S · Alt+Tab · PlayPause · VolUp · F5",
            ));
            ui.add_space(4.0);
            egui::Grid::new("pad_bindings").num_columns(4).spacing([18.0, 10.0]).show(ui, |ui| {
                for h in ["Pad", "Shortcut", "Text on the deck", ""] {
                    ui.label(RichText::new(h).font(theme::semibold(12.0)).color(theme::SECONDARY));
                }
                ui.end_row();
                for pad in 1..=PADS {
                    let recent = last_touch[pad as usize].is_some_and(|t| t.elapsed() < flash);
                    animating |= recent;
                    let name = RichText::new(format!("  Pad {pad}  ")).font(theme::semibold(14.0));
                    ui.label(if recent {
                        name.color(Color32::WHITE).background_color(theme::ACCENT)
                    } else {
                        name.color(theme::TEXT)
                    });
                    let b = bindings.pads.entry(pad).or_default();
                    ui.add(TextEdit::singleline(&mut b.shortcut).hint_text("none").desired_width(190.0));
                    ui.add(TextEdit::singleline(&mut b.label).hint_text("e.g. COPY").desired_width(150.0));
                    let state = if b.shortcut.trim().is_empty() {
                        let t = if pad == 1 || pad == 3 { "lights on the deck itself" } else { "no PC action" };
                        RichText::new(t).color(theme::SECONDARY)
                    } else {
                        match actions::parse(&b.shortcut) {
                            Ok(_) => RichText::new("OK").color(theme::GREEN_TEXT),
                            Err(e) => RichText::new(e).color(theme::RED),
                        }
                    };
                    ui.label(state.font(theme::regular(12.5)));
                    ui.end_row();
                }
            });

            ui.add_space(14.0);
            ui.label(heading("Live events"));
            egui::Frame::new()
                .fill(theme::HEADER)
                .stroke(Stroke::new(1.0, theme::HAIRLINE))
                .corner_radius(8)
                .inner_margin(12)
                .show(ui, |ui| {
                    ui.set_min_width(ui.available_width());
                    if log.is_empty() {
                        ui.label(note("Nothing yet – touch a pad or turn the encoder."));
                    }
                    for line in log.iter().rev() {
                        ui.label(RichText::new(line).font(theme::mono(12.0)).color(theme::TEXT));
                    }
                });
        });

        if bindings != before {
            if let Err(e) = bindings.save() {
                eprintln!("saving bindings: {e}");
            }
            self.link.shared.lock().unwrap_or_else(|e| e.into_inner()).bindings = bindings;
        }
        if animating {
            ui.ctx().request_repaint_after(Duration::from_millis(100));
        }
    }
}
