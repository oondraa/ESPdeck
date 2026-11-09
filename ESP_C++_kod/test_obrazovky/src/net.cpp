#ifndef I2C_PIN_SCAN
#include "net.h"

#include <HTTPClient.h>
#include <WiFi.h>
#include <time.h>

#include "secrets.h"

// Střední Evropa (CET/CEST) – stejná pravidla jako Windows „Praha“.
static const char* TZ_PRAHA = "CET-1CEST,M3.5.0,M10.5.0/3";
static const String BLUOS = String("http://") + BLUOS_HOST + ":11000";
static constexpr uint32_t VOLUME_MIN_GAP_MS = 150;
static constexpr uint32_t STATUS_EVERY_MS = 5000;

static portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;
static int pendVolume = -1;
static bool pendToggle = false;
static int pendLights = -1;
static int stVolume = -1;
static bool stPlaying = false;
static bool stNew = false;
static char ssid[33] = "";

static int httpGet(const String& url, String* body = nullptr) {
  HTTPClient http;
  http.setConnectTimeout(1500);
  http.setTimeout(2500);
  if (!http.begin(url)) return -1;
  int code = http.GET();
  if (body && code == 200) *body = http.getString();
  http.end();
  return code;
}

static String xmlTag(const String& b, const char* tag) {
  String open = String("<") + tag + ">";
  int i = b.indexOf(open);
  if (i < 0) return "";
  i += open.length();
  int j = b.indexOf("</", i);
  return j < 0 ? "" : b.substring(i, j);
}

static void pollStatus() {
  String body;
  int code = httpGet(BLUOS + "/Status", &body);
  if (code != 200) {
    Serial.printf("BluOS /Status -> %d\n", code);
    return;
  }
  String vol = xmlTag(body, "volume");
  String state = xmlTag(body, "state");
  portENTER_CRITICAL(&mux);
  stVolume = vol.length() ? vol.toInt() : -1;
  stPlaying = state == "play" || state == "stream";
  stNew = true;
  portEXIT_CRITICAL(&mux);
}

static void netTask(void*) {
  uint32_t lastVolSent = 0, lastStatus = 0;
  bool wasConnected = false;
  for (;;) {
    bool conn = WiFi.status() == WL_CONNECTED;
    if (conn != wasConnected) {
      wasConnected = conn;
      if (conn) {
        strlcpy(ssid, WiFi.SSID().c_str(), sizeof ssid);
        Serial.printf("WiFi OK: %s, IP %s, RSSI %d\n", ssid, WiFi.localIP().toString().c_str(), WiFi.RSSI());
        lastStatus = 0;  // hned načíst stav repráku
      } else {
        Serial.println("WiFi odpojeno");
      }
    }
    if (!conn) {
      vTaskDelay(pdMS_TO_TICKS(200));
      continue;
    }

    int vol = -1, lights = -1;
    bool toggle = false;
    uint32_t now = millis();
    portENTER_CRITICAL(&mux);
    if (pendVolume >= 0 && now - lastVolSent >= VOLUME_MIN_GAP_MS) {
      vol = pendVolume;
      pendVolume = -1;
    }
    toggle = pendToggle;
    pendToggle = false;
    lights = pendLights;
    pendLights = -1;
    portEXIT_CRITICAL(&mux);

    if (toggle) Serial.printf("BluOS Play/Pauza -> %d\n", httpGet(BLUOS + "/Pause?toggle=1"));
    if (vol >= 0) {
      int c = httpGet(BLUOS + "/Volume?level=" + vol);
      lastVolSent = millis();
      Serial.printf("BluOS hlasitost %d -> %d\n", vol, c);
    }
    if (lights >= 0)
      Serial.printf("Svetla %s -> %d\n", lights ? "ZAP" : "VYP", httpGet(lights ? LIGHTS_ON_URL : LIGHTS_OFF_URL));

    if (millis() - lastStatus > STATUS_EVERY_MS || lastStatus == 0) {
      lastStatus = millis();
      pollStatus();
    }
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

void netBegin() {
  configTzTime(TZ_PRAHA, "pool.ntp.org", "time.google.com");  // NTP se doladí po připojení
  WiFi.mode(WIFI_STA);
  WiFi.setHostname("espdeck");
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  xTaskCreatePinnedToCore(netTask, "net", 8192, nullptr, 1, nullptr, 0);
}

bool netConnected() { return WiFi.status() == WL_CONNECTED; }
int netRssi() { return WiFi.RSSI(); }
const char* netSsid() { return ssid; }

void netSetVolume(int level) {
  portENTER_CRITICAL(&mux);
  pendVolume = constrain(level, 0, 100);
  portEXIT_CRITICAL(&mux);
}

void netTogglePause() {
  portENTER_CRITICAL(&mux);
  pendToggle = !pendToggle;  // dva rychlé stisky se vyruší
  portEXIT_CRITICAL(&mux);
}

void netLights(bool on) {
  portENTER_CRITICAL(&mux);
  pendLights = on ? 1 : 0;
  portEXIT_CRITICAL(&mux);
}

bool netTakeStatus(int& volume, bool& playing) {
  portENTER_CRITICAL(&mux);
  bool fresh = stNew;
  if (fresh) {
    volume = stVolume;
    playing = stPlaying;
    stNew = false;
  }
  portEXIT_CRITICAL(&mux);
  return fresh;
}
#endif
