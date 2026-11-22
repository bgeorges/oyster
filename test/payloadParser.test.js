const { test } = require('node:test');
const assert = require('node:assert/strict');
const parser = require('../PayloadParser');

// Frame-building helpers (independent of the parser under test)
function byte(v) { return v.toString(16).padStart(2, '0'); }
function u8(v) { return byte(v & 0xff); }
function u16le(v) { return u8(v) + byte(v >> 8); }
function i32le(v) {
  const u = v < 0 ? v + 0x100000000 : v;
  return u8(u) + u8(u >> 8) + u8(u >> 16) + u8(u >> 24);
}
function positionalFrame(opts) {
  const flags = (opts.inTrip ? 0x10 : 0) | (opts.lastFixFailed ? 0x20 : 0);
  return u8(flags) +
    i32le(Math.round(opts.lat * 1e7)) +
    i32le(Math.round(opts.lon * 1e7)) +
    u8(opts.heading / 2) + u8(opts.speed) + u8(opts.batteryRaw);
}

function approx(actual, expected, name) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${name}: expected ~${expected}, got ${actual}`
  );
}

// --- Positional data (MessageType 0) ---

test('parses the README fixture frame (real device sample)', () => {
  const r = parser.parseSigFox('002360c700a3fdeb3d0000b0');
  assert.equal(r.MessageType, 0);
  assert.equal(r.InTrip, false);
  assert.equal(r.LastFixFailed, false);
  approx(r.Latitude, 1.3066275, 'Latitude');      // Singapore CBD
  approx(r.Longitude, 103.8876067, 'Longitude');
  assert.equal(r.Heading, 0);
  assert.equal(r.SpeedKmH, 0);
  approx(r.BatteryVoltage, 4.4, 'BatteryVoltage'); // 0xb0 * 25 / 1000
});

test('round-trips a synthetic frame with nonzero fields', () => {
  const hex = positionalFrame({
    lat: 47.6412, lon: 8.1426, heading: 128, speed: 85, batteryRaw: 0x64
  });
  const r = parser.parseSigFox(hex);
  approx(r.Latitude, 47.6412, 'Latitude');
  approx(r.Longitude, 8.1426, 'Longitude');
  assert.equal(r.Heading, 128);          // headingRaw * 2
  assert.equal(r.SpeedKmH, 85);
  approx(r.BatteryVoltage, 2.5, 'BatteryVoltage');
});

test('decodes negative coordinates (two\'s complement little-endian int32)', () => {
  const hex = positionalFrame({
    lat: -33.8568, lon: -151.2153, heading: 0, speed: 0, batteryRaw: 0
  });
  const r = parser.parseSigFox(hex);
  approx(r.Latitude, -33.8568, 'Latitude');     // Sydney, southern hemisphere
  approx(r.Longitude, -151.2153, 'Longitude');
});

test('decodes InTrip and LastFixFailed flag bits', () => {
  const hex = positionalFrame({
    lat: 0, lon: 0, heading: 0, speed: 0, batteryRaw: 0, inTrip: true, lastFixFailed: true
  });
  const r = parser.parseSigFox(hex);
  assert.equal(r.InTrip, true);
  assert.equal(r.LastFixFailed, true);
});

// --- Downlink ACK (MessageType 1) ---

test('returns the actual downlink bytes from the frame, not their indices', () => {
  // Regression: the parser used to emit [4,5,6,7,8,9,10,11] — byte offsets —
  // instead of the payload bytes carried at those offsets.
  const hex = '110307' + 'aabbccddeeff1122';
  const r = parser.parseSigFox(hex);
  assert.equal(r.MessageType, 1);
  assert.equal(r.DownlinkAccepted, true);
  assert.equal(r.FirmwareVersion, '3.7');
  assert.deepEqual(r.DownlinkData, [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x11, 0x22]);
});

test('DownlinkAccepted is false when the flag bit is not set', () => {
  const r = parser.parseSigFox('010307aabbccddeeff1122');
  assert.equal(r.DownlinkAccepted, false);
});

// --- Device stats (MessageType 2) ---

test('decodes overlapping bit-fields in a hand-packed device-stats frame', () => {
  // Hand-packed per the field layout:
  //   uptime=1, txRaw=1, rxRaw=2, trip=3, gpsOk=4, gpsFail=5,
  //   avgFix=6, avgFail=7, avgFresh=8, wakeups=1
  // Counters are quantised: Tx/Rx/Gps* are raw * 32.
  const hex = '1220000280800203071002';
  const r = parser.parseSigFox(hex);
  assert.deepEqual(r, {
    MessageType: 2,
    UptimeWeeks: 1,
    TxCount: 32,
    RxCount: 64,
    TripCount: 3,
    GpsSuccessCount: 128,
    GpsFailureCount: 160,
    AverageFixTimeSeconds: 6,
    AverageFailTimeSeconds: 7,
    AverageFreshenTimeSeconds: 8,
    WakeUpsPerTrip: 1
  });
});

test('record type is masked from the low nibble (high nibble belongs to uptime)', () => {
  // Same frame as above with the top nibble of byte 0 set to 0xF:
  // still MessageType 2, but uptime gains the high bits -> 15 weeks.
  const r = parser.parseSigFox('F220000280800203071002');
  assert.equal(r.MessageType, 2);
  assert.equal(r.UptimeWeeks, 15);
});

// --- Input validation (fixes from PR #1) ---

test('rejects odd-length hex input instead of silently truncating', () => {
  assert.throws(() => parser.parseSigFox('abc'), /Invalid hex payload/);
});

test('rejects non-hex characters instead of producing NaN', () => {
  assert.throws(() => parser.parseSigFox('zz11223344556677889900'), /Invalid hex payload/);
  assert.throws(() => parser.parseSigFox('00 23 60 c7'), /Invalid hex payload/);
});

test('rejects frames shorter than 12 bytes for every record type', () => {
  assert.throws(() => parser.parseSigFox('00aabbcc'), /Frame too short/);   // positional
  assert.throws(() => parser.parseSigFox('01020304'), /Frame too short/);   // downlink ack
  assert.throws(() => parser.parseSigFox('02aabb'), /Frame too short/);     // device stats
  assert.throws(() => parser.parseSigFox(null), /Frame too short|Invalid hex/);
  assert.throws(() => parser.parseSigFox(''), /Frame too short|Invalid hex/);
});

test('returns null for unknown record types', () => {
  assert.equal(parser.parseSigFox('0311223344556677889900aa'), null);
  assert.equal(parser.parseSigFox('0f11223344556677889900aa'), null);
});

test('accepts 0x prefix, surrounding whitespace and mixed case', () => {
  const r = parser.parseSigFox('  0X002360C700A3FDEB3D0000B0  ');
  approx(r.Latitude, 1.3066275, 'Latitude');
  approx(r.BatteryVoltage, 4.4, 'BatteryVoltage');
});
