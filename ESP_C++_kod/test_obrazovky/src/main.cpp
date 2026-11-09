// ESPDeck – test obrazovek navržených v Display Designeru.
//
// HW: LaskaKit ESP32-S3-DevKit
//   OLED SH1106 128x64 v konektoru μŠup: I2C 0x3C, SDA=42, SCL=2 (zjištěno skenem, env i2cscan)
//   Napájení μŠup se zapíná GPIO47 = HIGH
//   Enkodér LaskaKit/Keyes (S1, S2, Key, 5V, GND): S1=GPIO15, S2=GPIO16, Key=GPIO17,
//   pin „5V“ modulu napájet z 3V3 (ESP32-S3 nesnese 5 V na vstupech).
//   Dotykové plošky 1–6: GPIO 4, 5, 6, 7, 8, 1.
//
// Síť (net.cpp, konfigurace v src/secrets.h – není v gitu):
//   Hodiny: otáčení = hlasitost Bluesound, stisk = Play/Pauza (BluOS HTTP API)
//   Dotyk 1 = rozsvítit světla, dotyk 3 = zhasnout (stejné URL jako IR ovladač z bastleni)
//   Čas z NTP (CET/CEST), do synchronizace z času kompilace.
//   PC aplikace (espdeck-ui) se připojí přes Wi-Fi (pc.cpp): deck posílá dotyky/enkodér,
//   aplikace podle nich mačká zkratky a pošle zpět text, který se ukáže na displeji.
//   Pozn.: dokumentace_md/HW počítá s klasickým ESP32 (piny 22/25 na S3 neexistují).
//
// Ovládání:
//   otočení enkodéru  – pohyb kurzoru / změna jasu
//   krátký stisk      – akce (přepnout BT, upravit jas)
//   dlouhý stisk      – přepnout Hodiny <-> Nastavení
//   sériová linka 115200: n = dolů, p = nahoru, o = stisk, l = dlouhý stisk,
//                         t = hodnoty plošek, c = znovu kalibrovat plošky, w = stav Wi-Fi

#ifndef I2C_PIN_SCAN
#include <Arduino.h>
#include <U8g2lib.h>
#include <Wire.h>
#include <sys/time.h>
#include <time.h>

#include "assets.h"
#include "net.h"
#include "pc.h"

// ------------------------------------------------------------ piny
constexpr int PIN_SDA = 42, PIN_SCL = 2;
constexpr int PIN_USUP_POWER = 47;
// Enkodér: S1 = A, S2 = B, Key = tlačítko. Opačný směr -> ENC_REVERSE = true.
constexpr bool HAS_ENCODER = true;
constexpr bool ENC_REVERSE = true;  // ověřeno na HW: modul má S1/S2 prohozené vůči A/B
constexpr int PIN_ENC_A = 15, PIN_ENC_B = 16, PIN_ENC_BTN = 17;

// Dotykové plošky (ESP32-S3: dotyk jen na GPIO 1–14).
constexpr int TOUCH_PINS[] = {4, 5, 6, 7, 8, 1};  // GPIO 10 není na DevKitu vyvedený -> ploška 6 na GPIO 1
constexpr int TOUCH_N = sizeof(TOUCH_PINS) / sizeof(TOUCH_PINS[0]);

U8G2_SH1106_128X64_NONAME_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE, PIN_SCL, PIN_SDA);

// ------------------------------------------------------------ stav UI
enum class Screen { Clock, Settings };
Screen screen = Screen::Clock;
int cursor = 0;            // 0 WIFI, 1 BLUETOOTH, 2 PC, 3 JAS
bool btOn = false;
int brightness = 70;       // %
bool editBrightness = false;
bool dirty = true;

// Hlasitost Bluesound repráku (načte se z BluOS /Status, enkodér ji posílá zpět).
int volume = 50;           // 0–100
uint32_t volumeShownMs = 0;
bool volumeVisible = false;
constexpr int VOLUME_STEP = 1;
constexpr uint32_t VOLUME_SHOW_MS = 1200;

// Přehrávání (Play/Pauza) – stisk enkodéru na hodinách.
bool musicPlaying = true;
bool playAnimActive = false;
uint32_t playAnimStart = 0;

// Plošky s funkcí světel (index od 0): ploška 1 = rozsvítit, ploška 3 = zhasnout.
constexpr int PAD_LIGHTS_ON = 0, PAD_LIGHTS_OFF = 2;

// Okénko po dotyku: buď „DOTYK n“, nebo světla.
enum class TouchMsg { Pad, LightsOn, LightsOff, NoWifi, Pc };
TouchMsg touchMsg = TouchMsg::Pad;
char pcText[24] = "";  // popisek akce z PC aplikace

// Žárovka 5x7 (zhasnutá = obrys, rozsvícená = plná).
const uint8_t ICON_BULB_OFF[7] PROGMEM = {112, 136, 136, 80, 112, 112, 32};
const uint8_t ICON_BULB_ON[7] PROGMEM = {112, 248, 248, 112, 112, 112, 32};

// Reproduktor 8x7 (s vlnami / přeškrtnutý), 1 bajt na řádek, MSB vlevo.
const uint8_t ICON_SPEAKER[7] PROGMEM = {16, 52, 242, 242, 242, 52, 16};
const uint8_t ICON_MUTE[7] PROGMEM = {16, 48, 245, 242, 245, 48, 16};

// ------------------------------------------------------------ enkodér
volatile int16_t encSteps = 0;
volatile uint8_t encState = 0;

void IRAM_ATTR encIsr() {
  static const int8_t tbl[16] = {0, -1, 1, 0, 1, 0, 0, -1, -1, 0, 0, 1, 0, 1, -1, 0};
  uint8_t ab = (digitalRead(PIN_ENC_A) << 1) | digitalRead(PIN_ENC_B);
  encState = ((encState << 2) | ab) & 0x0F;
  encSteps += tbl[encState];
}

int takeDetents() {
  noInterrupts();
  int d = encSteps / 4;  // 4 hrany = 1 cvak (podle HW přehledu)
  encSteps -= d * 4;
  interrupts();
  return ENC_REVERSE ? -d : d;
}

// ------------------------------------------------------------ malé písmo
const SmallGlyph* glyph(char c) {
  for (uint8_t i = 0; i < SMALL_FONT_N; i++)
    if (SMALL_FONT[i].c == c) return &SMALL_FONT[i];
  return nullptr;
}

constexpr int SPACE_W = 3;

int smallWidth(const char* s, int track) {
  int w = 0;
  for (const char* p = s; *p; p++) {
    if (*p == ' ') { w += SPACE_W; continue; }
    const SmallGlyph* g = glyph(*p);
    if (!g) continue;
    w += g->w;
    if (p[1]) w += track;
  }
  return w;
}

// Kreslí aktuální barvou (setDrawColor), pozadí nechává být.
int drawSmall(int x, int y, const char* s, int track) {
  for (const char* p = s; *p; p++) {
    if (*p == ' ') { x += SPACE_W; continue; }
    const SmallGlyph* g = glyph(*p);
    if (!g) continue;
    int n = g->w * 5;
    for (int i = 0; i < n; i++)
      if (g->bits & (1UL << (n - 1 - i))) oled.drawPixel(x + i % g->w, y + i / g->w);
    x += g->w;
    if (p[1]) x += track;
  }
  return x;
}

// ------------------------------------------------------------ čas
// Bez Wi-Fi: start z času kompilace. Později nahradit NTP (configTzTime).
void setTimeFromBuild() {
  static const char* mons = "JanFebMarAprMayJunJulAugSepOctNovDec";
  char m[4] = {0};
  struct tm t = {};
  sscanf(__DATE__, "%3s %d %d", m, &t.tm_mday, &t.tm_year);
  sscanf(__TIME__, "%d:%d:%d", &t.tm_hour, &t.tm_min, &t.tm_sec);
  t.tm_mon = (strstr(mons, m) - mons) / 3;
  t.tm_year -= 1900;
  time_t now = mktime(&t);
  timeval tv = {now, 0};
  settimeofday(&tv, nullptr);
}

const char* DAYS[] = {"NEDELE", "PONDELI", "UTERY", "STREDA", "CTVRTEK", "PATEK", "SOBOTA"};

// ------------------------------------------------------------ obrazovka: hodiny
void drawBig(int x, int y, int d) {
  oled.drawBitmap(x, y, 3, BIG_H, BIG_DIGITS[d]);
}

void drawClock() {
  time_t now = time(nullptr);
  struct tm t;
  localtime_r(&now, &t);

  oled.setDrawColor(1);
  drawBig(6, 5, t.tm_hour / 10);
  drawBig(33, 5, t.tm_hour % 10);
  drawBig(73, 5, t.tm_min / 10);
  drawBig(100, 5, t.tm_min % 10);

  // Dvojtečka bliká po půl sekundě (jako 2 snímky po 500 ms v návrhu).
  if ((millis() / 500) % 2 == 0) {
    oled.drawBitmap(62, 16, 1, 4, COLON_DOT);
    oled.drawBitmap(62, 30, 1, 4, COLON_DOT);
  }

  char line[24];
  snprintf(line, sizeof line, "%s | %02d.%02d", DAYS[t.tm_wday], t.tm_mday, t.tm_mon + 1);
  int w = smallWidth(line, 2);
  drawSmall((128 - w) / 2, 53, line, 2);
}

// ------------------------------------------------------------ obrazovka: nastavení
void drawIcon(int x, int y, const uint8_t* icon, int w) {
  oled.drawBitmap(x + (7 - w) / 2, y, 1, 7, icon);
}

void drawSettings() {
  oled.setDrawColor(1);
  const char* title = "NASTAVENI";
  drawSmall(5, 3, title, 2);
  int ix = 5 + smallWidth(title, 2) - 3;  // čárka nad posledním I -> Í
  oled.drawPixel(ix + 2, 0);
  oled.drawPixel(ix + 1, 1);

  const int R = 122;
  for (int i = 0; i < 4; i++) {
    int y = 13 + i * 12;
    bool sel = i == cursor;
    int fg = sel ? 0 : 1;
    if (sel) {
      oled.setDrawColor(1);
      oled.drawRBox(1, y, 126, 11, 3);
    }
    oled.setDrawColor(fg);
    switch (i) {
      case 0: {
        drawIcon(5, y + 2, ICON_WIFI, ICON_WIFI_W);
        drawSmall(17, y + 3, "WIFI", 1);
        if (netConnected()) {
          int rssi = netRssi();
          int bars = rssi > -55 ? 4 : rssi > -65 ? 3 : rssi > -75 ? 2 : 1;
          for (int k = 0; k < 4; k++) {
            if (k < bars) oled.drawVLine(R - 6 + k * 2, y + 3 + (3 - k), 2 + k);
            else oled.drawPixel(R - 6 + k * 2, y + 7);  // slabší čárky jen jako tečka
          }
          char name[10];
          int n = 0;
          for (const char* c = netSsid(); *c && n < 9; c++) name[n++] = toupper(*c);
          name[n] = 0;
          drawSmall(R - 10 - smallWidth(name, 1), y + 3, name, 1);
        } else {
          drawSmall(R - smallWidth("ODPOJENO", 1) + 1, y + 3, "ODPOJENO", 1);
        }
        break;
      }
      case 1:
        drawIcon(5, y + 2, ICON_BT, ICON_BT_W);
        drawSmall(17, y + 3, "BLUETOOTH", 1);
        if (btOn) {
          oled.drawRBox(R - 12, y + 2, 13, 7, 3);
          oled.setDrawColor(!fg);
          oled.drawDisc(R - 3, y + 5, 2);
        } else {
          oled.drawRFrame(R - 12, y + 2, 13, 7, 3);
          oled.drawDisc(R - 8, y + 5, 2);
        }
        break;
      case 2: {
        drawIcon(5, y + 2, ICON_PC, ICON_PC_W);
        drawSmall(17, y + 3, "PC", 1);
        const char* st = pcConnected() ? "PRIPOJENO" : "ODPOJENO";
        drawSmall(R - smallWidth(st, 1) + 1, y + 3, st, 1);
        break;
      }
      case 3: {
        drawIcon(5, y + 2, ICON_SUN, ICON_SUN_W);
        drawSmall(17, y + 3, "JAS", 1);
        int x0 = R - 35;
        int fill = brightness * 35 / 100;
        oled.drawHLine(x0, y + 5, 36);
        oled.drawBox(x0, y + 4, fill, 3);
        // Při úpravě jasu knoflík bliká.
        if (!editBrightness || (millis() / 250) % 2 == 0)
          oled.drawBox(x0 + max(fill - 1, 0), y + 2, 3, 7);
        break;
      }
    }
  }
  oled.setDrawColor(1);
}

// ------------------------------------------------------------ dotykové plošky
// Na ESP32-S3 hodnota touchRead() při doteku ROSTE (na klasickém ESP32 klesá).
float touchFilt[TOUCH_N];
float touchBase[TOUCH_N];
bool touchDown[TOUCH_N];
int lastTouched = -1;          // index plošky pro okénko na displeji
uint32_t lastTouchMs = 0;

void touchCalibrate() {
  // První měření po startu jsou nesmyslně vysoká (ověřeno: ~156k místo ~26k) – zahodit.
  for (int s = 0; s < 30; s++) {
    for (int i = 0; i < TOUCH_N; i++) touchRead(TOUCH_PINS[i]);
    delay(10);
  }
  for (int i = 0; i < TOUCH_N; i++) touchBase[i] = 0;
  const int samples = 32;
  for (int s = 0; s < samples; s++) {
    for (int i = 0; i < TOUCH_N; i++) touchBase[i] += touchRead(TOUCH_PINS[i]);
    delay(5);
  }
  Serial.print("Dotyk kalibrace:");
  for (int i = 0; i < TOUCH_N; i++) {
    touchBase[i] /= samples;
    touchFilt[i] = touchBase[i];
    touchDown[i] = false;
    Serial.printf(" G%d=%.0f", TOUCH_PINS[i], touchBase[i]);
  }
  Serial.println();
}

void onTouch(int i) {
  touchMsg = TouchMsg::Pad;
  if (i == PAD_LIGHTS_ON || i == PAD_LIGHTS_OFF) {
    bool on = i == PAD_LIGHTS_ON;
    if (netConnected()) {
      netLights(on);
      touchMsg = on ? TouchMsg::LightsOn : TouchMsg::LightsOff;
    } else {
      touchMsg = TouchMsg::NoWifi;
    }
  }
  pcSendTouch(i + 1);
  lastTouched = i;
  lastTouchMs = millis();
  dirty = true;
  Serial.printf("Dotyk: ploska %d (GPIO %d) hodnota %.0f / zaklad %.0f\n", i + 1, TOUCH_PINS[i],
                touchFilt[i], touchBase[i]);
}

void pollTouch() {
  static uint32_t last = 0;
  if (millis() - last < 10) return;
  last = millis();
  for (int i = 0; i < TOUCH_N; i++) {
    float v = touchRead(TOUCH_PINS[i]);
    touchFilt[i] += (v - touchFilt[i]) * 0.3f;  // IIR filtr proti šumu (Wi-Fi apod.)
    float on = touchBase[i] * 1.20f, off = touchBase[i] * 1.10f;  // hystereze
    if (!touchDown[i] && touchFilt[i] > on) {
      touchDown[i] = true;
      onTouch(i);
    } else if (touchDown[i] && touchFilt[i] < off) {
      touchDown[i] = false;
    } else if (!touchDown[i]) {
      touchBase[i] += (touchFilt[i] - touchBase[i]) * 0.001f;  // pomalý drift základu
    }
  }
}

void drawTouchOverlay() {
  if (lastTouched < 0) return;
  bool held = touchDown[lastTouched];
  if (!held && millis() - lastTouchMs > 700) {
    lastTouched = -1;
    dirty = true;
    return;
  }
  char txt[16];
  const uint8_t* icon = nullptr;
  switch (touchMsg) {
    case TouchMsg::LightsOn: strcpy(txt, "SVETLA ZAP"); icon = ICON_BULB_ON; break;
    case TouchMsg::LightsOff: strcpy(txt, "SVETLA VYP"); icon = ICON_BULB_OFF; break;
    case TouchMsg::NoWifi: strcpy(txt, "BEZ WIFI"); break;
    case TouchMsg::Pc: strlcpy(txt, pcText, sizeof txt); break;
    default: snprintf(txt, sizeof txt, "DOTYK %d", lastTouched + 1);
  }
  int w = smallWidth(txt, 2) + (icon ? 10 : 0);
  int bw = w + 16, bh = 15, bx = (128 - bw) / 2, by = (64 - bh) / 2;
  oled.setDrawColor(0);
  oled.drawRBox(bx - 2, by - 2, bw + 4, bh + 4, 5);  // černý okraj kolem okénka
  oled.setDrawColor(1);
  oled.drawRBox(bx, by, bw, bh, 4);
  oled.setDrawColor(0);
  int tx = bx + 8;
  if (icon) {
    oled.drawBitmap(tx, by + 4, 1, 7, icon);
    tx += 10;
  }
  drawSmall(tx, by + 5, txt, 2);
  oled.setDrawColor(1);
}

// Okénko hlasitosti: [reproduktor] [====pruh====] 70
void drawVolumeOverlay() {
  if (!volumeVisible) return;
  if (millis() - volumeShownMs > VOLUME_SHOW_MS) {
    volumeVisible = false;
    dirty = true;
    return;
  }
  const int bw = 100, bh = 17, bx = (128 - bw) / 2, by = (64 - bh) / 2;
  oled.setDrawColor(0);
  oled.drawRBox(bx - 2, by - 2, bw + 4, bh + 4, 5);  // černý okraj, ať okénko odděluje od pozadí
  oled.setDrawColor(1);
  oled.drawRBox(bx, by, bw, bh, 4);

  oled.setDrawColor(0);
  oled.drawBitmap(bx + 6, by + 5, 1, 7, volume == 0 ? ICON_MUTE : ICON_SPEAKER);

  // Pruh: obrys + výplň podle hlasitosti.
  const int tx = bx + 19, ty = by + 5, tw = 56, th = 7;
  oled.drawRFrame(tx, ty, tw, th, 2);
  int fill = (tw - 4) * volume / 100;
  if (fill > 0) oled.drawBox(tx + 2, ty + 2, fill, th - 4);

  char num[5];
  snprintf(num, sizeof num, "%d", volume);
  drawSmall(bx + bw - 6 - smallWidth(num, 1), by + 6, num, 1);
  oled.setDrawColor(1);
}

// Animace Play/Pauza: čtverec vyskočí, ikona se přetvaruje ▶ <-> ❚❚, čtverec zmizí.
// Obě ikony jsou popsané dvěma čtyřúhelníky se stejným počtem vrcholů, takže jde
// vrcholy prostě interpolovat (trojúhelník se „rozdělí“ na dva sloupky).
struct Pt { float x, y; };
// Ikona 14x16, souřadnice relativně k levému hornímu rohu.
const Pt ICON_PLAY[2][4] = {
    {{1, 0}, {7.5f, 4}, {7.5f, 12}, {1, 16}},     // levá polovina trojúhelníku
    {{7.5f, 4}, {14, 8}, {14, 8}, {7.5f, 12}},    // pravá polovina (špička)
};
const Pt ICON_PAUSE[2][4] = {
    {{1, 0}, {5.5f, 0}, {5.5f, 16}, {1, 16}},     // levý sloupek
    {{9.5f, 0}, {14, 0}, {14, 16}, {9.5f, 16}},   // pravý sloupek
};

float easeOut(float t) { t = constrain(t, 0.0f, 1.0f); return 1 - (1 - t) * (1 - t) * (1 - t); }
float easeInOut(float t) { t = constrain(t, 0.0f, 1.0f); return t < 0.5f ? 4 * t * t * t : 1 - powf(-2 * t + 2, 3) / 2; }

void drawPlayOverlay() {
  if (!playAnimActive) return;
  const uint32_t IN = 140, MORPH_FROM = 80, MORPH = 280, HOLD = 950, OUT = 160;
  uint32_t t = millis() - playAnimStart;
  if (t > HOLD + OUT) {
    playAnimActive = false;
    dirty = true;
    return;
  }
  // Měřítko čtverce: naskočí s lehkým přestřelem, na konci se zmenší.
  float s;
  if (t < IN) {
    float k = easeOut(t / (float)IN);
    s = 0.5f + 0.6f * k;                       // 0.5 -> 1.1
  } else if (t < IN + 80) {
    s = 1.1f - 0.1f * ((t - IN) / 80.0f);      // 1.1 -> 1.0
  } else if (t > HOLD) {
    s = 1.0f - 0.6f * easeInOut((t - HOLD) / (float)OUT);
  } else {
    s = 1.0f;
  }

  const int cx = 64, cy = 32;
  int half = (int)(16 * s + 0.5f);
  int r = max(2, (int)(6 * s));
  oled.setDrawColor(0);
  oled.drawRBox(cx - half - 2, cy - half - 2, 2 * half + 4, 2 * half + 4, r + 1);
  oled.setDrawColor(1);
  oled.drawRBox(cx - half, cy - half, 2 * half, 2 * half, r);

  // Morph ikony ze starého stavu do nového (nový stav ukazujeme: pauza = ❚❚, hraje = ▶).
  float m = easeInOut((t > MORPH_FROM ? t - MORPH_FROM : 0) / (float)MORPH);
  const Pt(*from)[4] = musicPlaying ? ICON_PAUSE : ICON_PLAY;
  const Pt(*to)[4] = musicPlaying ? ICON_PLAY : ICON_PAUSE;
  float is = s * 0.95f;
  float ox = cx - 7.5f * is, oy = cy - 8 * is;
  oled.setDrawColor(0);
  for (int q = 0; q < 2; q++) {
    int px[4], py[4];
    for (int v = 0; v < 4; v++) {
      float x = from[q][v].x + (to[q][v].x - from[q][v].x) * m;
      float y = from[q][v].y + (to[q][v].y - from[q][v].y) * m;
      px[v] = (int)lroundf(ox + x * is);
      py[v] = (int)lroundf(oy + y * is);
    }
    oled.drawTriangle(px[0], py[0], px[1], py[1], px[2], py[2]);
    oled.drawTriangle(px[0], py[0], px[2], py[2], px[3], py[3]);
  }
  oled.setDrawColor(1);
}

// ------------------------------------------------------------ vstupy → akce
void applyBrightness() {
  oled.setContrast(map(brightness, 0, 100, 1, 255));
}

void onTurn(int d) {
  if (d != 0) Serial.printf("Enkoder: %+d\n", d);
  if (d == 0) return;
  pcSendEncoder(d);
  if (screen == Screen::Clock) {
    // Na hodinách enkodér ovládá hlasitost hudby.
    playAnimActive = false;  // okénko hlasitosti přebije animaci Play/Pauza
    volume = constrain(volume + d * VOLUME_STEP, 0, 100);
    netSetVolume(volume);
    volumeShownMs = millis();
    volumeVisible = true;
    dirty = true;
    Serial.printf("Hlasitost: %d\n", volume);
    return;
  }
  if (editBrightness) {
    brightness = constrain(brightness + d * 5, 5, 100);
    applyBrightness();
  } else {
    cursor = constrain(cursor + d, 0, 3);
  }
  dirty = true;
}

void onPress() {
  Serial.println("Enkoder: stisk");
  pcSendButton(false);
  if (screen == Screen::Clock) {
    musicPlaying = !musicPlaying;
    netTogglePause();
    playAnimActive = true;
    playAnimStart = millis();
    volumeVisible = false;
    dirty = true;
    Serial.printf("Hudba: %s\n", musicPlaying ? "prehravani" : "pauza");
    return;
  }
  if (screen != Screen::Settings) return;
  if (cursor == 1) btOn = !btOn;
  if (cursor == 3) editBrightness = !editBrightness;
  dirty = true;
}

void onLongPress() {
  pcSendButton(true);
  screen = screen == Screen::Clock ? Screen::Settings : Screen::Clock;
  editBrightness = false;
  dirty = true;
  Serial.printf("Obrazovka: %s\n", screen == Screen::Clock ? "hodiny" : "nastaveni");
}

void pollButton() {
  static bool down = false, longFired = false;
  static uint32_t since = 0;
  bool pressed = digitalRead(PIN_ENC_BTN) == LOW;
  uint32_t now = millis();
  if (pressed && !down && now - since > 30) {
    down = true;
    longFired = false;
    since = now;
  } else if (pressed && down && !longFired && now - since > 600) {
    longFired = true;
    onLongPress();
  } else if (!pressed && down && now - since > 30) {
    down = false;
    if (!longFired) onPress();
    since = now;
  }
}

void pollSerial() {
  while (Serial.available()) {
    switch (Serial.read()) {
      case 'n': onTurn(1); break;
      case 'p': onTurn(-1); break;
      case 'o': onPress(); break;
      case 'l': onLongPress(); break;
      case 't':
        for (int i = 0; i < TOUCH_N; i++)
          Serial.printf("G%d: %.0f (zaklad %.0f)%s\n", TOUCH_PINS[i], touchFilt[i], touchBase[i],
                        touchDown[i] ? " DOTYK" : "");
        break;
      case 'c': touchCalibrate(); break;
      case 'w':
        if (netConnected()) Serial.printf("WiFi: %s RSSI %d\n", netSsid(), netRssi());
        else Serial.println("WiFi: nepripojeno");
        break;
    }
  }
}

// ------------------------------------------------------------ setup / loop
void i2cScan() {
  Wire.begin(PIN_SDA, PIN_SCL);
  Wire.setClock(100000);
  Serial.print("I2C zarizeni:");
  int n = 0;
  for (uint8_t a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) {
      Serial.printf(" 0x%02X", a);
      n++;
    }
  }
  Serial.println(n ? "" : " zadne (zkontroluj zapojeni displeje)");
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\nESPDeck test obrazovek");
  Serial.println("Ovladani: n=dolu p=nahoru o=stisk l=dlouhy stisk (prepne obrazovku)");
  pinMode(PIN_USUP_POWER, OUTPUT);
  digitalWrite(PIN_USUP_POWER, HIGH);  // napájení konektoru μŠup (displej)
  delay(100);
  i2cScan();

  if (HAS_ENCODER) {
    pinMode(PIN_ENC_A, INPUT_PULLUP);  // interní pull-up – neškodí, i když je má modul
    pinMode(PIN_ENC_B, INPUT_PULLUP);
    pinMode(PIN_ENC_BTN, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(PIN_ENC_A), encIsr, CHANGE);
    attachInterrupt(digitalPinToInterrupt(PIN_ENC_B), encIsr, CHANGE);
  }

  netBegin();          // nastaví i časovou zónu, proto před setTimeFromBuild()
  pcBegin();
  setTimeFromBuild();  // než doběhne NTP
  delay(300);          // Wi-Fi zvyšuje šum dotyku – kalibrovat až po jejím startu
  touchCalibrate();    // při startu se plošek nedotýkat

  oled.setBusClock(400000);  // 400 kHz kvůli plynulé animaci (při 100 kHz trvá snímek ~95 ms)
  oled.begin();
  oled.setBitmapMode(1);     // průhledné bitmapy -> jdou kreslit i černě na bílém
  applyBrightness();
}

void loop() {
  pollSerial();
  pollTouch();
  if (HAS_ENCODER) {
    pollButton();
    onTurn(takeDetents());
  }

  // Stav z repráku (změny z mobilu apod.) – ale ne hned po vlastní akci, ať neskáče zpět.
  int sv;
  bool sp;
  if (netTakeStatus(sv, sp)) {
    if (sv >= 0 && millis() - volumeShownMs > 3000 && sv != volume) {
      volume = sv;
      dirty = true;
    }
    if (millis() - playAnimStart > 3000 && sp != musicPlaying) {
      musicPlaying = sp;
      dirty = true;
    }
  }

  // Popisek akce z PC aplikace -> ukázat v okénku místo „DOTYK n“.
  char shown[24];
  if (pcTakeShow(shown, sizeof shown)) {
    int n = 0;
    for (const char* c = shown; *c && n < (int)sizeof pcText - 1; c++) pcText[n++] = toupper(*c);
    pcText[n] = 0;
    touchMsg = TouchMsg::Pc;
    if (lastTouched < 0) lastTouched = 0;
    lastTouchMs = millis();
    dirty = true;
  }

  // Překreslit při změně a pravidelně kvůli blikání / času.
  static uint32_t last = 0;
  // Během animace co nejčastěji, jinak stačí 10x za sekundu.
  uint32_t period = playAnimActive ? 15 : 100;
  if (dirty || millis() - last > period) {
    last = millis();
    dirty = false;
    oled.clearBuffer();
    if (screen == Screen::Clock) drawClock();
    else drawSettings();
    drawVolumeOverlay();
    drawPlayOverlay();
    drawTouchOverlay();
    oled.sendBuffer();
  }
}
#endif  // I2C_PIN_SCAN
