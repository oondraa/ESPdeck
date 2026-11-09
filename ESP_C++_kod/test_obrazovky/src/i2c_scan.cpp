// Diagnostika: najde, na kterých pinech je OLED (I2C 0x3C/0x3D).
// Build:  pio run -e i2cscan -t upload && pio device monitor
#ifdef I2C_PIN_SCAN
#include <Arduino.h>
#include <Wire.h>

constexpr int PIN_USUP_POWER = 47;  // LaskaKit S3 DevKit: napájení konektoru μŠup

// Bezpečné GPIO na ESP32-S3 (bez flash, USB 19/20, UART0 43/44, LED 45, strapping 46, 47).
const int CAND[] = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21,
                    35, 36, 37, 38, 39, 40, 41, 42, 48};

void setup() {
  Serial.begin(115200);
  delay(500);
  pinMode(PIN_USUP_POWER, OUTPUT);
  digitalWrite(PIN_USUP_POWER, HIGH);
  delay(500);
  Serial.println("\nI2C PIN SCAN start");
  int found = 0;
  for (int sda : CAND) {
    for (int scl : CAND) {
      if (sda == scl) continue;
      Wire.begin(sda, scl, 100000);
      Wire.setTimeOut(5);
      for (uint8_t a : {0x3C, 0x3D}) {
        Wire.beginTransmission(a);
        if (Wire.endTransmission() == 0) {
          Serial.printf("FOUND addr=0x%02X SDA=%d SCL=%d\n", a, sda, scl);
          found++;
        }
      }
      Wire.end();
    }
  }
  Serial.printf("I2C PIN SCAN done, found=%d\n", found);
}

void loop() { delay(1000); }
#endif
