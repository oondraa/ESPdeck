---
tags: [projekt, otázky]
aktualizováno: 2026-11-09
---
# Otevřené otázky a známá omezení

## Známá omezení současného stavu
| # | Omezení | Kde |
|---|---|---|
| L1 | **Spojení deck–PC není zabezpečené.** Kdokoli v síti se může připojit na port 4545, přebrat spojení a posílat `show` nebo číst dotyky. | [[Protokol deck–PC]] |
| L2 | Wi-Fi heslo a adresy jsou zakompilované (`secrets.h`), změna = nový build. | [[Síťové funkce]] |
| L3 | Bluetooth neexistuje, přepínač je jen grafika (deck i aplikace). | [[Obrazovky a ovládání]], [[Editor UI]] |
| L4 | Nastavení decku (jas) se neukládá. | [[Obrazovky a ovládání]] |
| L5 | Světla jsou napevno na ploškách 1 a 3. | [[Dotykové plošky]] |
| L6 | Enkodér a jeho tlačítko na PC nic nedělají (jen log). | [[Zkratky na ploškách]] |
| L7 | Editor Hardware/Functions je maketa s ukázkovými daty. | [[Editor UI]] |
| L8 | `upload_port = COM8` je napevno v `platformio.ini`. | [[Přehled firmwaru]] |
| L9 | Web popisuje jiný HW (klasický ESP32). | [[HW zapojení]] |
| L10 | Generátor `assets.h` z JSON není v repu. | [[Animace a Display Designer]] |
| L11 | Provedení dotykových plošek (materiál, průměr, kryt, sériový rezistor) a kód a cena desky S3 nejsou zdokumentované. | [[Moduly a BOM]] |

## Otázky k rozhodnutí
| # | Otázka |
|---|---|
| Q1 | Jaké minimální zabezpečení spojení s PC? (např. sdílený kód/párování) – souvisí s L1 |
| Q2 | Má deck jít nastavit z aplikace (Wi-Fi, Bluesound, světla, funkce plošek) místo `secrets.h`? |
| Q3 | Mají se části editoru Hardware/Functions napojit na skutečný deck, nebo zjednodušit? |
| Q4 | Co bude ve `v.0.0.1` – nová čistá verze firmwaru, nebo pokračovat v `test_obrazovky`? |
| Q5 | Aktualizovat web podle ESP32-S3? |
| Q6 | Je Bluetooth (BLE HID) vůbec potřeba? |

← [[Stav projektu]]
