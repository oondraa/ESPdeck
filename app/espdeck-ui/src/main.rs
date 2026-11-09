//! ESPDeck desktop editor. The window has no system frame; the title bar
//! is our own (titlebar.rs, the same one as OZBEAT's).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod actions;
mod app;
mod deck;
mod draw;
mod link;
mod model;
mod theme;
mod titlebar;

use std::process::ExitCode;

use eframe::egui;

fn main() -> ExitCode {
    let viewport = egui::ViewportBuilder::default()
        .with_title("ESPDeck")
        .with_inner_size([1280.0, 800.0 + titlebar::HEIGHT])
        .with_min_inner_size([1180.0, 760.0])
        // The title bar is our own (titlebar.rs).
        .with_decorations(false);
    let options = eframe::NativeOptions {
        viewport,
        ..Default::default()
    };
    let result = eframe::run_native(
        "ESPDeck",
        options,
        Box::new(|cc| Ok(Box::new(app::EditorApp::new(cc)))),
    );
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("window error: {e}");
            ExitCode::FAILURE
        }
    }
}
