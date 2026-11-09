---
tags: [hw, oživení]
zdroj: ESP_C++_kod/test_obrazovky (main.cpp, i2c_scan.cpp)
---
# Oživení a diagnostika

Jak se HW na stole oživoval a jaké nástroje na to má firmware. Zapojení: [[HW zapojení]].

## Nástroje
| Nástroj | Jak spustit | Co dělá |
|---|---|---|
| sken pinů I²C | `pio run -e i2cscan -t upload` + `pio device monitor` | zapne μŠup, zkusí všechny dvojice bezpečných GPIO jako SDA/SCL a vypíše, kde odpoví `0x3C`/`0x3D` |
| I²C sken při startu | běžný firmware | do sériové linky vypíše nalezené adresy, nebo „zadne (zkontroluj zapojeni displeje)“ |
| hodnoty plošek | sériově `t` | aktuální filtrovaná hodnota a základ každé plošky, `DOTYK` u stisknuté |
| kalibrace plošek | sériově `c` | nová kalibrace (plošek se nedotýkat) |
| Wi-Fi | sériově `w` | SSID a RSSI, nebo „nepripojeno“ |
| simulace enkodéru | sériově `n` / `p` / `o` / `l` | otočení dolů/nahoru, stisk, dlouhý stisk – bez HW |

Sériová linka: 115200 Bd, port `COM8` (napevno v `platformio.ini`).

## Co se při oživení zjistilo (zapsané v kódu)
- **Piny displeje** se našly skenem: SDA = GPIO42, SCL = GPIO2, adresa `0x3C`. Bez `GPIO47 = HIGH` displej neodpovídá.
- **I²C na 400 kHz** funguje s pull-upy jen na modulu (krátký kabel μŠup). Na 100 kHz trval jeden snímek ~95 ms – na plynulou animaci málo.
- **Enkodér** má S1/S2 vůči A/B prohozené → `ENC_REVERSE = true`. Interní pull-upy ESP32 jsou zapnuté a nevadí.
- **Dotyk na S3:** hodnota při dotyku roste. První měření po startu jsou nesmyslně vysoká (~156 000 místo ~26 000), proto se 30 měření zahodí.
- **Wi-Fi zvyšuje šum dotyku** → kalibrace až 300 ms po startu Wi-Fi, IIR filtr a hystereze – [[Dotykové plošky]].
- **GPIO10** na DevKitu není vyvedený → ploška 6 je na GPIO1.

## Kontrolní seznam (doporučení)
1. Bez napájení: mezi 3V3 a GND není zkrat; pin „5V“ enkodéru vede na 3V3, ne na 5 V.
2. Po připojení USB: v logu `I2C zarizeni: 0x3C`.
3. Displej ukazuje hodiny, dvojtečka bliká.
4. Enkodér: na obrazovce Nastavení posouvá kurzor po jednom řádku na cvak, správným směrem.
5. Tlačítko: krátký stisk = jedna akce, dlouhý (> 600 ms) přepne obrazovku.
6. Plošky: `t` v klidu bez `DOTYK`, při doteku každé plošky `DOTYK` jen u ní.
7. S Wi-Fi: žádné falešné dotyky v klidu.

← [[HW zapojení]] · [[Přehled firmwaru]]
