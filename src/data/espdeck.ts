/**
 * Jediný zdroj faktů pro web. Vše přepsáno z dokumentu
 * „První návrh dokumentace HW zapojení.pdf“ (repozitář oondraa/ESPdeck, 3. 11. 2026).
 * Odkazy na kapitoly jsou uvedené u každého bloku.
 */

export const REPO_URL = 'https://github.com/oondraa/ESPdeck';
export const AUTHOR_URL = 'https://github.com/oondraa';
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
export const DOC_URL = `${REPO_URL}/blob/main/Prvn%C3%AD%20n%C3%A1vrh%20dokumentace%20HW%20zapojen%C3%AD.pdf`;
export const PRICE_DATE = '3. 11. 2026';

/* ---------- Skupiny vodičů (barvy jen v diagramech) ---------- */

export type WireGroup = 'power' | 'gnd' | 'i2c' | 'enc' | 'touch';

export const WIRE_GROUPS: Readonly<Record<WireGroup, { label: string; color: string }>> = {
  power: { label: 'Napájení 3V3', color: 'červená' },
  gnd: { label: 'GND', color: 'černá' },
  i2c: { label: 'I²C', color: 'modrá' },
  enc: { label: 'Enkodér', color: 'oranžová' },
  touch: { label: 'Dotyk', color: 'zelená' },
};

export const GROUP_ORDER: readonly WireGroup[] = ['power', 'gnd', 'i2c', 'enc', 'touch'];

/* ---------- Kap. 2 – tabulka 15 vodičů ---------- */

export type ModuleId = 'oled' | 'enc' | 'pad';

export interface Wire {
  readonly n: number;
  readonly module: ModuleId;
  readonly moduleLabel: string;
  readonly modulePin: string;
  /** Popisek na desce ESP32 */
  readonly espLabel: string;
  /** Klíč pinu ESP32 v diagramu */
  readonly espPin: string;
  readonly fn: string;
  /** Barva fyzického drátu podle tabulky v PDF */
  readonly wireColor: string;
  readonly group: WireGroup;
}

export const WIRES: readonly Wire[] = [
  { n: 1, module: 'oled', moduleLabel: 'OLED', modulePin: 'VCC', espLabel: '3V3', espPin: '3V3', fn: 'napájení 3,3 V', wireColor: 'červená', group: 'power' },
  { n: 2, module: 'oled', moduleLabel: 'OLED', modulePin: 'GND', espLabel: 'GND', espPin: 'GND_R', fn: 'zem', wireColor: 'černá', group: 'gnd' },
  { n: 3, module: 'oled', moduleLabel: 'OLED', modulePin: 'SDA', espLabel: 'D21 (GPIO21)', espPin: '21', fn: 'I²C data', wireColor: 'modrá', group: 'i2c' },
  { n: 4, module: 'oled', moduleLabel: 'OLED', modulePin: 'SCL', espLabel: 'D22 (GPIO22)', espPin: '22', fn: 'I²C hodiny', wireColor: 'žlutá', group: 'i2c' },
  { n: 5, module: 'enc', moduleLabel: 'Enkodér', modulePin: '5V', espLabel: '3V3', espPin: '3V3', fn: 'napájení + pull-upy filtru', wireColor: 'červená', group: 'power' },
  { n: 6, module: 'enc', moduleLabel: 'Enkodér', modulePin: 'GND', espLabel: 'GND', espPin: 'GND_L', fn: 'zem', wireColor: 'černá', group: 'gnd' },
  { n: 7, module: 'enc', moduleLabel: 'Enkodér', modulePin: 'S1', espLabel: 'D25 (GPIO25)', espPin: '25', fn: 'kanál A', wireColor: 'zelená', group: 'enc' },
  { n: 8, module: 'enc', moduleLabel: 'Enkodér', modulePin: 'S2', espLabel: 'D26 (GPIO26)', espPin: '26', fn: 'kanál B', wireColor: 'bílá', group: 'enc' },
  { n: 9, module: 'enc', moduleLabel: 'Enkodér', modulePin: 'Key', espLabel: 'D23 (GPIO23)', espPin: '23', fn: 'tlačítko (stisk osy)', wireColor: 'oranžová', group: 'enc' },
  { n: 10, module: 'pad', moduleLabel: 'Ploška P1', modulePin: '–', espLabel: 'D4 (GPIO4)', espPin: '4', fn: 'dotyk T0', wireColor: 'fialová', group: 'touch' },
  { n: 11, module: 'pad', moduleLabel: 'Ploška P2', modulePin: '–', espLabel: 'D13 (GPIO13)', espPin: '13', fn: 'dotyk T4', wireColor: 'fialová', group: 'touch' },
  { n: 12, module: 'pad', moduleLabel: 'Ploška P3', modulePin: '–', espLabel: 'D14 (GPIO14)', espPin: '14', fn: 'dotyk T6', wireColor: 'fialová', group: 'touch' },
  { n: 13, module: 'pad', moduleLabel: 'Ploška P4', modulePin: '–', espLabel: 'D27 (GPIO27)', espPin: '27', fn: 'dotyk T7', wireColor: 'fialová', group: 'touch' },
  { n: 14, module: 'pad', moduleLabel: 'Ploška P5', modulePin: '–', espLabel: 'D33 (GPIO33)', espPin: '33', fn: 'dotyk T8', wireColor: 'fialová', group: 'touch' },
  { n: 15, module: 'pad', moduleLabel: 'Ploška P6', modulePin: '–', espLabel: 'D32 (GPIO32)', espPin: '32', fn: 'dotyk T9', wireColor: 'fialová', group: 'touch' },
];

/* ---------- Plošky (kap. 2, 5.1) ---------- */

export interface Pad {
  readonly id: string;
  readonly gpio: number;
  readonly touch: string;
}

export const PADS: readonly Pad[] = [
  { id: 'P1', gpio: 4, touch: 'T0' },
  { id: 'P2', gpio: 13, touch: 'T4' },
  { id: 'P3', gpio: 14, touch: 'T6' },
  { id: 'P4', gpio: 27, touch: 'T7' },
  { id: 'P5', gpio: 33, touch: 'T8' },
  { id: 'P6', gpio: 32, touch: 'T9' },
];

/* ---------- Kap. 1 + 3.2 – moduly ---------- */

export interface Spec {
  readonly k: string;
  readonly v: string;
}

export interface HwModule {
  readonly id: string;
  readonly index: string;
  readonly name: string;
  readonly part: string;
  readonly code: string;
  readonly power: string;
  readonly specs: readonly Spec[];
}

export const MODULES: readonly HwModule[] = [
  {
    id: 'esp32',
    index: 'U1',
    name: 'ESP32',
    part: 'IoT ESP-WROOM-32 rev.1, CP2102',
    code: 'LA100036',
    power: '5 V z USB → 3,3 V regulátor na desce',
    specs: [
      { k: 'SoC', v: 'ESP32-D0WDQ6 rev.1' },
      { k: 'CPU', v: '2× Xtensa LX6, 80–240 MHz' },
      { k: 'Paměť', v: '4 MB SPI flash, 520 kB SRAM' },
      { k: 'Rádio', v: 'Wi-Fi 802.11 b/g/n 2,4 GHz, Bluetooth 4.2 BR/EDR + BLE' },
      { k: 'USB-UART', v: 'CP2102, microUSB' },
      { k: 'Použito', v: '1× I²C (HW), 6× touch kanál, PCNT nebo GPIO přerušení' },
      { k: 'Rozměry', v: 'cca 55 × 28 mm' },
    ],
  },
  {
    id: 'oled',
    index: 'U2',
    name: 'OLED 1,3"',
    part: 'LaskaKit OLED 128×64 1,3" I²C',
    code: 'LA141084W / B',
    power: '3,3 V',
    specs: [
      { k: 'Řadič', v: 'SH1106, 128 × 64 bodů, monochromatický (bílý nebo modrý)' },
      { k: 'Adresa I²C', v: '0x3C (výchozí), 0x3D pájecím můstkem' },
      { k: 'Pull-up', v: '10 kΩ na SDA i SCL proti VCC displeje' },
      { k: 'Odběr', v: 'max 100 mA' },
      { k: 'Konektory', v: '2× μŠup (Stemma QT / Qwiic), lišta 4 piny 2,54 mm' },
      { k: 'Rozměr', v: '34 × 36 mm, deska v1.2' },
    ],
  },
  {
    id: 'enc',
    index: 'U3',
    name: 'Rotační enkodér',
    part: 'Rotační enkodér s tlačítkem a RC filtrem',
    code: 'LA132020',
    power: '3,3 V (pin „5V“ připojit na 3V3)',
    specs: [
      { k: 'Rozlišení', v: '20 pulzů na otáčku, neomezené otáčení' },
      { k: 'Vývody', v: 'S1, S2, Key, 5V, GND' },
      { k: 'Filtr', v: 'RC filtr na desce modulu' },
      { k: 'Mechanika', v: 'osa cca 20 mm, závit cca M7, délka závitu cca 6 mm' },
      { k: 'Životnost', v: 'cca 30 000 cyklů' },
      { k: 'Napájení', v: 'deklarováno 5 V, v projektu 3,3 V' },
    ],
  },
  {
    id: 'pads',
    index: 'E1–E6',
    name: '6× dotyková ploška',
    part: 'Měděná ploška, vlastní výroba',
    code: 'vlastní DPS / měděná páska',
    power: 'bez napájení (pasivní elektroda)',
    specs: [
      { k: 'Elektroda', v: 'kruh Ø 12 mm, měď' },
      { k: 'Sériový R', v: '510 Ω (R1–R6)' },
      { k: 'Kryt', v: 'akrylát / polykarbonát 1–2 mm, bez vzduchové mezery' },
      { k: 'Rozteč', v: '≥ 10 mm hrana–hrana' },
      { k: 'Kanály', v: 'T0, T4, T6, T7, T8, T9' },
      { k: 'Citlivost', v: 'cíl > 3 %, odstup S/N > 5 : 1' },
    ],
  },
];

/* ---------- Kap. 2 – postup sestavení ---------- */

export interface BuildStep {
  readonly title: string;
  readonly body: string;
  readonly wires?: string;
}

export const BUILD_STEPS: readonly BuildStep[] = [
  { title: 'Lišta na OLED', body: 'Na OLED připájej přiloženou 4pinovou lištu, nebo použij kabel μŠup. Adresní můstek nech z výroby na 0x3C.' },
  { title: 'Napájení', body: '3V3 a GND z ESP32 rozveď na OLED i enkodér.', wires: '1, 2, 5, 6' },
  { title: 'I²C', body: 'Propoj SDA a SCL. Kabel drž krátký, ideálně do 15 cm.', wires: '3, 4' },
  { title: 'Enkodér', body: 'Propoj S1, S2 a Key.', wires: '7–9' },
  { title: 'Plošky', body: 'Každou plošku připoj zvlášť tenkým vodičem, co nejkratším a všechny stejně dlouhé. Vodiče k ploškám neveď souběžně s I²C.', wires: '10–15' },
  { title: 'Kontrola multimetrem', body: 'Před připojením USB: mezi 3V3 a GND není zkrat a na pinu „5V“ enkodéru není nic připojeno k 5 V.' },
  { title: 'První start', body: 'Připoj microUSB, nahraj testovací firmware a projdi kontrolní seznam oživení.' },
];

export interface Warning {
  readonly title: string;
  readonly body: string;
}

export const WARNINGS: readonly Warning[] = [
  {
    title: 'OLED ani enkodér nenapájej z 5 V',
    body: 'Oba moduly mají pull-up rezistory proti svému napájení. Při 5 V by na piny ESP32 přišlo 5 V a ESP32 není 5V tolerantní.',
  },
  {
    title: 'Chybný popisek na desce: pod pinem 5V není GND',
    body: 'Je tam natištěno GND, ve skutečnosti je to CMD (linka flash). Zem ber jen z pinů GND, které odpovídají pinoutu prodejce.',
  },
  {
    title: 'Pro plošky nepoužívej GPIO 0, 2, 12, 15',
    body: 'Jsou to strapping piny. Dotyk nebo vodič na nich může zablokovat start nebo nahrávání.',
  },
];

/* ---------- Kap. 3 – elektrické parametry ---------- */

export interface OperatingRow {
  readonly param: string;
  readonly min: string;
  readonly typ: string;
  readonly max: string;
  readonly unit: string;
  readonly note: string;
}

export const OPERATING: readonly OperatingRow[] = [
  { param: 'Napájení USB (VBUS)', min: '4,75', typ: '5,0', max: '5,25', unit: 'V', note: 'microUSB na desce ESP32' },
  { param: 'Napájení přes pin V5 (místo USB)', min: '–', typ: '5,0', max: '7', unit: 'V', note: 'doporučení prodejce: max cca 7 V, nad 9 V ne' },
  { param: 'Logická úroveň / rail 3V3', min: '–', typ: '3,3', max: '–', unit: 'V', note: 'lineární regulátor na desce ESP32' },
  { param: 'Napětí na libovolném GPIO', min: '−0,3', typ: '–', max: '3,6', unit: 'V', note: 'absolutní maximum, ne 5V tolerantní' },
  { param: 'VIH (log. 1)', min: '2,48', typ: '–', max: '–', unit: 'V', note: '0,75 × VDD' },
  { param: 'VIL (log. 0)', min: '–', typ: '–', max: '0,83', unit: 'V', note: '0,25 × VDD' },
  { param: 'Frekvence I²C', min: '–', typ: '100', max: '400', unit: 'kHz', note: '400 kHz jen se silnějšími pull-upy' },
  { param: 'Pracovní teplota', min: '0', typ: '25', max: '40', unit: '°C', note: 'vnitřní použití; dotyk je teplotně citlivý' },
];

export interface BudgetRow {
  readonly item: string;
  readonly typ: string;
  readonly peak: string;
  readonly source: string;
}

export const BUDGET: readonly BudgetRow[] = [
  { item: 'ESP32 s Wi-Fi vysíláním', typ: '–', peak: 'cca 300 mA', source: 'aplikační poznámka Espressif' },
  { item: 'OLED SH1106', typ: 'dle počtu svítících bodů', peak: '100 mA', source: 'prodejce' },
  { item: 'Pull-upy enkodéru (3× 10 kΩ, předpoklad)', typ: '< 0,1 mA', peak: '1 mA', source: 'výpočet' },
  { item: 'Pull-upy I²C (2× 10 kΩ)', typ: '< 0,5 mA', peak: '0,7 mA', source: 'výpočet' },
  { item: 'Dotykové plošky', typ: 'zanedbatelné', peak: 'zanedbatelné', source: '–' },
  { item: 'Celkem z 3V3', typ: '–', peak: 'cca 0,4 A', source: '–' },
];

export interface I2cRow {
  readonly variant: string;
  readonly rp: string;
  readonly cb: string;
  readonly tr: string;
  readonly k100: boolean;
  readonly k400: boolean;
}

export const I2C_TIMING: readonly I2cRow[] = [
  { variant: 'Jen pull-upy na OLED', rp: '10 kΩ', cb: '50 pF', tr: 'cca 424 ns', k100: true, k400: false },
  { variant: '+ 4,7 kΩ paralelně u ESP32', rp: '3,2 kΩ', cb: '50 pF', tr: 'cca 136 ns', k100: true, k400: true },
];

export interface TimingRow {
  readonly k: string;
  readonly v: string;
  readonly note: string;
}

export const ENCODER_TIMING: readonly TimingRow[] = [
  { k: 'Hran na otáčku (plná kvadratura)', v: '80', note: '20 pulzů × 4 hrany' },
  { k: 'Min. odstup hran pro spolehlivé čtení', v: 'cca 0,6 ms', note: '2× nejpomalejší náběh (277 µs)' },
  { k: 'Max. rychlost otáčení', v: 'cca 20 ot/s', note: '1 / (0,6 ms × 80), ruka zvládne zlomek' },
  { k: 'Log. 0 s interním pull-upem ESP32 (cca 45 kΩ)', v: 'cca 0,6 V', note: 'dělič 10 kΩ / 55 kΩ, těsně pod VIL 0,83 V, proto pull-up nezapínat' },
];

export interface PadRule {
  readonly param: string;
  readonly project: string;
  readonly espressif: string;
}

export const PAD_RULES: readonly PadRule[] = [
  { param: 'Tvar elektrody', project: 'kruh (případně čtverec se zaoblenými rohy)', espressif: 'bez ostrých rohů < 90°' },
  { param: 'Průměr elektrody', project: '12 mm', espressif: '8–15 mm, typicky 12 mm' },
  { param: 'Rozteč sousedních plošek', project: '≥ 10 mm (hrana–hrana)', espressif: '> 5 mm' },
  { param: 'Mezera elektroda – šrafovaná zem', project: '1,5 mm', espressif: '1–2 mm, ideálně = tloušťka krytu' },
  { param: 'Mezera vedení – zem', project: '0,5–1 mm', espressif: '0,5–1 mm' },
  { param: 'Šířka spoje (DPS)', project: '0,15 mm', espressif: '≤ 0,18 mm' },
  { param: 'Délka vedení', project: 'co nejkratší, max 150 mm', espressif: '≤ 300 mm' },
  { param: 'Zemní výplň', project: 'šrafovaná cca 19 % (čára 5 mil, rozteč 50 mil)', espressif: 'plná zem ne blíž než 10 mm' },
  { param: 'Sériový rezistor', project: '510 Ω', espressif: '470 Ω – 2 kΩ, doporučeno 510 Ω, do 1 mm od pinu' },
  { param: 'Kryt (overlay)', project: 'akrylát / polykarbonát 1–2 mm, nalepený', espressif: 'plast ≤ 3 mm, bez vzduchové mezery, nevodivý' },
  { param: 'Tloušťka DPS', project: '1,6 mm FR4', espressif: '0,5–1,65 mm' },
];

export interface GpioRow {
  readonly gpio: string;
  readonly label: string;
  readonly side: 'levá' | 'pravá';
  readonly net: string;
  readonly dir: string;
  readonly pullup: string;
  readonly why: string;
}

export const GPIO_ALLOCATION: readonly GpioRow[] = [
  { gpio: '21', label: 'D21', side: 'pravá', net: 'I2C_SDA', dir: 'obousměrný, open-drain', pullup: '10 kΩ na OLED', why: 'výchozí HW I²C ESP32' },
  { gpio: '22', label: 'D22', side: 'pravá', net: 'I2C_SCL', dir: 'výstup, open-drain', pullup: '10 kΩ na OLED', why: 'výchozí HW I²C ESP32' },
  { gpio: '25', label: 'D25', side: 'levá', net: 'ENC_A', dir: 'vstup', pullup: 'na modulu enkodéru', why: 'volný, umí přerušení i PCNT' },
  { gpio: '26', label: 'D26', side: 'levá', net: 'ENC_B', dir: 'vstup', pullup: 'na modulu enkodéru', why: 'sousedí s ENC_A – krátké souběžné vedení' },
  { gpio: '23', label: 'D23', side: 'pravá', net: 'ENC_KEY', dir: 'vstup', pullup: 'interní (INPUT_PULLUP)', why: 'není RTC pin, nemá vliv na dotyk' },
  { gpio: '4', label: 'D4', side: 'pravá', net: 'TOUCH_1', dir: 'analog (T0)', pullup: 'žádný', why: 'jediný použitelný touch pin vpravo' },
  { gpio: '13', label: 'D13', side: 'levá', net: 'TOUCH_2', dir: 'analog (T4)', pullup: 'žádný', why: 'není strapping; JTAG MTCK nepoužíváme' },
  { gpio: '14', label: 'D14', side: 'levá', net: 'TOUCH_3', dir: 'analog (T6)', pullup: 'žádný', why: 'JTAG MTMS; při bootu krátce pulzuje, jako vstup nevadí' },
  { gpio: '27', label: 'D27', side: 'levá', net: 'TOUCH_4', dir: 'analog (T7)', pullup: 'žádný', why: 'bez omezení' },
  { gpio: '33', label: 'D33', side: 'levá', net: 'TOUCH_5', dir: 'analog (T8)', pullup: 'žádný', why: 'pin 32K_XN, deska nemá krystal 32 kHz' },
  { gpio: '32', label: 'D32', side: 'levá', net: 'TOUCH_6', dir: 'analog (T9)', pullup: 'žádný', why: 'pin 32K_XP, deska nemá krystal 32 kHz' },
];

export const GPIO_AVOIDED: readonly Spec[] = [
  { k: '0 (T1)', v: 'strapping – log. 0 při startu = režim nahrávání; dotyk může zablokovat boot' },
  { k: '2 (T2)', v: 'strapping – musí být 0/plovoucí pro nahrávání; na řadě klonů zde bývá LED' },
  { k: '12 (T5)', v: 'strapping MTDI – log. 1 při startu přepne flash na 1,8 V a deska nenaběhne' },
  { k: '15 (T3)', v: 'strapping MTDO – ovlivňuje bootovací výpis a časování SDIO' },
  { k: '6–11', v: 'připojeno na interní SPI flash – nikdy nepoužívat' },
  { k: '1, 3', v: 'UART0 (TX/RX) přes CP2102 – nahrávání a sériová konzole' },
  { k: '36, 39', v: 'pouze vstupy; falešná přerušení při zapnutém ADC/Wi-Fi' },
];

export const GPIO_RESERVE =
  'GPIO 16, 17, 18, 19, 5 (obecné I/O, GPIO5 je strapping – jen jako výstup) a GPIO 34, 35 (pouze vstupy, bez interních pull-upů).';

/* ---------- Kap. 9 – BOM ---------- */

export interface BomRow {
  readonly ref: string;
  readonly qty: number;
  readonly item: string;
  readonly value: string;
  readonly code: string;
  /** Cena za kus v Kč s DPH, null = neuvedeno */
  readonly price: number | null;
  readonly required: string;
}

export const BOM: readonly BomRow[] = [
  { ref: 'U1', qty: 1, item: 'IoT ESP-WROOM-32 rev.1, CP2102', value: 'ESP32-D0WDQ6, 4 MB', code: 'LA100036', price: 198, required: 'ano' },
  { ref: 'U2', qty: 1, item: 'LaskaKit OLED 128×64 1,3" I²C', value: 'SH1106, bílý (W) nebo modrý (B)', code: 'LA141084W / LA141084B', price: 168, required: 'ano' },
  { ref: 'U3', qty: 1, item: 'Rotační enkodér s tlačítkem a RC filtrem', value: '20 pulzů/ot.', code: 'LA132020', price: 48, required: 'ano' },
  { ref: 'E1–E6', qty: 6, item: 'Dotyková elektroda', value: 'Cu ploška Ø 12 mm', code: 'vlastní DPS / měděná páska', price: null, required: 'ano' },
  { ref: 'R1–R6', qty: 6, item: 'Rezistor v sérii s ploškou', value: '510 Ω, 0805 nebo THT', code: '–', price: null, required: 'doporučeno' },
  { ref: 'R7, R8', qty: 2, item: 'Přídavný pull-up I²C', value: '4,7 kΩ', code: '–', price: null, required: 'jen pro 400 kHz' },
  { ref: '–', qty: 1, item: 'Kryt plošek', value: 'akrylát / PC 1–2 mm + oboustranná nevodivá páska', code: '–', price: null, required: 'ano' },
  { ref: '–', qty: 15, item: 'Propojovací vodič', value: 'dupont F-F nebo lanko 0,25 mm²', code: '–', price: null, required: 'ano' },
  { ref: '–', qty: 1, item: 'Kabel microUSB (datový)', value: '–', code: '–', price: null, required: 'ano' },
];

export const BOM_TOTAL = BOM.reduce((sum, r) => (r.price === null ? sum : sum + r.price * r.qty), 0);

/* ---------- Kap. 10 – oživení ---------- */

export const BRINGUP: readonly string[] = [
  'Bez napájení: odpor 3V3–GND > 1 kΩ (žádný zkrat), pin „5V“ enkodéru vede na 3V3.',
  'Po připojení USB: na 3V3 je 3,2–3,4 V, regulátor po 5 min jen vlažný.',
  'Na SDA a SCL je v klidu 3,3 V (ne 5 V!).',
  'I²C scanner najde zařízení na adrese 0x3C.',
  'Testovací sketch zobrazí text a 6 rámečků bez posunu obrazu.',
  'Enkodér: 20 cvaknutí = 20 kroků na displeji v obou směrech, bez přeskakování při rychlém otáčení.',
  'Tlačítko enkodéru: jeden stisk = jedna změna stavu.',
  'Dotyk: ze sériového výpisu zapiš klid a dotyk pro každou plošku, spočítej citlivost (> 3 %).',
  'Dotyk se zapnutou Wi-Fi: žádné falešné sepnutí za 10 min v klidu.',
  'Přeslech: dotyk jedné plošky nesepne sousední.',
  'Restart a nahrávání firmwaru fungují i s připojenými ploškami (ověření strapping pinů).',
];

export interface Risk {
  readonly risk: string;
  readonly impact: string;
  readonly fix: string;
}

export const RISKS: readonly Risk[] = [
  { risk: 'OLED nebo enkodér omylem na 5 V', impact: 'trvalé poškození vstupů ESP32', fix: 'napájení jen z 3V3; krok 3 kontrolního seznamu' },
  { risk: 'Chybný popisek CMD/GND na desce', impact: 'zkrat flash linky, deska nenaběhne', fix: 'GND brát jen podle pinoutu prodejce' },
  { risk: 'Neznámé hodnoty RC na modulu enkodéru', impact: 'jiné časování, než je v kap. 7', fix: 'změřit R a C, přepočítat' },
  { risk: 'I²C 400 kHz s 10 kΩ pull-upy', impact: 'chyby přenosu, „rozsypaný“ obraz', fix: '100 kHz, nebo přidat 4,7 kΩ' },
  { risk: 'Drift dotyku (teplota, vlhkost, Wi-Fi)', impact: 'falešné nebo chybějící dotyky', fix: 'filtrované čtení, průběžná rekalibrace, kalibrace po startu Wi-Fi' },
  { risk: 'Dlouhé nebo svazkované vodiče k ploškám', impact: 'velká Cp, nízká citlivost, přeslech', fix: 'max 150 mm, nesvazovat, finálně vlastní DPS' },
  { risk: 'Mechanické opotřebení enkodéru', impact: 'tuhnutí, výpadky pulzů', fix: 'mít náhradní kus, případně později optický enkodér' },
  { risk: 'Deska ESP32 není určena pro baterii', impact: 'vysoký klidový odběr i v deep-sleep', fix: 'pro bateriový provoz zvážit jinou desku' },
];

/* ---------- Kap. 8 – firmware (doslovně) ---------- */

export const FIRMWARE = `// ESP32 + OLED SH1106 (I2C) + 6x touch + rotační enkodér – testovací firmware
#include <Arduino.h>
#include <Wire.h>
#include <U8g2lib.h>

// ---- Piny (kap. 5) ----
constexpr int PIN_SDA = 21, PIN_SCL = 22;
constexpr int PIN_ENC_A = 25, PIN_ENC_B = 26, PIN_ENC_KEY = 23;
constexpr uint8_t TOUCH_PINS[6] = {4, 13, 14, 27, 33, 32};   // T0 T4 T6 T7 T8 T9

U8G2_SH1106_128X64_NONAME_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE);

// ---- Enkodér: kvadraturní dekodér se stavovou tabulkou ----
volatile int32_t encCount = 0;
volatile uint8_t encState = 0;
const int8_t QDEC[16] = {0,-1,1,0, 1,0,0,-1, -1,0,0,1, 0,1,-1,0};

void IRAM_ATTR encISR() {
  encState = ((encState << 2) | (digitalRead(PIN_ENC_A) << 1) | digitalRead(PIN_ENC_B)) & 0x0F;
  encCount += QDEC[encState];
}

// ---- Dotyk: klidové hodnoty a práh ----
uint16_t baseline[6];
constexpr float TOUCH_RATIO = 0.80f;   // dotyk = pokles pod 80 % klidu (ladit, kap. 10)

void calibrateTouch() {                 // při kalibraci se plošek nedotýkat!
  for (int i = 0; i < 6; i++) {
    uint32_t sum = 0;
    for (int k = 0; k < 32; k++) { sum += touchRead(TOUCH_PINS[i]); delay(2); }
    baseline[i] = sum / 32;
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin(PIN_SDA, PIN_SCL);
  oled.setI2CAddress(0x3C << 1);       // U8g2 chce 8bitovou adresu
  oled.setBusClock(100000);            // 400000 jen s přidanými 4,7k pull-upy (kap. 3.4)
  oled.begin();

  pinMode(PIN_ENC_A, INPUT);           // pull-upy má modul enkodéru
  pinMode(PIN_ENC_B, INPUT);
  pinMode(PIN_ENC_KEY, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_A), encISR, CHANGE);
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_B), encISR, CHANGE);

  // Pokud projekt používá Wi-Fi, zapni ji PŘED kalibrací dotyku.
  calibrateTouch();
}

void loop() {
  // Dotyk
  uint8_t touched = 0;
  for (int i = 0; i < 6; i++) {
    uint16_t v = touchRead(TOUCH_PINS[i]);
    if (v < baseline[i] * TOUCH_RATIO) touched |= (1 << i);
  }

  // Tlačítko enkodéru – debounce 30 ms
  static bool lastRaw = false, keyPressed = false;
  static uint32_t tChange = 0;
  bool raw = (digitalRead(PIN_ENC_KEY) == LOW);
  if (raw != lastRaw) { lastRaw = raw; tChange = millis(); }
  if (millis() - tChange > 30) keyPressed = raw;

  int32_t detent = encCount / 4;       // 4 hrany = 1 cvaknutí (kap. 7.2)

  // Displej
  oled.clearBuffer();
  oled.setFont(u8g2_font_6x12_tr);
  oled.setCursor(0, 12); oled.printf("ENC: %ld", (long)detent);
  oled.setCursor(0, 26); oled.printf("KEY: %s", keyPressed ? "STISK" : "-");
  for (int i = 0; i < 6; i++) {
    int x = 4 + i * 20;
    if (touched & (1 << i)) oled.drawBox(x, 40, 16, 16);
    else                    oled.drawFrame(x, 40, 16, 16);
  }
  oled.sendBuffer();

  // Ladicí výpis pro nastavení prahů
  static uint32_t tLog = 0;
  if (millis() - tLog > 500) {
    tLog = millis();
    for (int i = 0; i < 6; i++) Serial.printf("T%d=%u/%u  ", i + 1, touchRead(TOUCH_PINS[i]), baseline[i]);
    Serial.println();
  }
  delay(20);
}
`;

export const FIRMWARE_NOTES: readonly string[] = [
  'Řadič je SH1106, ne SSD1306. S ovladačem SSD1306 bude obraz posunutý o 2 sloupce.',
  'U8g2 si takt I²C nastavuje sám, proto setBusClock() místo Wire.setClock().',
  'Pro finální verzi nahraď touchRead() filtrovaným čtením (IIR filtr touch ovladače ESP-IDF) a doplň průběžnou rekalibraci klidové hodnoty. Hodnoty driftují s teplotou a napájením.',
  'Pokud se enkodér točí obráceně, prohoď v encISR() pořadí A a B.',
];

/* ---------- Stav projektu (kap. 1) ---------- */

export const STATUS_DONE: readonly string[] = [
  'HW zapojení navržené a zdokumentované',
  'Alokace GPIO a omezení ESP32',
  'Návrh kapacitních plošek podle Espressif',
  'Výpočet časování I²C a RC filtru enkodéru',
  'Testovací firmware pro ověření celého HW',
  'Kusovník a kontrolní seznam oživení',
];

export const STATUS_OPEN: readonly string[] = [
  'Ověřit hodnoty R/C na desce enkodéru měřením',
  'Odladit prahy dotyku na finálním krytu',
  'Rozhodnout o rychlosti I²C: 100 vs. 400 kHz',
];

export const SOURCES: readonly { label: string; href: string }[] = [
  { label: 'LaskaKit – IoT ESP-WROOM-32 rev.1, CP2102', href: 'https://www.laskakit.cz/' },
  { label: 'LaskaKit – OLED displej 128×64 1,3" I²C', href: 'https://www.laskakit.cz/' },
  { label: 'LaskaKit – Rotační enkodér s tlačítkem a RC filtrem', href: 'https://www.laskakit.cz/' },
  { label: 'Espressif – Touch Sensor Application Note', href: 'https://github.com/espressif/esp-iot-solution/blob/release/v1.0/documents/touch_pad_solution/touch_sensor_design_en.md' },
  { label: 'Espressif – ESP-IDF Touch Sensor API', href: 'https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/touch_pad.html' },
];
