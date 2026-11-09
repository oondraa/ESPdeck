// Síť: Wi-Fi, NTP čas, Bluesound (BluOS HTTP API) a světla (HTTP GET).
// Všechny HTTP požadavky běží ve vlastní úloze na jádře 0 – UI na nich nikdy nečeká.
#pragma once
#include <Arduino.h>

void netBegin();                 // Wi-Fi + časová zóna/NTP + síťová úloha
bool netConnected();
int netRssi();                   // dBm, platí jen při připojení
const char* netSsid();           // název připojené sítě

void netSetVolume(int level);    // 0–100, posílá se nejvýš 1x za 150 ms (poslední hodnota vyhrává)
void netTogglePause();           // Play/Pauza
void netLights(bool on);         // OndraRozsvit / OndraZhasni

// Nový stav z BluOS /Status (volá se pravidelně co 5 s). true = jsou nová data.
bool netTakeStatus(int& volume, bool& playing);
