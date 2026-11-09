//! Link to the deck over Wi-Fi.
//!
//! The deck runs a TCP server (port 4545) and advertises `_espdeck._tcp` over
//! mDNS. A background thread finds it, keeps the connection alive (ping every
//! 2 s) and runs the bound PC action for each touch, so shortcuts work even
//! while the window is minimised.
//!
//! Wire format: one JSON object per line.
//!   deck → PC: `hello`, `touch{pad}`, `enc{d}`, `btn{ev}`, `pong`
//!   PC → deck: `ping`, `show{text}` (text for the OLED)

use std::collections::VecDeque;
use std::io::{ErrorKind, Read, Write};
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use eframe::egui;
use enigo::{Enigo, Settings};
use mdns_sd::{ServiceDaemon, ServiceEvent};
use serde_json::{Value, json};

use crate::actions::{self, Bindings, PADS};

pub const PORT: u16 = 4545;
const MDNS_SERVICE: &str = "_espdeck._tcp.local.";
const FALLBACK_HOST: &str = "espdeck.local";
const PING_EVERY: Duration = Duration::from_secs(2);
const DEAD_AFTER: Duration = Duration::from_secs(6);
const LOG_LINES: usize = 14;

#[derive(Clone, PartialEq)]
pub enum Status {
    Searching,
    Connected { addr: SocketAddr, id: String, fw: String },
}

pub struct Shared {
    pub status: Status,
    pub log: VecDeque<String>,
    /// When each pad (1-based) was last touched – for the live highlight.
    pub last_touch: [Option<Instant>; PADS as usize + 1],
    pub bindings: Bindings,
}

impl Shared {
    fn log(&mut self, line: impl Into<String>) {
        if self.log.len() == LOG_LINES {
            self.log.pop_front();
        }
        self.log.push_back(line.into());
    }
}

pub struct Link {
    pub shared: Arc<Mutex<Shared>>,
}

impl Link {
    pub fn start(ctx: egui::Context) -> Self {
        let shared = Arc::new(Mutex::new(Shared {
            status: Status::Searching,
            log: VecDeque::new(),
            last_touch: [None; PADS as usize + 1],
            bindings: Bindings::load(),
        }));
        let s = shared.clone();
        std::thread::Builder::new()
            .name("deck-link".into())
            .spawn(move || run(ctx, s))
            .expect("spawn deck-link thread");
        Self { shared }
    }
}

fn lock(shared: &Mutex<Shared>) -> std::sync::MutexGuard<'_, Shared> {
    shared.lock().unwrap_or_else(|e| e.into_inner())
}

fn run(ctx: egui::Context, shared: Arc<Mutex<Shared>>) {
    // mDNS keeps the latest address; espdeck.local is the fallback (Windows resolves it too).
    let mdns = ServiceDaemon::new().ok();
    let events = mdns.as_ref().and_then(|d| d.browse(MDNS_SERVICE).ok());
    let mut found: Option<SocketAddr> = None;
    let mut enigo = Enigo::new(&Settings::default()).ok();

    loop {
        if let Some(rx) = &events {
            while let Ok(ev) = rx.try_recv() {
                if let ServiceEvent::ServiceResolved(svc) = ev {
                    if let Some(ip) = svc.addresses.iter().map(|a| a.to_ip_addr()).find(|ip| ip.is_ipv4()) {
                        found = Some(SocketAddr::new(ip, svc.port));
                    }
                }
            }
        }
        let addr = found.or_else(|| {
            (FALLBACK_HOST, PORT).to_socket_addrs().ok()?.find(|a| a.is_ipv4())
        });
        if let Some(addr) = addr {
            match TcpStream::connect_timeout(&addr, Duration::from_secs(2)) {
                Ok(stream) => {
                    session(&ctx, &shared, stream, addr, enigo.as_mut());
                    lock(&shared).status = Status::Searching;
                    ctx.request_repaint();
                }
                Err(_) => found = None, // stale mDNS answer – look again
            }
        }
        std::thread::sleep(Duration::from_secs(2));
    }
}

fn session(ctx: &egui::Context, shared: &Mutex<Shared>, mut stream: TcpStream, addr: SocketAddr, mut enigo: Option<&mut Enigo>) {
    let _ = stream.set_nodelay(true);
    let _ = stream.set_read_timeout(Some(Duration::from_millis(100)));
    let mut buf = Vec::<u8>::new();
    let mut chunk = [0u8; 512];
    let mut last_rx = Instant::now();
    let mut last_ping = Instant::now() - PING_EVERY;

    loop {
        if last_ping.elapsed() >= PING_EVERY {
            if send(&mut stream, &json!({ "t": "ping" })).is_err() {
                break;
            }
            last_ping = Instant::now();
        }
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => {
                last_rx = Instant::now();
                buf.extend_from_slice(&chunk[..n]);
                while let Some(nl) = buf.iter().position(|&b| b == b'\n') {
                    let line: Vec<u8> = buf.drain(..=nl).collect();
                    if let Ok(msg) = serde_json::from_slice::<Value>(&line) {
                        handle(ctx, shared, &mut stream, addr, &msg, enigo.as_deref_mut());
                    }
                }
                if buf.len() > 4096 {
                    buf.clear(); // garbage without newlines
                }
            }
            Err(e) if matches!(e.kind(), ErrorKind::WouldBlock | ErrorKind::TimedOut) => {}
            Err(_) => break,
        }
        if last_rx.elapsed() > DEAD_AFTER {
            break;
        }
    }
    let mut s = lock(shared);
    s.log("Deck disconnected");
}

fn send(stream: &mut TcpStream, msg: &Value) -> std::io::Result<()> {
    let mut line = msg.to_string();
    line.push('\n');
    stream.write_all(line.as_bytes())
}

fn handle(ctx: &egui::Context, shared: &Mutex<Shared>, stream: &mut TcpStream, addr: SocketAddr, msg: &Value, enigo: Option<&mut Enigo>) {
    let text = |k: &str| msg.get(k).and_then(Value::as_str).unwrap_or("").to_owned();
    match msg.get("t").and_then(Value::as_str).unwrap_or("") {
        "hello" => {
            let mut s = lock(shared);
            s.status = Status::Connected { addr, id: text("id"), fw: text("fw") };
            s.log(format!("Connected to {} ({addr})", text("name")));
        }
        "touch" => {
            let pad = msg.get("pad").and_then(Value::as_u64).unwrap_or(0) as u8;
            let binding = {
                let mut s = lock(shared);
                if let Some(t) = s.last_touch.get_mut(pad as usize) {
                    *t = Some(Instant::now());
                }
                s.bindings.pads.get(&pad).cloned().unwrap_or_default()
            };
            let outcome = if binding.shortcut.trim().is_empty() {
                "no PC action".to_owned()
            } else {
                match (actions::parse(&binding.shortcut), enigo) {
                    (Ok(keys), Some(enigo)) => match actions::press(enigo, &keys) {
                        Ok(()) => {
                            let label = if binding.label.trim().is_empty() { &binding.shortcut } else { &binding.label };
                            let _ = send(stream, &json!({ "t": "show", "text": label }));
                            format!("→ {}", binding.shortcut)
                        }
                        Err(e) => format!("→ {} failed: {e}", binding.shortcut),
                    },
                    (Err(e), _) => format!("bad shortcut: {e}"),
                    (_, None) => "keyboard input unavailable".to_owned(),
                }
            };
            lock(shared).log(format!("Pad {pad} tapped {outcome}"));
        }
        "enc" => {
            let d = msg.get("d").and_then(Value::as_i64).unwrap_or(0);
            lock(shared).log(format!("Encoder {d:+}"));
        }
        "btn" => {
            let what = if text("ev") == "long" { "long press" } else { "press" };
            lock(shared).log(format!("Encoder button {what}"));
        }
        _ => return,
    }
    ctx.request_repaint();
}
