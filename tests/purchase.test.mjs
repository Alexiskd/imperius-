// Tests du retour de paiement Stripe côté navigateur.
import assert from 'node:assert/strict';
import { parsePurchaseReturn, SESSION_ID } from '../src/paywall/purchase.js';

const ID = 'cs_test_a1B2c3D4e5F6g7H8';
assert.deepEqual(parsePurchaseReturn(`?achat=merci&session_id=${ID}`), { kind: 'paid', id: ID });
assert.deepEqual(parsePurchaseReturn('?achat=merci&session_id=cs_test_x'), { kind: 'invalid' });
assert.deepEqual(parsePurchaseReturn('?achat=merci&session_id={CHECKOUT_SESSION_ID}'), { kind: 'invalid' });
assert.deepEqual(parsePurchaseReturn('?achat=merci'), { kind: 'invalid' });
assert.deepEqual(parsePurchaseReturn('?achat=annule', ID), { kind: 'cancelled', id: ID });
assert.equal(parsePurchaseReturn('?autre=1'), null);
assert.ok(SESSION_ID.test('cs_live_' + 'a'.repeat(60)));
assert.ok(!SESSION_ID.test('cs_live_abc<script>'));
console.log('purchase: ok');
