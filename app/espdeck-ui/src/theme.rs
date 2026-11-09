//! Colours and fonts from the UI design (`ESPDeck UI UX navrh.html`).

use std::sync::Arc;

use eframe::egui::{self, Color32, FontData, FontDefinitions, FontFamily, FontId};

pub const ACCENT: Color32 = Color32::from_rgb(0x00, 0x7a, 0xff);
pub const TEXT: Color32 = Color32::from_rgb(0x1d, 0x1d, 0x1f);
pub const SECONDARY: Color32 = Color32::from_rgb(0x86, 0x86, 0x8b);
pub const ICON: Color32 = Color32::from_rgb(0x51, 0x51, 0x54);
pub const BG: Color32 = Color32::from_rgb(0xf5, 0xf5, 0xf7);
pub const SIDEBAR: Color32 = Color32::from_rgb(0xe9, 0xe9, 0xeb);
pub const HEADER: Color32 = Color32::from_rgb(0xfb, 0xfb, 0xfd);
pub const PLATE: Color32 = Color32::from_rgb(0xe4, 0xe5, 0xe9);
pub const PAD: Color32 = Color32::from_rgb(0xf4, 0xf4, 0xf6);
pub const KNOB: Color32 = Color32::from_rgb(0x2c, 0x2c, 0x2e);
pub const KNOB_RING: Color32 = Color32::from_rgb(0xcf, 0xd0, 0xd5);
pub const GREEN: Color32 = Color32::from_rgb(0x34, 0xc7, 0x59);
pub const GREEN_TEXT: Color32 = Color32::from_rgb(0x24, 0x8a, 0x3d);
pub const BLUE_TEXT: Color32 = Color32::from_rgb(0x00, 0x62, 0xcc);
pub const SWITCH_OFF: Color32 = Color32::from_rgb(0xe3, 0xe3, 0xe8);
pub const RED: Color32 = Color32::from_rgb(0xff, 0x3b, 0x30);
pub const ORANGE: Color32 = Color32::from_rgb(0xff, 0x95, 0x00);
pub const INDIGO: Color32 = Color32::from_rgb(0x58, 0x56, 0xd6);
pub const GRAY: Color32 = Color32::from_rgb(0x8e, 0x8e, 0x93);
pub const OLED_INK: Color32 = Color32::from_rgb(0xf2, 0xf2, 0xf2);
/// The 0.5 px `rgba(0,0,0,.12)` dividers.
pub const HAIRLINE: Color32 = Color32::from_rgba_premultiplied(0, 0, 0, 26);
/// Fill of quiet buttons, `rgba(0,0,0,.06)`.
pub const QUIET: Color32 = Color32::from_rgba_premultiplied(0, 0, 0, 15);

pub const SEMIBOLD: &str = "semibold";
pub const BOLD: &str = "bold";
pub const PIXEL: &str = "pixel";

pub fn regular(size: f32) -> FontId {
    FontId::new(size, FontFamily::Proportional)
}
pub fn semibold(size: f32) -> FontId {
    FontId::new(size, FontFamily::Name(SEMIBOLD.into()))
}
pub fn bold(size: f32) -> FontId {
    FontId::new(size, FontFamily::Name(BOLD.into()))
}
pub fn mono(size: f32) -> FontId {
    FontId::new(size, FontFamily::Monospace)
}
pub fn pixel(size: f32) -> FontId {
    FontId::new(size, FontFamily::Name(PIXEL.into()))
}

/// The design asks for the system UI font, which on Windows is Segoe UI;
/// the monospace values use Consolas. Each falls back to egui's own fonts,
/// so the app still starts where they are missing.
pub fn install_fonts(ctx: &egui::Context) {
    let mut fonts = FontDefinitions::default();
    let fallback = fonts
        .families
        .get(&FontFamily::Proportional)
        .cloned()
        .unwrap_or_default();
    let mono_fallback = fonts
        .families
        .get(&FontFamily::Monospace)
        .cloned()
        .unwrap_or_default();

    let system: [(&str, &[&str]); 4] = [
        ("ui-regular", &["C:\\Windows\\Fonts\\segoeui.ttf"]),
        ("ui-semibold", &["C:\\Windows\\Fonts\\seguisb.ttf", "C:\\Windows\\Fonts\\segoeuib.ttf"]),
        ("ui-bold", &["C:\\Windows\\Fonts\\segoeuib.ttf"]),
        ("ui-mono", &["C:\\Windows\\Fonts\\consola.ttf"]),
    ];
    let mut loaded = |name: &str, paths: &[&str]| -> Option<String> {
        let bytes = paths.iter().find_map(|p| std::fs::read(p).ok())?;
        fonts
            .font_data
            .insert(name.to_owned(), Arc::new(FontData::from_owned(bytes)));
        Some(name.to_owned())
    };
    let names: Vec<Option<String>> = system.iter().map(|(n, p)| loaded(n, p)).collect();

    fonts.font_data.insert(
        PIXEL.to_owned(),
        Arc::new(FontData::from_static(include_bytes!(
            "../assets/fonts/Silkscreen-Regular.ttf"
        ))),
    );

    let chain = |first: &[Option<String>], rest: &[String]| -> Vec<String> {
        first.iter().flatten().cloned().chain(rest.iter().cloned()).collect()
    };
    let regular = chain(&names[0..1], &fallback);
    fonts.families.insert(FontFamily::Proportional, regular.clone());
    fonts.families.insert(
        FontFamily::Name(SEMIBOLD.into()),
        chain(&names[1..2], &regular),
    );
    fonts
        .families
        .insert(FontFamily::Name(BOLD.into()), chain(&names[2..3], &regular));
    fonts
        .families
        .insert(FontFamily::Monospace, chain(&names[3..4], &mono_fallback));
    fonts.families.insert(
        FontFamily::Name(PIXEL.into()),
        std::iter::once(PIXEL.to_owned()).chain(mono_fallback).collect(),
    );
    ctx.set_fonts(fonts);
}
