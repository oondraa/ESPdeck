/**
 * Jediný zdroj faktů pro web. Vše je přepsané z vaultu dokumentace_md/.
 * Co tam není, tady být nesmí: chybějící údaje mají hodnotu NOT_STATED.
 */

export const REPO_URL = 'https://github.com/oondraa/ESPdeck';
export const AUTHOR_URL = 'https://github.com/oondraa';
export const CONTRIBUTORS_URL = `${REPO_URL}/graphs/contributors`;
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
export const DOC_PDF_URL = `${REPO_URL}/blob/main/ESPDeck%20dokumentace.pdf`;
export const NOT_STATED = 'neuvedeno';
export const PRICE_DATE = '3. 11. 2026';

/* ---------- Vodiče (HW/HW zapojení.md) ---------- */

export type WireGroup = 'power' | 'gnd' | 'i2c' | 'enc' | 'touch';

export const WIRE_GROUPS: Readonly<Record<WireGroup, { readonly label: string }>> = {
  power: { label: 'Napájení 3V3' },
  gnd: { label: 'GND' },
  i2c: { label: 'I²C' },
  enc: { label: 'Enkodér' },
  touch: { label: 'Dotyk' },
};

export const GROUP_ORDER: readonly WireGroup[] = ['power', 'gnd', 'i2c', 'enc', 'touch'];

export type ModuleId = 'oled' | 'enc' | 'pad';

export interface Wire {
  readonly n: number;
  readonly module: ModuleId;
  readonly moduleLabel: string;
  /** Null u plošky, která nemá pojmenovaný vývod. */
  readonly modulePin: string | null;
  readonly espLabel: string;
  /** Klíč pinu v diagramu. */
  readonly espPin: string;
  readonly fn: string;
  readonly group: WireGroup;
}

export const WIRES: readonly Wire[] = [
  { n: 1, module: 'oled', moduleLabel: 'OLED', modulePin: 'VCC', espLabel: '3V3 (μŠup)', espPin: 'U_3V3', fn: 'napájení, spíná ho GPIO47', group: 'power' },
  { n: 2, module: 'oled', moduleLabel: 'OLED', modulePin: 'GND', espLabel: 'GND (μŠup)', espPin: 'U_GND', fn: 'zem', group: 'gnd' },
  { n: 3, module: 'oled', moduleLabel: 'OLED', modulePin: 'SDA', espLabel: 'GPIO42 (μŠup)', espPin: '42', fn: 'I²C data', group: 'i2c' },
  { n: 4, module: 'oled', moduleLabel: 'OLED', modulePin: 'SCL', espLabel: 'GPIO2 (μŠup)', espPin: '2', fn: 'I²C hodiny', group: 'i2c' },
  { n: 5, module: 'enc', moduleLabel: 'Enkodér', modulePin: '5V', espLabel: '3V3', espPin: '3V3', fn: 'napájení pull-upů a RC filtru', group: 'power' },
  { n: 6, module: 'enc', moduleLabel: 'Enkodér', modulePin: 'GND', espLabel: 'GND', espPin: 'GND', fn: 'zem', group: 'gnd' },
  { n: 7, module: 'enc', moduleLabel: 'Enkodér', modulePin: 'S1', espLabel: 'GPIO15', espPin: '15', fn: 'kanál A', group: 'enc' },
  { n: 8, module: 'enc', moduleLabel: 'Enkodér', modulePin: 'S2', espLabel: 'GPIO16', espPin: '16', fn: 'kanál B', group: 'enc' },
  { n: 9, module: 'enc', moduleLabel: 'Enkodér', modulePin: 'Key', espLabel: 'GPIO17', espPin: '17', fn: 'tlačítko (aktivní v LOW)', group: 'enc' },
  { n: 10, module: 'pad', moduleLabel: 'Ploška P1', modulePin: null, espLabel: 'GPIO4', espPin: '4', fn: 'dotyk T4', group: 'touch' },
  { n: 11, module: 'pad', moduleLabel: 'Ploška P2', modulePin: null, espLabel: 'GPIO5', espPin: '5', fn: 'dotyk T5', group: 'touch' },
  { n: 12, module: 'pad', moduleLabel: 'Ploška P3', modulePin: null, espLabel: 'GPIO6', espPin: '6', fn: 'dotyk T6', group: 'touch' },
  { n: 13, module: 'pad', moduleLabel: 'Ploška P4', modulePin: null, espLabel: 'GPIO7', espPin: '7', fn: 'dotyk T7', group: 'touch' },
  { n: 14, module: 'pad', moduleLabel: 'Ploška P5', modulePin: null, espLabel: 'GPIO8', espPin: '8', fn: 'dotyk T8', group: 'touch' },
  { n: 15, module: 'pad', moduleLabel: 'Ploška P6', modulePin: null, espLabel: 'GPIO1', espPin: '1', fn: 'dotyk T1', group: 'touch' },
];

export interface Pad {
  readonly id: string;
  readonly gpio: number;
  readonly touch: string;
}

export const PADS: readonly Pad[] = [
  { id: 'P1', gpio: 4, touch: 'T4' },
  { id: 'P2', gpio: 5, touch: 'T5' },
  { id: 'P3', gpio: 6, touch: 'T6' },
  { id: 'P4', gpio: 7, touch: 'T7' },
  { id: 'P5', gpio: 8, touch: 'T8' },
  { id: 'P6', gpio: 1, touch: 'T1' },
];

export interface Warning {
  readonly title: string;
  readonly body: string;
}

export const WARNINGS: readonly Warning[] = [
  {
    title: 'Pin „5V“ enkodéru patří na 3V3',
    body: 'Pull-upy modulu by jinak daly na vstupy 5 V a ESP32-S3 není 5V tolerantní.',
  },
  {
    title: 'Displej napájej jen z μŠup',
    body: 'Tedy 3,3 V, ne 5 V. Pull-upy 10 kΩ na modulu vedou proti jeho VCC.',
  },
  {
    title: 'Bez GPIO47 displej nežije',
    body: 'Napájení konektoru μŠup se zapíná GPIO47 = HIGH. Jinak displej nesvítí ani neodpovídá na I²C.',
  },
];

export interface PinRule {
  readonly pins: string;
  readonly why: string;
}

export const PIN_RULES: readonly PinRule[] = [
  { pins: 'GPIO 1 až 14', why: 'Jen tyto umí dotyk (T1 až T14). GPIO10 na DevKitu není vyvedený, proto je P6 na GPIO1.' },
  { pins: 'GPIO 0, 3, 45, 46', why: 'Strapping piny (start a boot). Nepoužívat pro plošky ani vstupy s pull-upem.' },
  { pins: 'GPIO 19, 20', why: 'Nativní USB (D− a D+).' },
  { pins: 'GPIO 43, 44', why: 'UART0 (TX a RX) přes CH9102, nahrávání a sériová konzole.' },
  { pins: 'GPIO 26 až 32', why: 'Interní SPI flash.' },
  { pins: 'GPIO 47', why: 'Na LaskaKit DevKitu spíná napájení μŠup.' },
];

export interface Deviation {
  readonly area: string;
  readonly before: string;
  readonly now: string;
}

export const DEVIATIONS: readonly Deviation[] = [
  { area: 'Deska', before: 'IoT ESP-WROOM-32 rev.1, CP2102', now: 'ESP32-S3-DevKit, WROOM-1 N16, CH9102' },
  { area: 'OLED', before: 'GPIO21/22, lišta 2,54 mm, 100 kHz', now: 'GPIO42/2 přes μŠup, 400 kHz' },
  { area: 'Enkodér', before: 'GPIO25/26/23, interní pull-upy vypnuté', now: 'GPIO15/16/17, interní pull-upy zapnuté, S1/S2 obráceně' },
  { area: 'Plošky', before: 'GPIO 4, 13, 14, 27, 33, 32', now: 'GPIO 4, 5, 6, 7, 8, 1' },
  { area: 'Detekce dotyku', before: 'pokles pod 80 % klidu', now: 'nárůst nad 120 % klidu' },
];

/* ---------- Moduly a kusovník (HW/Moduly a BOM.md) ---------- */

export interface Spec {
  readonly k: string;
  readonly v: string;
}

export interface HwModule {
  readonly id: 'esp' | 'oled' | 'enc' | 'pads';
  readonly ref: string;
  readonly name: string;
  readonly specs: readonly Spec[];
}

export const MODULES: readonly HwModule[] = [
  {
    id: 'esp',
    ref: 'U1',
    name: 'LaskaKit ESP32-S3-DevKit',
    specs: [
      { k: 'Modul', v: 'ESP32-S3-WROOM-1 N16 (16 MB flash)' },
      { k: 'USB-UART', v: 'CH9102' },
      { k: 'PlatformIO', v: 'board = esp32-s3-devkitc-1, board_upload.flash_size = 16MB' },
      { k: 'Navíc', v: 'konektor μŠup s napájením spínaným GPIO47' },
    ],
  },
  {
    id: 'oled',
    ref: 'U2',
    name: 'LaskaKit OLED 1,3" I²C',
    specs: [
      { k: 'Řadič a rozlišení', v: 'SH1106, 128×64, monochromatický' },
      { k: 'Adresa I²C', v: '0x3C (výchozí), 0x3D pájecím můstkem' },
      { k: 'Pull-upy', v: '10 kΩ na SDA i SCL proti VCC displeje' },
      { k: 'Napájení', v: '3,3 až 5 V, max. 100 mA (v projektu 3,3 V z μŠup)' },
      { k: 'Konektory', v: '2× μŠup (Stemma QT / Qwiic), lišta 4 piny 2,54 mm' },
    ],
  },
  {
    id: 'enc',
    ref: 'U3',
    name: 'Rotační enkodér s tlačítkem a RC filtrem',
    specs: [
      { k: 'Rozlišení', v: '20 pulzů na otáčku, neomezené otáčení' },
      { k: 'Vývody', v: 'S1, S2, Key, 5V, GND' },
      { k: 'Napájení', v: 'v projektu 3,3 V (pin „5V“ na 3V3)' },
      { k: 'Dekódování', v: '4 hrany = 1 cvak, ověřeno firmwarem' },
    ],
  },
  {
    id: 'pads',
    ref: 'E1 až E6',
    name: 'Šest dotykových plošek',
    specs: [
      { k: 'Piny', v: 'GPIO 4, 5, 6, 7, 8, 1' },
      { k: 'Kanály', v: 'T4, T5, T6, T7, T8, T1' },
      { k: 'Provedení', v: NOT_STATED },
    ],
  },
];

export interface BomRow {
  readonly ref: string;
  readonly qty: number;
  readonly item: string;
  readonly code: string;
  /** Cena za kus v Kč s DPH, null = neuvedeno. */
  readonly price: number | null;
}

export const BOM: readonly BomRow[] = [
  { ref: 'U1', qty: 1, item: 'LaskaKit ESP32-S3-DevKit', code: NOT_STATED, price: null },
  { ref: 'U2', qty: 1, item: 'LaskaKit OLED 128×64 1,3" I²C (bílý / modrý)', code: 'LA141084W / LA141084B', price: 168 },
  { ref: 'U3', qty: 1, item: 'Rotační enkodér s tlačítkem a RC filtrem', code: 'LA132020', price: 48 },
  { ref: 'bez ozn.', qty: 1, item: 'Kabel μŠup (OLED a DevKit)', code: NOT_STATED, price: null },
  { ref: 'E1 až E6', qty: 6, item: 'Dotyková ploška', code: NOT_STATED, price: null },
  { ref: 'bez ozn.', qty: 11, item: 'Propojovací vodiče (enkodér 5, plošky 6)', code: NOT_STATED, price: null },
  { ref: 'bez ozn.', qty: 1, item: 'Datový USB kabel', code: NOT_STATED, price: null },
];

export const BOM_KNOWN_TOTAL = BOM.reduce((sum, r) => (r.price === null ? sum : sum + r.price * r.qty), 0);

/* ---------- Co zařízení dělá (Firmware/*, Aplikace/*) ---------- */

export type DemoAction = 'turn' | 'press' | 'long' | 'light-on' | 'light-off' | 'shortcut';

export interface Gesture {
  readonly demo: DemoAction;
  readonly input: string;
  readonly result: string;
  readonly detail: string;
}

export const GESTURES: readonly Gesture[] = [
  { demo: 'turn', input: 'Otočení enkodéru', result: 'Hlasitost Bluesoundu', detail: 'Po jednom kroku. Na displeji se na 1,2 s ukáže okénko s pruhem.' },
  { demo: 'press', input: 'Krátký stisk', result: 'Play a pauza', detail: 'Ikona se plynule přetvaruje a po 1,1 s zmizí.' },
  { demo: 'long', input: 'Stisk přes 600 ms', result: 'Přepnutí na Nastavení', detail: 'Wi-Fi, Bluetooth, PC a jas. Otočením se vybírá řádek.' },
  { demo: 'light-on', input: 'Ploška 1', result: 'Rozsvítí světla', detail: 'HTTP požadavek na lokální server. Bez Wi-Fi ukáže BEZ WIFI.' },
  { demo: 'light-off', input: 'Ploška 3', result: 'Zhasne světla', detail: 'Stejná cesta jako rozsvícení.' },
  { demo: 'shortcut', input: 'Plošky 2, 4, 5, 6', result: 'Klávesová zkratka na PC', detail: 'Když běží aplikace. Text akce se vrátí na displej.' },
];

export interface Binding {
  readonly pad: number;
  /** Null = ploška ovládá světla přímo z decku. */
  readonly shortcut: string | null;
  readonly text: string | null;
}

export const BINDINGS: readonly Binding[] = [
  { pad: 1, shortcut: null, text: null },
  { pad: 2, shortcut: 'Ctrl+C', text: 'KOPIROVAT' },
  { pad: 3, shortcut: null, text: null },
  { pad: 4, shortcut: 'Ctrl+V', text: 'VLOZIT' },
  { pad: 5, shortcut: 'Win+Shift+S', text: 'VYSTRIZEK' },
  { pad: 6, shortcut: 'Win+D', text: 'PLOCHA' },
];

export interface FlowEvent {
  readonly id: string;
  readonly label: string;
  readonly route: 'pc' | 'audio' | 'lights';
  readonly out: string;
  readonly back: string;
}

export const FLOW_EVENTS: readonly FlowEvent[] = [
  { id: 'pad2', label: 'Dotyk plošky 2', route: 'pc', out: '{"t":"touch","pad":2,"ev":"tap"}', back: '{"t":"show","text":"KOPIROVAT"}' },
  { id: 'vol', label: 'Otočení enkodéru', route: 'audio', out: 'GET /Volume?level=N', back: 'GET /Status, co 5 s' },
  { id: 'lamp', label: 'Dotyk plošky 1', route: 'lights', out: 'HTTP GET, lokální server :8181', back: 'SVETLA ZAP na displeji' },
];

/* ---------- Stav projektu (Stav projektu.md, Otevřené otázky.md) ---------- */

export type StatusLevel = 'hw' | 'ok' | 'mock';

export const STATUS_LABEL: Readonly<Record<StatusLevel, string>> = {
  hw: 'Ověřeno na HW',
  ok: 'Funguje',
  mock: 'Jen vzhled',
};

export interface StatusRow {
  readonly area: string;
  readonly level: StatusLevel;
}

export const STATUS_ROWS: readonly StatusRow[] = [
  { area: 'OLED SH1106 přes μŠup', level: 'hw' },
  { area: 'Enkodér a tlačítko', level: 'hw' },
  { area: 'Šest dotykových plošek', level: 'hw' },
  { area: 'Obrazovky Hodiny a Nastavení', level: 'ok' },
  { area: 'Wi-Fi a čas z NTP', level: 'ok' },
  { area: 'Bluesound: hlasitost, Play a pauza', level: 'ok' },
  { area: 'Světla zapnout a vypnout', level: 'ok' },
  { area: 'Spojení s PC aplikací', level: 'ok' },
  { area: 'Aplikace: zkratky a živý log', level: 'ok' },
  { area: 'Aplikace: editor Hardware a Functions', level: 'mock' },
];

export const LIMITS_PUBLIC: readonly Warning[] = [
  { title: 'Spojení s PC není zabezpečené', body: 'Otevřené TCP bez šifrování a párování. Kdokoli v síti se může připojit na port 4545, převzít spojení a číst dotyky.' },
  { title: 'Bluetooth neexistuje', body: 'Přepínač na decku i v aplikaci je jen grafika.' },
  { title: 'Editor v aplikaci je maketa', body: 'Hardware a Functions ukazují data z návrhu. Do decku se nic neposílá.' },
  { title: 'Nastavení se neukládá', body: 'Po restartu se jas vrací na 70 %. Wi-Fi a adresy se zadávají při kompilaci.' },
];

export interface Limit {
  readonly id: string;
  readonly text: string;
}

export const LIMITS: readonly Limit[] = [
  { id: 'L1', text: 'Spojení deck a PC není zabezpečené. Kdokoli v síti se může připojit na port 4545, přebrat spojení a posílat show nebo číst dotyky.' },
  { id: 'L2', text: 'Wi-Fi heslo a adresy jsou zakompilované v secrets.h, změna znamená nový build.' },
  { id: 'L3', text: 'Bluetooth neexistuje, přepínač je jen grafika (deck i aplikace).' },
  { id: 'L4', text: 'Nastavení decku (jas) se neukládá.' },
  { id: 'L5', text: 'Světla jsou napevno na ploškách 1 a 3.' },
  { id: 'L6', text: 'Enkodér a jeho tlačítko na PC nic nedělají, jen se zapíšou do logu.' },
  { id: 'L7', text: 'Editor Hardware a Functions je maketa s ukázkovými daty.' },
  { id: 'L8', text: 'upload_port = COM8 je napevno v platformio.ini.' },
  { id: 'L10', text: 'Generátor assets.h z JSON není v repozitáři.' },
  { id: 'L11', text: 'Provedení dotykových plošek (materiál, průměr, kryt, případný sériový rezistor) a kód a cena desky S3 nejsou zdokumentované.' },
];

/* ---------- Firmware ---------- */

export const TOUCH_STEPS: readonly Spec[] = [
  { k: 'Kalibrace', v: 'Při startu se 30 měření zahodí (první hodnoty jsou nesmyslně vysoké, asi 156k místo 26k). Základ je průměr z 32 vzorků.' },
  { k: 'IIR filtr', v: 'filt += (v - filt) * 0.3 tlumí šum, hlavně od Wi-Fi.' },
  { k: 'Hystereze', v: 'Dotyk při filt > základ × 1,20, uvolnění při filt < základ × 1,10.' },
  { k: 'Drift', v: 'Bez dotyku se základ pomalu posouvá (× 0.001) za aktuální hodnotou.' },
];

export const CONTROLS: readonly { readonly gesture: string; readonly clock: string; readonly settings: string }[] = [
  { gesture: 'Otočení', clock: 'hlasitost Bluesoundu ±1, okénko s pruhem 1,2 s', settings: 'posun kurzoru nebo změna jasu' },
  { gesture: 'Krátký stisk', clock: 'Play a pauza Bluesoundu s animací', settings: 'akce řádku' },
  { gesture: 'Dlouhý stisk (> 600 ms)', clock: 'přepne na Nastavení', settings: 'přepne na Hodiny' },
];

export const SETTINGS_ROWS: readonly { readonly row: string; readonly shows: string; readonly action: string }[] = [
  { row: 'WIFI', shows: 'název sítě a síla signálu (4 čárky podle RSSI), nebo ODPOJENO', action: 'žádná' },
  { row: 'BLUETOOTH', shows: 'přepínač', action: 'přepne, ale jen grafika' },
  { row: 'PC', shows: 'PRIPOJENO nebo ODPOJENO', action: 'žádná' },
  { row: 'JAS', shows: 'posuvník', action: 'zapne úpravu, krok 5 %, rozsah 5 až 100 %' },
];

export const SERIAL_CMDS: readonly Spec[] = [
  { k: 'n / p', v: 'enkodér dolů / nahoru' },
  { k: 'o / l', v: 'stisk / dlouhý stisk' },
  { k: 't', v: 'hodnoty plošek' },
  { k: 'c', v: 'znovu kalibrovat plošky (nedotýkat se)' },
  { k: 'w', v: 'SSID a RSSI, nebo „nepripojeno“' },
];

export const NET_ROWS: readonly { readonly action: string; readonly request: string; readonly note: string }[] = [
  { action: 'Hlasitost', request: 'GET /Volume?level=N', note: 'nejvýš 1× za 150 ms, posílá se poslední hodnota' },
  { action: 'Play a pauza', request: 'GET /Pause?toggle=1', note: 'dva rychlé stisky se navzájem zruší' },
  { action: 'Stav', request: 'GET /Status', note: 'co 5 s a hned po připojení' },
];

export const PROTOCOL_DECK: readonly { readonly msg: string; readonly when: string }[] = [
  { msg: '{"t":"hello","name":"ESPDeck","id":"…","fw":"0.1.0","pads":6}', when: 'hned po připojení' },
  { msg: '{"t":"touch","pad":1,"ev":"tap"}', when: 'dotyk plošky 1 až 6' },
  { msg: '{"t":"enc","d":1}', when: 'otočení enkodéru (± cvaky)' },
  { msg: '{"t":"btn","ev":"press"}', when: 'stisk, u dlouhého stisku "long"' },
  { msg: '{"t":"pong"}', when: 'odpověď na ping' },
];

export const PROTOCOL_PC: readonly { readonly msg: string; readonly when: string }[] = [
  { msg: '{"t":"ping"}', when: 'aplikace posílá co 2 s' },
  { msg: '{"t":"show","text":"KOPIROVAT"}', when: 'text v okénku na OLED, max 23 znaků, převede se na velká písmena' },
];

export const KEY_NAMES: readonly Spec[] = [
  { k: 'Modifikátory', v: 'Ctrl, Shift, Alt, Win (Meta, Super, Cmd)' },
  { k: 'Funkční', v: 'F1 až F24, Enter, Esc, Tab, Space, Backspace, Del, Ins, Home, End, PgUp, PgDn, Up, Down, Left, Right' },
  { k: 'Média', v: 'PlayPause, Next, Prev, VolUp, VolDown, Mute' },
];

/* ---------- Oživení (HW/Oživení a diagnostika.md) ---------- */

export const TOOLS: readonly { readonly tool: string; readonly run: string; readonly does: string }[] = [
  { tool: 'Sken pinů I²C', run: 'pio run -e i2cscan -t upload', does: 'zapne μŠup, zkusí dvojice bezpečných GPIO jako SDA a SCL a vypíše, kde odpoví 0x3C nebo 0x3D' },
  { tool: 'I²C sken při startu', run: 'běžný firmware', does: 'do sériové linky vypíše nalezené adresy' },
  { tool: 'Hodnoty plošek', run: 'sériově t', does: 'filtrovaná hodnota a základ každé plošky, DOTYK u stisknuté' },
  { tool: 'Kalibrace plošek', run: 'sériově c', does: 'nová kalibrace, plošek se nedotýkat' },
  { tool: 'Wi-Fi', run: 'sériově w', does: 'SSID a RSSI, nebo „nepripojeno“' },
  { tool: 'Simulace enkodéru', run: 'sériově n, p, o, l', does: 'otočení, stisk a dlouhý stisk bez HW' },
];

export const FINDINGS: readonly string[] = [
  'Piny displeje se našly skenem: SDA = GPIO42, SCL = GPIO2, adresa 0x3C.',
  'I²C na 400 kHz funguje s pull-upy jen na modulu. Na 100 kHz trval jeden snímek asi 95 ms, na plynulou animaci málo.',
  'Enkodér má S1 a S2 vůči A a B prohozené, proto ENC_REVERSE = true.',
  'Hodnota dotyku na S3 při dotyku roste. První měření po startu jsou nesmyslně vysoká.',
  'Wi-Fi zvyšuje šum dotyku, proto kalibrace 300 ms po jejím startu.',
];

export const BRINGUP: readonly string[] = [
  'Bez napájení: mezi 3V3 a GND není zkrat, pin „5V“ enkodéru vede na 3V3, ne na 5 V.',
  'Po připojení USB: v logu je I2C zarizeni: 0x3C.',
  'Displej ukazuje hodiny, dvojtečka bliká.',
  'Enkodér: na obrazovce Nastavení posouvá kurzor po jednom řádku na cvak, správným směrem.',
  'Tlačítko: krátký stisk je jedna akce, dlouhý (> 600 ms) přepne obrazovku.',
  'Plošky: t v klidu bez DOTYK, při doteku každé plošky DOTYK jen u ní.',
  'S Wi-Fi: žádné falešné dotyky v klidu.',
];
