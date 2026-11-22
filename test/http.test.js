const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');

let server;
let baseUrl;

before(() => {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(() => {
  return new Promise((resolve) => server.close(resolve));
});

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(baseUrl + path, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

test('GET /parse/:payload returns decoded positional data', async () => {
  const res = await get('/parse/002360c700a3fdeb3d0000b0');
  assert.equal(res.status, 200);
  const json = JSON.parse(res.body);
  assert.equal(json.MessageType, 0);
  assert.ok(Math.abs(json.Latitude - 1.3066275) < 1e-9);
  assert.ok(Math.abs(json.Longitude - 103.8876067) < 1e-9);
  assert.ok(Math.abs(json.BatteryVoltage - 4.4) < 1e-9);
});

test('malformed hex input returns a JSON 400, not a crash or NaN 200', async () => {
  const res = await get('/parse/xyz');
  assert.equal(res.status, 400);
  const json = JSON.parse(res.body);
  assert.match(json.error, /Invalid hex payload/);
});

test('too-short frames return a JSON 400', async () => {
  const res = await get('/parse/00aabbcc');
  assert.equal(res.status, 400);
  const json = JSON.parse(res.body);
  assert.match(json.error, /Frame too short/);
});

test('unknown record types return a JSON 400 instead of an HTML 500', async () => {
  // Regression: the route used to read results.Latitude on a null result
  // and crash into the generic error handler.
  const res = await get('/parse/0311223344556677889900aa');
  assert.equal(res.status, 400);
  const json = JSON.parse(res.body);
  assert.match(json.error, /Unknown or unsupported record type/);
});

test('GET /parse/ returns the usage stub', async () => {
  const res = await get('/parse/');
  assert.equal(res.status, 200);
  assert.match(res.body, /Empty JSON response/);
});

test('GET / renders the index page', async () => {
  const res = await get('/');
  assert.equal(res.status, 200);
  assert.match(res.body, /Welcome to/);
});
