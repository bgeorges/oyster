# oyster

A small Node.js / Express service that decodes raw hex payloads from
Digital Matter **Oyster** LoRa/Sigfox GPS trackers into readable JSON,
over HTTP.

Device frames arrive as hex strings (e.g. from a Sigfox backend callback).
This app turns a frame like

```
002360c700a3fdeb3d0000b0
```

into

```javascript
{
  MessageType: 0,
  InTrip: false,
  LastFixFailed: false,
  Latitude: 1.3066275,
  Longitude: 103.8876067,
  Heading: 0,
  SpeedKmH: 0,
  BatteryVoltage: 4.4
}
```

## Message types

The first byte's low nibble selects the record type:

| Type | Name             | Contents                                                              |
|------|------------------|-----------------------------------------------------------------------|
| `0`  | Positional data  | GPS fix: latitude/longitude, heading, speed, battery, trip flags      |
| `1`  | Downlink ACK     | Downlink-accepted flag, firmware version, 8 bytes of downlink payload |
| `2`  | Device stats     | Uptime, TX/RX/trip/GPS counters, average fix/fail/freshen times       |

Frames are little-endian; several fields in type-2 records are packed into
overlapping bit ranges. Frames shorter than 12 bytes, malformed hex, and
unknown record types are rejected with an error rather than decoded into
garbage.

## Requirements

- Node.js 18+ (tests use the built-in `node:test` runner)
- npm

## Running

```bash
npm install
npm start          # serves on PORT=8080 (see package.json)
```

## API

### `GET /parse/:data`

Decodes one hex payload. `:data` is the raw frame as a hex string
(a leading `0x` and surrounding whitespace are tolerated).

**Success** — `200` with the decoded record as JSON (examples below).

**Bad input** — `400` with a JSON error body:

```json
{ "error": "Invalid hex payload: \"abc\"" }
```

Malformed hex, short frames, and unknown record types all return `400`;
they never crash the server or return partially-decoded data.

### Other endpoints

- `GET /` — welcome page (default Express view)
- `GET /parse/` — usage stub

## Examples

```bash
# Positional data (GPS fix)
curl http://localhost:8080/parse/002360c700a3fdeb3d0000b0
# => { MessageType: 0, Latitude: 1.3066275, Longitude: 103.8876067,
#      Heading: 0, SpeedKmH: 0, BatteryVoltage: 4.4, ... }

# Downlink ACK: accepted bit set, firmware 3.7, payload aa bb cc dd ee ff 11 22
curl http://localhost:8080/parse/110307aabbccddeeff1122
# => { MessageType: 1, DownlinkAccepted: true, FirmwareVersion: '3.7',
#      DownlinkData: [170, 187, 204, 221, 238, 255, 17, 34] }

# Device stats
curl http://localhost:8080/parse/1220000280800203071002
# => { MessageType: 2, UptimeWeeks: 1, TxCount: 32, RxCount: 64, TripCount: 3,
#      GpsSuccessCount: 128, GpsFailureCount: 160,
#      AverageFixTimeSeconds: 6, AverageFailTimeSeconds: 7,
#      AverageFreshenTimeSeconds: 8, WakeUpsPerTrip: 1 }

# Malformed input
curl http://localhost:8080/parse/abc
# => 400 { "error": "Invalid hex payload: \"abc\"" }
```

## Tests

```bash
npm install
node --test
```

The suite has two layers:

- `test/payloadParser.test.js` — unit tests for the frame decoder: the README
  fixture, synthetic frames built independently of the parser (including
  negative coordinates and flag bits), the hand-packed device-stats bit
  fields, the downlink-bytes regression, and every input-validation error path.
- `test/http.test.js` — integration tests that boot the real Express app on an
  ephemeral port and exercise the HTTP contract: `200` + correct JSON on valid
  input, JSON `400`s on malformed hex / short frames / unknown record types,
  and the stub endpoints.

## Project layout

```
app.js                 Express app: middleware, routes, error handling
bin/www                Server bootstrap
PayloadParser.js       Sigfox/Oyster frame decoder (pure functions, no I/O)
routes/index.js        GET /
routes/parse.js        GET /parse/:data
views/                 Pug templates (layout, index, error)
public/stylesheets/    Static CSS
test/                  node:test suites (unit + HTTP integration)
```

## Notes

- After changing dependencies, run `npm install` locally to regenerate
  `package-lock.json` before committing.
