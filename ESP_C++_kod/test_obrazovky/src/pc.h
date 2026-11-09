// Spojení s PC aplikací (espdeck-ui) přes Wi-Fi.
//
// Deck je TCP server na portu PC_PORT a ohlašuje se přes mDNS jako
// _espdeck._tcp (hostname espdeck.local). Aplikace se připojí sama.
// Protokol: jedna JSON zpráva na řádek (\n).
//   deck -> PC: {"t":"hello","name","id","fw","pads"}  {"t":"touch","pad":1,"ev":"tap"}
//               {"t":"enc","d":1}  {"t":"btn","ev":"press"|"long"}  {"t":"pong"}
//   PC -> deck: {"t":"ping"}  {"t":"show","text":"KOPIROVAT"}
// Deck posílá jen události – co se má na PC stát, ví jen aplikace.
#pragma once
#include <Arduino.h>

constexpr uint16_t PC_PORT = 4545;

void pcBegin();                       // spustí úlohu (server se rozběhne po připojení k Wi-Fi)
bool pcConnected();
void pcSendTouch(int pad);            // pad 1–6
void pcSendEncoder(int delta);
void pcSendButton(bool longPress);
// Text, který aplikace poslala k zobrazení (např. „KOPIROVAT“). true = nový.
bool pcTakeShow(char* out, size_t n);
