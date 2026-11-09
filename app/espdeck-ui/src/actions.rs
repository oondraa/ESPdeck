//! PC actions: which shortcut each touch pad presses, and pressing it.
//!
//! The deck only reports *events* ("pad 2 tapped"); what that does on this
//! PC is decided here. Bindings live in `%APPDATA%\ESPDeck\bindings.json`.

use std::collections::BTreeMap;
use std::path::PathBuf;

use enigo::{Direction, Enigo, Key, Keyboard};
use serde::{Deserialize, Serialize};

pub const PADS: u8 = 6;

#[derive(Clone, Default, PartialEq, Debug, Serialize, Deserialize)]
pub struct Binding {
    /// e.g. `Ctrl+C`, `Win+Shift+S`, `PlayPause`. Empty = nothing.
    pub shortcut: String,
    /// Shown on the deck's OLED after the action (ASCII, upper case looks best).
    pub label: String,
}

#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
pub struct Bindings {
    pub pads: BTreeMap<u8, Binding>,
}

impl Default for Bindings {
    fn default() -> Self {
        // Pads 1 and 3 switch the lights on the deck itself, so they start empty here.
        let b = |shortcut: &str, label: &str| Binding { shortcut: shortcut.into(), label: label.into() };
        let pads = BTreeMap::from([
            (1, Binding::default()),
            (2, b("Ctrl+C", "KOPIROVAT")),
            (3, Binding::default()),
            (4, b("Ctrl+V", "VLOZIT")),
            (5, b("Win+Shift+S", "VYSTRIZEK")),
            (6, b("Win+D", "PLOCHA")),
        ]);
        Self { pads }
    }
}

impl Bindings {
    fn path() -> Option<PathBuf> {
        Some(dirs::config_dir()?.join("ESPDeck").join("bindings.json"))
    }

    pub fn load() -> Self {
        let mut b: Self = Self::path()
            .and_then(|p| std::fs::read_to_string(p).ok())
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        for pad in 1..=PADS {
            b.pads.entry(pad).or_default();
        }
        b
    }

    pub fn save(&self) -> Result<(), String> {
        let path = Self::path().ok_or("no config directory")?;
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        let json = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        std::fs::write(path, json).map_err(|e| e.to_string())
    }
}

/// Letters and digits by virtual-key code, so `Ctrl+C` works whatever the
/// keyboard layout (on a Czech layout `Unicode('1')` would type `+`).
fn char_key(c: char) -> Key {
    #[cfg(windows)]
    {
        Key::Other(c.to_ascii_uppercase() as u32)
    }
    #[cfg(not(windows))]
    {
        Key::Unicode(c.to_ascii_lowercase())
    }
}

fn key_by_name(name: &str) -> Option<Key> {
    const F: [Key; 24] = [
        Key::F1, Key::F2, Key::F3, Key::F4, Key::F5, Key::F6, Key::F7, Key::F8, Key::F9, Key::F10, Key::F11, Key::F12,
        Key::F13, Key::F14, Key::F15, Key::F16, Key::F17, Key::F18, Key::F19, Key::F20, Key::F21, Key::F22, Key::F23,
        Key::F24,
    ];
    let n = name.trim().to_ascii_lowercase();
    let mut chars = n.chars();
    if let (Some(c), None) = (chars.next(), chars.next()) {
        if c.is_ascii_alphanumeric() {
            return Some(char_key(c));
        }
    }
    if let Some(num) = n.strip_prefix('f').and_then(|d| d.parse::<usize>().ok()) {
        return F.get(num.checked_sub(1)?).copied();
    }
    Some(match n.as_str() {
        "ctrl" | "control" => Key::Control,
        "shift" => Key::Shift,
        "alt" => Key::Alt,
        "win" | "meta" | "super" | "cmd" => Key::Meta,
        "enter" | "return" => Key::Return,
        "esc" | "escape" => Key::Escape,
        "tab" => Key::Tab,
        "space" => Key::Space,
        "backspace" => Key::Backspace,
        "del" | "delete" => Key::Delete,
        "ins" | "insert" => Key::Insert,
        "home" => Key::Home,
        "end" => Key::End,
        "pgup" | "pageup" => Key::PageUp,
        "pgdn" | "pagedown" => Key::PageDown,
        "up" => Key::UpArrow,
        "down" => Key::DownArrow,
        "left" => Key::LeftArrow,
        "right" => Key::RightArrow,
        "playpause" | "play" => Key::MediaPlayPause,
        "next" => Key::MediaNextTrack,
        "prev" | "previous" => Key::MediaPrevTrack,
        "volup" | "volumeup" => Key::VolumeUp,
        "voldown" | "volumedown" => Key::VolumeDown,
        "mute" => Key::VolumeMute,
        _ => return None,
    })
}

/// `"Ctrl+Shift+S"` → keys in press order. Errors name the unknown part.
pub fn parse(shortcut: &str) -> Result<Vec<Key>, String> {
    let keys = shortcut
        .split('+')
        .filter(|p| !p.trim().is_empty())
        .map(|p| key_by_name(p).ok_or_else(|| format!("unknown key \"{}\"", p.trim())))
        .collect::<Result<Vec<_>, _>>()?;
    if keys.is_empty() { Err("empty shortcut".into()) } else { Ok(keys) }
}

/// Holds the modifiers, taps the last key, releases in reverse.
pub fn press(enigo: &mut Enigo, keys: &[Key]) -> Result<(), String> {
    let Some((last, mods)) = keys.split_last() else { return Ok(()) };
    let mut res = Ok(());
    let mut held = 0;
    for k in mods {
        if let Err(e) = enigo.key(*k, Direction::Press) {
            res = Err(e.to_string());
            break;
        }
        held += 1;
    }
    if res.is_ok() {
        res = enigo.key(*last, Direction::Click).map_err(|e| e.to_string());
    }
    for k in mods[..held].iter().rev() {
        let _ = enigo.key(*k, Direction::Release);
    }
    res
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_common_shortcuts() {
        assert_eq!(parse("Ctrl+C").unwrap().len(), 2);
        assert_eq!(parse("win + shift + s").unwrap()[0], Key::Meta);
        assert_eq!(parse("F5").unwrap(), vec![Key::F5]);
        assert_eq!(parse("PlayPause").unwrap(), vec![Key::MediaPlayPause]);
        assert!(parse("Ctrl+Foo").unwrap_err().contains("Foo"));
        assert!(parse("").is_err());
        assert!(parse("F25").is_err());
    }

    #[test]
    fn defaults_cover_every_pad() {
        let b = Bindings::default();
        assert_eq!(b.pads.len(), PADS as usize);
        for binding in b.pads.values().filter(|b| !b.shortcut.is_empty()) {
            parse(&binding.shortcut).unwrap();
        }
    }
}
