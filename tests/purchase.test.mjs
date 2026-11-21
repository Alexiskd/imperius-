// Tests du paywall statique : lecture du retour Stripe et du cookie d'achat.
import assert from 'node:assert/strict';
import { parsePurchaseReturn, readPurchase, SESSION_ID, COOKIE } from '../src/paywall/purchase.js';

const ID = 'cs_test_a1B2c3D4e5F6g7H8';
assert.deepEqual(parsePurchaseReturn(`?achat=merci&session_id=${ID}`), { kind: 'paid', id: ID });
assert.deepEqual(parsePurchaseReturn('?achat=merci&session_id=cs_test_x'), { kind: 'invalid' });
assert.deepEqual(parsePurchaseReturn('?achat=merci&session_id={CHECKOUT_SESSION_ID}'), { kind: 'invalid' });
assert.deepEqual(parsePurchaseReturn('?achat=merci'), { kind: 'invalid' });
assert.deepEqual(parsePurchaseReturn('?achat=annule'), { kind: 'cancelled' });
assert.equal(parsePurchaseReturn('?autre=1'), null);
assert.ok(SESSION_ID.test('cs_live_' + 'a'.repeat(60)));
assert.ok(!SESSION_ID.test('cs_live_abc<script>'));
assert.equal(readPurchase(`foo=1; ${COOKIE}=${ID}; bar=2`), ID);
assert.equal(readPurchase(`${COOKIE}=nimportequoi`), null);
assert.equal(readPurchase(''), null);
console.log('purchase: ok');
