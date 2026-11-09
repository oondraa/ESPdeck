#ifndef I2C_PIN_SCAN
#include "pc.h"

#include <ArduinoJson.h>
#include <ESPmDNS.h>
#include <WiFi.h>

#include "net.h"

static constexpr const char* FW_VERSION = "0.1.0";
static constexpr uint32_t CLIENT_TIMEOUT_MS = 6000;  // aplikace pinguje co 2 s

static QueueHandle_t outQ;  // hotové řádky k odeslání
static volatile bool connected = false;
static portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;
static char showText[24];
static bool showNew = false;

static void enqueue(const char* line) {
  if (!connected) return;  // bez aplikace se nic nehromadí
  char buf[96];
  strlcpy(buf, line, sizeof buf);
  xQueueSend(outQ, buf, 0);
}

static void handleLine(const String& line, WiFiClient& c) {
  JsonDocument doc;
  if (deserializeJson(doc, line)) return;
  const char* t = doc["t"] | "";
  if (!strcmp(t, "ping")) {
    c.print("{\"t\":\"pong\"}\n");
  } else if (!strcmp(t, "show")) {
    portENTER_CRITICAL(&mux);
    strlcpy(showText, doc["text"] | "", sizeof showText);
    showNew = true;
    portEXIT_CRITICAL(&mux);
  }
}

static void pcTask(void*) {
  WiFiServer server(PC_PORT);
  WiFiClient client;
  bool started = false;
  String line;
  uint32_t lastRx = 0;
  char id[13];
  snprintf(id, sizeof id, "%012llx", ESP.getEfuseMac());

  for (;;) {
    if (!netConnected()) {
      if (connected) {
        client.stop();
        connected = false;
      }
      vTaskDelay(pdMS_TO_TICKS(200));
      continue;
    }
    if (!started) {
      server.begin();
      server.setNoDelay(true);
      if (MDNS.begin("espdeck")) {
        MDNS.addService("espdeck", "tcp", PC_PORT);
        MDNS.addServiceTxt("espdeck", "tcp", "id", (const char*)id);
        MDNS.addServiceTxt("espdeck", "tcp", "fw", FW_VERSION);
      }
      started = true;
      Serial.printf("PC: cekam na aplikaci na %s:%u (espdeck.local)\n", WiFi.localIP().toString().c_str(), PC_PORT);
    }

    // Nové spojení nahradí staré (aplikace se mohla restartovat).
    WiFiClient incoming = server.accept();
    if (incoming) {
      client.stop();
      client = incoming;
      client.setNoDelay(true);
      line = "";
      lastRx = millis();
      xQueueReset(outQ);
      connected = true;
      char hello[128];
      snprintf(hello, sizeof hello, "{\"t\":\"hello\",\"name\":\"ESPDeck\",\"id\":\"%s\",\"fw\":\"%s\",\"pads\":6}\n", id,
               FW_VERSION);
      client.print(hello);
      Serial.printf("PC: pripojeno %s\n", client.remoteIP().toString().c_str());
    }

    if (connected) {
      if (!client.connected() || millis() - lastRx > CLIENT_TIMEOUT_MS) {
        Serial.println("PC: odpojeno");
        client.stop();
        connected = false;
        xQueueReset(outQ);
      } else {
        while (client.available()) {
          char ch = client.read();
          lastRx = millis();
          if (ch == '\n') {
            handleLine(line, client);
            line = "";
          } else if (line.length() < 256) {
            line += ch;
          }
        }
        char msg[96];
        while (xQueueReceive(outQ, msg, 0) == pdTRUE) client.print(msg);
      }
    }
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

void pcBegin() {
  outQ = xQueueCreate(32, 96);
  xTaskCreatePinnedToCore(pcTask, "pc", 6144, nullptr, 1, nullptr, 0);
}

bool pcConnected() { return connected; }

void pcSendTouch(int pad) {
  char b[64];
  snprintf(b, sizeof b, "{\"t\":\"touch\",\"pad\":%d,\"ev\":\"tap\"}\n", pad);
  enqueue(b);
}

void pcSendEncoder(int delta) {
  char b[48];
  snprintf(b, sizeof b, "{\"t\":\"enc\",\"d\":%d}\n", delta);
  enqueue(b);
}

void pcSendButton(bool longPress) {
  enqueue(longPress ? "{\"t\":\"btn\",\"ev\":\"long\"}\n" : "{\"t\":\"btn\",\"ev\":\"press\"}\n");
}

bool pcTakeShow(char* out, size_t n) {
  portENTER_CRITICAL(&mux);
  bool fresh = showNew;
  if (fresh) {
    strlcpy(out, showText, n);
    showNew = false;
  }
  portEXIT_CRITICAL(&mux);
  return fresh;
}
#endif
