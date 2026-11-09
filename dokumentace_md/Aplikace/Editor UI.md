---
tags: [aplikace, ui]
zdroj: app/espdeck-ui/src/app.rs, model.rs, deck.rs
návrh: ESPDeck UI UX navrh.html
---
# Editor UI

Vzhled podle `ESPDeck UI UX navrh.html` (světlé téma). macOS „semafor“ z návrhu je nahrazen lištou z OZBEAT.

## Postranní panel
`Deck` · `Actions` · `Profiles` · `OLED Screens` · `Connections` · `Device` · `Settings`

| Položka | Stav |
|---|---|
| **Deck → Hardware** | vykreslený deck na mřížce 6×3, výběr a přesun dílů, přidání/odebrání (max 8 plošek, 3 enkodéry), inspektor s piny a citlivostí |
| **Deck → Functions** | gesta a OLED odezva vybraného dílu, stránky Home/Media/Office, šablony obrazovek |
| **Connections** | ✅ **skutečně funkční** – stav spojení, zkratky, log – [[Zkratky na ploškách]] |
| Actions, Profiles, OLED Screens, Device, Settings | jen text „isn't in the UI design yet“ |

> [!warning] Deck → Hardware/Functions jsou jen maketa
> Data jsou **ukázková z návrhu** (`model.rs`: OLED, T1–T6, E1–E2; funkce, piny, „BLE“, „Wi-Fi“). Nic z toho se neposílá do decku ani neukládá. Přepínače Wi-Fi, BLE HID, otočení OLED, obrácení enkodéru a citlivost jsou jen v paměti okna. Piny v inspektoru odpovídají návrhu, ne [[HW zapojení]].

← [[Přehled aplikace]]
