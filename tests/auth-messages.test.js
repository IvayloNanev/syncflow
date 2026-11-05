import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NEW_PASSWORD_MIN, NOTICES, noAccessCopy, noticeFor, resendErrorNotice, resendInputNotice,
  signInErrorNotice, signInInputNotice, signUpErrorNotice, signUpInputNotice,
} from '../lib/auth-messages.js';

const longEnough = 'x'.repeat(NEW_PASSWORD_MIN);

test('sign-in does not apply the new-account password length to existing accounts', () => {
  assert.equal(signInInputNotice('a@b.co', 'short'), null);
  assert.equal(signInInputNotice('a@b.co', ''), 'signin-incomplete');
  assert.equal(signInInputNotice('not-an-email', 'short'), 'signin-incomplete');
});

test('account creation explains which input to fix', () => {
  assert.equal(signUpInputNotice('a@b.co', longEnough), null);
  assert.equal(signUpInputNotice('a@b.co', longEnough.slice(1)), 'signup-password');
  assert.equal(signUpInputNotice('a b@c.co', longEnough), 'signup-email');
  assert.equal(signUpInputNotice('a@b.co', 'x'.repeat(1025)), 'signup-password');
  assert.equal(resendInputNotice('nope'), 'resend-email');
  assert.equal(resendInputNotice('a@b.co'), null);
});

test('a wrong password and an unconfirmed email get different instructions', () => {
  assert.equal(signInErrorNotice({ code: 'invalid_credentials' }), 'signin-failed');
  assert.equal(signInErrorNotice({ code: 'email_not_confirmed' }), 'unverified');
  assert.equal(signInErrorNotice({ code: 'over_request_rate_limit' }), 'signin-limit');
});

test('unknown failures are never reported as a mistake by the person', () => {
  for (const error of [{ code: 'unexpected' }, {}, null]) {
    assert.equal(signInErrorNotice(error), 'signin-unavailable');
    assert.equal(signUpErrorNotice(error), 'signup-unavailable');
    assert.equal(resendErrorNotice(error), 'resend-unavailable');
  }
});

test('account creation and resend do not reveal that an email already has an account', () => {
  for (const code of ['user_already_exists', 'email_exists']) {
    assert.equal(signUpErrorNotice({ code }), 'check-email');
    assert.equal(resendErrorNotice({ code }), 'resent');
  }
});

test('account creation routes each known Supabase failure', () => {
  const expected = {
    weak_password: 'signup-weak',
    email_address_invalid: 'signup-email',
    signup_disabled: 'signup-closed',
    email_provider_disabled: 'signup-closed',
    email_address_not_authorized: 'signup-not-allowed',
    over_email_send_rate_limit: 'email-limit',
  };
  for (const [code, notice] of Object.entries(expected)) assert.equal(signUpErrorNotice({ code }), notice);
});

test('every routed notice exists and opens a real view', () => {
  for (const notice of Object.values(NOTICES)) {
    assert.ok(['signin', 'signup', 'verify'].includes(notice.view));
    assert.ok(['error', 'info'].includes(notice.tone));
    assert.ok(notice.text.length > 0);
  }
  const routed = [
    signInInputNotice('', ''), signUpInputNotice('', ''), signUpInputNotice('a@b.co', ''), resendInputNotice(''),
    ...['invalid_credentials', 'email_not_confirmed', 'over_request_rate_limit', 'other'].map((code) => signInErrorNotice({ code })),
    ...['email_exists', 'over_request_rate_limit', 'weak_password', 'email_address_invalid', 'signup_disabled', 'email_address_not_authorized', 'other'].map((code) => signUpErrorNotice({ code })),
    ...['email_exists', 'over_request_rate_limit', 'email_address_invalid', 'other'].map((code) => resendErrorNotice({ code })),
    'check-email', 'resent', 'link-failed',
  ];
  for (const message of routed) assert.ok(noticeFor(message), `${message} has no notice`);
});

test('no-access copy explains the account state and the next step', () => {
  const none = noAccessCopy(0);
  assert.match(none.explanation, /isn’t part of a workspace/);
  assert.match(none.nextStep, /workspace owner/);
  const several = noAccessCopy(2);
  assert.match(several.explanation, /more than one workspace/);
  assert.doesNotMatch(several.explanation, /isn’t part of a workspace/);
  assert.match(several.nextStep, /workspace owner/);
});

test('unknown or inherited message values show nothing', () => {
  for (const message of ['nope', 'constructor', 'toString', '__proto__', undefined, ['signin-failed']]) {
    assert.equal(noticeFor(message), null);
  }
});
