---
tags: [firmware, dotyk]
zdroj: ESP_C++_kod/test_obrazovky/src/main.cpp
---
# Dotykové plošky

6 plošek na GPIO 4, 5, 6, 7, 8, 1 ([[HW zapojení]]). Čte se `touchRead()` každých 10 ms.

## Algoritmus
1. **Kalibrace** při startu (plošek se nedotýkat): 30 měření se zahodí (první hodnoty jsou nesmyslně vysoké, ~156k místo ~26k – ověřeno), pak průměr z 32 vzorků = základ.
2. **IIR filtr** `filt += (v - filt) * 0.3` – tlumí šum, hlavně od Wi-Fi.
3. **Hystereze:** dotyk při `filt > základ × 1,20`, uvolnění při `< základ × 1,10`.
4. **Drift:** bez dotyku se základ pomalu posouvá (`× 0.001`) za aktuální hodnotou.

Kalibrace jde zopakovat sériovým příkazem `c`, hodnoty vypsat `t`.

## Co dotyk udělá
| Ploška | Na decku | Do PC |
|---|---|---|
| 1 | rozsvítí světla (bez Wi-Fi ukáže `BEZ WIFI`) | `touch` pad 1 |
| 3 | zhasne světla | `touch` pad 3 |
| 2, 4, 5, 6 | okénko `DOTYK n` | `touch` pad n |

Funkce světel je napevno v kódu (`PAD_LIGHTS_ON = 0`, `PAD_LIGHTS_OFF = 2`). Co ploška udělá na PC, rozhoduje jen aplikace – [[Zkratky na ploškách]].

← [[Přehled firmwaru]]
