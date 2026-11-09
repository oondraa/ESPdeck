---
tags: [firmware, síť]
zdroj: ESP_C++_kod/test_obrazovky/src/net.cpp
---
# Síťové funkce

Vše v `net.cpp`, běží ve vlastní FreeRTOS úloze (jádro 0, smyčka po 20 ms). UI jen zapisuje požadavky do proměnných, úloha je odešle.

## Wi-Fi
- Režim STA, hostname `espdeck`, automatické znovupřipojení.
- SSID a heslo **napevno** z `secrets.h` při kompilaci.

## Čas
- `configTzTime("CET-1CEST,M3.5.0,M10.5.0/3", "pool.ntp.org", "time.google.com")` – střední Evropa vč. letního času.
- Před synchronizací se použije čas kompilace.

## Bluesound (BluOS HTTP API, port 11000)
| Akce | Požadavek | Poznámka |
|---|---|---|
| hlasitost | `GET /Volume?level=N` | nejvýš 1× za 150 ms, posílá se poslední hodnota |
| Play/Pauza | `GET /Pause?toggle=1` | dva rychlé stisky se navzájem zruší |
| stav | `GET /Status` | co 5 s a hned po připojení; z XML se bere `<volume>` a `<state>` (`play`/`stream` = hraje) |

IP repráku: `BLUOS_HOST` v `secrets.h`.

## Světla
`GET LIGHTS_ON_URL` / `LIGHTS_OFF_URL` (v `secrets.h`, lokální server na portu 8181, endpointy `/OndraRozsvit`, `/OndraZhasni` – stejné jako IR ovladač). Spouští ploška 1 a 3 – [[Dotykové plošky]].

## Časové limity
Připojení 1,5 s, odpověď 2,5 s. Chyby se jen vypíšou do sériové linky.

← [[Přehled firmwaru]]
