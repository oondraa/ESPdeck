//! What the editor edits: where the parts sit on the deck, and what each
//! one does. For now this is the sample data from the UI design; it will
//! come from `espdeck-daemon` (ProfileStore) once that exists.

pub const COLS: usize = 6;
pub const ROWS: usize = 3;
pub const SLOTS: usize = COLS * ROWS;
const MAX_TOUCH: usize = 8;
const MAX_ENC: usize = 3;
/// Touch-capable GPIOs in the design's pin map.
pub const TOUCH_GPIO_TOTAL: usize = 14;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Kind {
    Oled,
    Touch,
    Enc,
}

#[derive(Clone, Debug)]
pub struct Element {
    pub id: String,
    pub kind: Kind,
    pub slot: usize,
}

impl Element {
    fn new(id: &str, kind: Kind, slot: usize) -> Self {
        Self {
            id: id.to_owned(),
            kind,
            slot,
        }
    }

    /// The OLED takes two slots side by side.
    pub fn covers(&self) -> impl Iterator<Item = usize> {
        let n = if self.kind == Kind::Oled { 2 } else { 1 };
        self.slot..self.slot + n
    }

    pub fn row(&self) -> usize {
        self.slot / COLS
    }
    pub fn col(&self) -> usize {
        self.slot % COLS
    }
    /// Index within its kind, from the id: `T3` → 2.
    fn index(&self) -> usize {
        self.id[1..].parse::<usize>().map_or(0, |n| n.saturating_sub(1))
    }

    pub fn name(&self) -> String {
        match self.kind {
            Kind::Oled => "OLED display".into(),
            Kind::Touch => format!("Touch pad {}", self.id),
            Kind::Enc => format!("Encoder {}", self.id),
        }
    }
    pub fn title(&self) -> String {
        match self.kind {
            Kind::Oled => "OLED Display".into(),
            Kind::Touch => format!("Touch Pad {}", self.id),
            Kind::Enc => format!("Encoder {}", self.id),
        }
    }
    /// The GPIO pins from the design's pin map.
    pub fn pins(&self) -> String {
        const TOUCH: [u8; MAX_TOUCH] = [1, 2, 3, 4, 5, 6, 7, 10];
        const ENC: [&str; MAX_ENC] = ["11 / 12 / 13", "14 / 15 / 16", "17 / 18 / 21"];
        match self.kind {
            Kind::Oled => "8 / 9".into(),
            Kind::Touch => TOUCH.get(self.index()).map_or_else(String::new, |p| p.to_string()),
            Kind::Enc => ENC.get(self.index()).map_or("", |p| p).to_owned(),
        }
    }
}

pub struct Deck {
    pub els: Vec<Element>,
}

impl Deck {
    pub fn defaults() -> Vec<Element> {
        use Kind::*;
        vec![
            Element::new("OLED", Oled, 0),
            Element::new("T1", Touch, 2),
            Element::new("T2", Touch, 3),
            Element::new("T3", Touch, 4),
            Element::new("T4", Touch, 8),
            Element::new("T5", Touch, 9),
            Element::new("T6", Touch, 10),
            Element::new("E1", Enc, 5),
            Element::new("E2", Enc, 11),
        ]
    }

    pub fn new() -> Self {
        Self {
            els: Self::defaults(),
        }
    }

    pub fn get(&self, id: &str) -> Option<&Element> {
        self.els.iter().find(|e| e.id == id)
    }

    pub fn count(&self, kind: Kind) -> usize {
        self.els.iter().filter(|e| e.kind == kind).count()
    }

    pub fn occupied(&self, skip: Option<&str>) -> [bool; SLOTS] {
        let mut o = [false; SLOTS];
        for e in self.els.iter().filter(|e| Some(e.id.as_str()) != skip) {
            for s in e.covers().filter(|&s| s < SLOTS) {
                o[s] = true;
            }
        }
        o
    }

    fn first_free(&self) -> Option<usize> {
        let o = self.occupied(None);
        (0..SLOTS).find(|&s| !o[s])
    }

    /// Adds a part in the first free slot; returns its id.
    pub fn add(&mut self, kind: Kind) -> Option<String> {
        let (prefix, max) = match kind {
            Kind::Touch => ("T", MAX_TOUCH),
            Kind::Enc => ("E", MAX_ENC),
            Kind::Oled => return None,
        };
        let n = self.count(kind);
        let slot = self.first_free()?;
        if n >= max {
            return None;
        }
        let id = format!("{prefix}{}", n + 1);
        self.els.push(Element::new(&id, kind, slot));
        Some(id)
    }

    /// Removes the last part of a kind; returns its id.
    pub fn remove_last(&mut self, kind: Kind) -> Option<String> {
        let pos = self.els.iter().rposition(|e| e.kind == kind)?;
        Some(self.els.remove(pos).id)
    }

    /// Moves `id` to `slot` if it fits there.
    pub fn move_to(&mut self, id: &str, slot: usize) -> bool {
        let o = self.occupied(Some(id));
        let Some(e) = self.els.iter_mut().find(|e| e.id == id) else {
            return false;
        };
        let fits = match e.kind {
            Kind::Oled => slot % COLS < COLS - 1 && !o[slot] && !o[slot + 1],
            _ => !o[slot],
        };
        if fits {
            e.slot = slot;
        }
        fits
    }
}

/// How an action reaches its target.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Via {
    Wifi,
    Ble,
    Device,
    None,
}

pub struct Gesture {
    pub gesture: &'static str,
    pub action: &'static str,
    pub via: Via,
}

/// Sample OLED feedback shown after a part is used.
pub struct Feedback {
    pub template: usize,
    pub title: &'static str,
    pub value: &'static str,
    pub bar: f32,
}

pub struct Functions {
    pub section: &'static str,
    pub gestures: Vec<Gesture>,
    pub feedback: Feedback,
}

pub const PAGES: [&str; 3] = ["Home", "Media", "Office"];

/// The design's sample assignments; parts added in the editor start empty.
pub fn functions(el: &Element) -> Functions {
    use Via::*;
    let g = |gesture, action, via| Gesture {
        gesture,
        action,
        via,
    };
    let fb = |template, title, value, bar| Feedback {
        template,
        title,
        value,
        bar,
    };
    let (gestures, feedback) = match el.id.as_str() {
        "OLED" => (
            vec![
                g("Wake on", "Any touch or turn", Device),
                g("Sleep after", "2 minutes", Device),
                g("Feedback for", "1.5 s", Device),
            ],
            fb(0, "", "", 0.0),
        ),
        "T1" => (
            vec![
                g("Tap", "HTTP · Living room lights", Wifi),
                g("Long press", "HTTP · All lights off", Wifi),
                g("Double tap", "None", None),
            ],
            fb(1, "LIVING RM", "ON", 50.0),
        ),
        "T2" => (
            vec![
                g("Tap", "MQTT · desk/fan toggle", Wifi),
                g("Long press", "None", None),
                g("Double tap", "None", None),
            ],
            fb(1, "DESK FAN", "OFF", 50.0),
        ),
        "T3" => (
            vec![
                g("Tap", "Media · Play / Pause", Ble),
                g("Long press", "Media · Stop", Ble),
                g("Double tap", "Media · Next track", Ble),
            ],
            fb(2, "PLAYING", "BT · TV", 50.0),
        ),
        "T4" => (
            vec![
                g("Tap", "Keyboard · Win + L", Ble),
                g("Long press", "Keyboard · Ctrl Alt Del", Ble),
                g("Double tap", "None", None),
            ],
            fb(2, "LOCKED", "BT · LAPTOP", 50.0),
        ),
        "T5" => (
            vec![
                g("Tap", "None", None),
                g("Long press", "HTTP · Open garage", Wifi),
                g("Double tap", "None", None),
            ],
            fb(1, "GARAGE", "OPENING", 50.0),
        ),
        "T6" => (
            vec![
                g("Tap", "Next page", Device),
                g("Long press", "Switch profile", Device),
                g("Double tap", "Previous page", Device),
            ],
            fb(2, "PAGE 2/3", "MEDIA", 50.0),
        ),
        "E1" => (
            vec![
                g("Rotate left", "Media · Volume down", Ble),
                g("Rotate right", "Media · Volume up", Ble),
                g("Press", "Media · Mute", Ble),
                g("Press + rotate", "Switch BLE host", Device),
            ],
            fb(0, "VOLUME", "42%", 42.0),
        ),
        "E2" => (
            vec![
                g("Rotate left", "HTTP · Brightness −5", Wifi),
                g("Rotate right", "HTTP · Brightness +5", Wifi),
                g("Press", "HTTP · Toggle lamp", Wifi),
                g("Press + rotate", "HTTP · Colour temp", Wifi),
            ],
            fb(0, "DESK LAMP", "65%", 65.0),
        ),
        _ => {
            let gestures = match el.kind {
                Kind::Enc => vec![
                    g("Rotate left", "None", None),
                    g("Rotate right", "None", None),
                    g("Press", "None", None),
                    g("Press + rotate", "None", None),
                ],
                _ => vec![
                    g("Tap", "None", None),
                    g("Long press", "None", None),
                    g("Double tap", "None", None),
                ],
            };
            (gestures, fb(3, "", "", 0.0))
        }
    };
    Functions {
        section: if el.kind == Kind::Oled { "Behaviour" } else { "Gestures" },
        gestures,
        feedback,
    }
}

/// Display templates: (name, description).
pub const IDLE_TEMPLATES: [(&str, &str); 3] = [
    ("Clock", "Time and date"),
    ("Page name", "Current page and profile"),
    ("Connection", "Wi-Fi and Bluetooth status"),
];
pub const FEEDBACK_TEMPLATES: [(&str, &str); 4] = [
    ("Value + bar", "Title, value and progress"),
    ("Big text", "Short status, large"),
    ("Two lines", "Title and detail"),
    ("Off", "No feedback on screen"),
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn oled_cannot_hang_over_the_edge() {
        let mut d = Deck::new();
        assert!(!d.move_to("OLED", 5), "last column has no room for two slots");
        assert!(d.move_to("OLED", 12), "row 3 starts empty");
        assert_eq!(d.get("OLED").unwrap().slot, 12);
    }

    #[test]
    fn cannot_move_onto_another_part() {
        let mut d = Deck::new();
        assert!(!d.move_to("T1", 3));
        assert!(d.move_to("T1", 17));
    }

    #[test]
    fn add_respects_limits_and_free_slots() {
        let mut d = Deck::new();
        assert_eq!(d.add(Kind::Touch).as_deref(), Some("T7"));
        assert_eq!(d.add(Kind::Touch).as_deref(), Some("T8"));
        assert_eq!(d.add(Kind::Touch), None, "eight touch pads at most");
        assert_eq!(d.add(Kind::Enc).as_deref(), Some("E3"));
        assert_eq!(d.add(Kind::Enc), None);
        assert_eq!(d.remove_last(Kind::Enc).as_deref(), Some("E3"));
    }
}
