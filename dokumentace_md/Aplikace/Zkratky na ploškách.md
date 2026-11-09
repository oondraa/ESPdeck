---
tags: [aplikace]
zdroj: app/espdeck-ui/src/actions.rs, link.rs, app.rs (connections)
---
# Zkratky na ploškách

Obrazovka **Connections** v aplikaci. Každá ze 6 plošek má:
- **Shortcut** – zkratka, např. `Ctrl+C`, `Win+Shift+S`, `PlayPause`. Prázdné = nic.
- **Text on the deck** – co se po provedení ukáže na OLED (ASCII, nejlépe velkými písmeny). Prázdné = ukáže se zkratka.

Změny se ukládají hned do `%APPDATA%\ESPDeck\bindings.json`. Vedle řádku se ukazuje `OK` nebo chyba (neznámá klávesa). Dotknutá ploška se v tabulce na 700 ms zvýrazní; pod tabulkou je log posledních 14 událostí.

## Výchozí přiřazení
| Ploška | Zkratka | Text |
|---|---|---|
| 1 | – (světla na decku) | |
| 2 | `Ctrl+C` | KOPIROVAT |
| 3 | – (světla na decku) | |
| 4 | `Ctrl+V` | VLOZIT |
| 5 | `Win+Shift+S` | VYSTRIZEK |
| 6 | `Win+D` | PLOCHA |

## Názvy kláves
- Modifikátory: `Ctrl`, `Shift`, `Alt`, `Win` (`Meta`, `Super`, `Cmd`).
- Písmena a číslice: na Windows podle virtuálního kódu klávesy, takže fungují i na české klávesnici.
- `F1`–`F24`, `Enter`, `Esc`, `Tab`, `Space`, `Backspace`, `Del`, `Ins`, `Home`, `End`, `PgUp`, `PgDn`, `Up`, `Down`, `Left`, `Right`.
- Média: `PlayPause`, `Next`, `Prev`, `VolUp`, `VolDown`, `Mute`.

Stisk: modifikátory se podrží, poslední klávesa se zmáčkne, modifikátory se pustí v opačném pořadí.

## Omezení
- Jen plošky – enkodér a jeho tlačítko se v aplikaci jen zapíšou do logu.
- Jedna zkratka na plošku, žádná makra ani profily.

← [[Přehled aplikace]] · [[Protokol deck–PC]] · [[Dotykové plošky]]
