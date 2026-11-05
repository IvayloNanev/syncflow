// Sign-in copy and error routing. Pure so every path can be tested without Supabase.
// Each notice tells the person what to do next and names the view that lets them do it.
export const NEW_PASSWORD_MIN = 12;
const PASSWORD_MAX = 1024;
const EMAIL_MAX = 254;

export const NOTICES = {
  'signin-incomplete': { view: 'signin', tone: 'error', text: 'Enter the email and password for your account.' },
  'signin-failed': { view: 'signin', tone: 'error', text: 'That email and password don’t match. Check for typos and try again. New here? Create an account below.' },
  'signin-limit': { view: 'signin', tone: 'error', text: 'Too many sign-in attempts. Wait a few minutes, then try again.' },
  'signin-unavailable': { view: 'signin', tone: 'error', text: 'Sign-in isn’t available right now. Try again in a few minutes. If it keeps happening, tell your workspace owner.' },

  'signup-email': { view: 'signup', tone: 'error', text: 'Enter a complete email address, like name@example.com.' },
  'signup-password': { view: 'signup', tone: 'error', text: `Use a password of at least ${NEW_PASSWORD_MIN} characters.` },
  'signup-weak': { view: 'signup', tone: 'error', text: 'That password was rejected as too weak or too common. Choose a longer, less predictable one.' },
  'signup-closed': { view: 'signup', tone: 'error', text: 'Account creation is turned off right now. Ask your workspace owner to set up your access.' },
  'signup-not-allowed': { view: 'signup', tone: 'error', text: 'We can’t send a confirmation email to that address. Ask your workspace owner which email to use.' },
  'signup-unavailable': { view: 'signup', tone: 'error', text: 'We couldn’t create your account right now. Try again in a few minutes. If it keeps happening, tell your workspace owner.' },

  // Worded so it never reveals whether an address already has an account.
  'check-email': { view: 'verify', tone: 'info', text: 'If this email is new to SyncFlow, a confirmation link is on its way. If you already have an account, go back and sign in.' },
  unverified: { view: 'verify', tone: 'error', text: 'Confirm your email before signing in. Open the link we sent you, or request a new one below.' },
  'link-failed': { view: 'verify', tone: 'error', text: 'That confirmation link didn’t work. It may have expired, been used already, or been opened in a different browser. If you already confirmed, go back and sign in. Otherwise request a new link.' },
  resent: { view: 'verify', tone: 'info', text: 'If that email has an unconfirmed account, a new link is on its way. If you already confirmed, go back and sign in.' },
  'resend-email': { view: 'verify', tone: 'error', text: 'Enter a complete email address, like name@example.com.' },
  'email-limit': { view: 'verify', tone: 'error', text: 'Too many confirmation emails have been sent recently. Wait a few minutes before requesting another, and check your spam folder.' },
  'resend-unavailable': { view: 'verify', tone: 'error', text: 'We couldn’t send a new link right now. Try again in a few minutes. If it keeps happening, tell your workspace owner.' },
};

export function noticeFor(message) {
  return typeof message === 'string' && Object.hasOwn(NOTICES, message) ? NOTICES[message] : null;
}

// A signed-in account needs exactly one workspace; more than one is ambiguous, not "no team".
export function noAccessCopy(membershipCount) {
  if (membershipCount > 1) {
    return {
      title: 'Your account needs one workspace',
      explanation: 'Your account is linked to more than one workspace, and SyncFlow supports one per account for now. You can’t open requests until that’s sorted out.',
      nextStep: 'Ask your workspace owner to keep this account in just one workspace, then check again.',
    };
  }
  return {
    title: 'You’re signed in, but not on a team yet',
    explanation: 'Your account isn’t part of a workspace, so you can’t open requests yet. Creating an account doesn’t add you to a team, which keeps each team’s requests private.',
    nextStep: 'Ask your workspace owner to add the email shown above, then check again.',
  };
}

const validEmail = (email) => email.length <= EMAIL_MAX && /^[^\s@]+@[^\s@]+$/.test(email);

// Password length is only enforced for new accounts; existing passwords are Supabase's to judge.
export function signInInputNotice(email, password) {
  return validEmail(email) && password && password.length <= PASSWORD_MAX ? null : 'signin-incomplete';
}

export function signUpInputNotice(email, password) {
  if (!validEmail(email)) return 'signup-email';
  return password.length < NEW_PASSWORD_MIN || password.length > PASSWORD_MAX ? 'signup-password' : null;
}

export function resendInputNotice(email) {
  return validEmail(email) ? null : 'resend-email';
}

const RATE_LIMITS = ['over_request_rate_limit', 'over_email_send_rate_limit'];
const EXISTING_ACCOUNT = ['user_already_exists', 'email_exists'];

export function signInErrorNotice(error) {
  if (error?.code === 'invalid_credentials') return 'signin-failed';
  if (error?.code === 'email_not_confirmed') return 'unverified';
  return RATE_LIMITS.includes(error?.code) ? 'signin-limit' : 'signin-unavailable';
}

export function signUpErrorNotice(error) {
  const code = error?.code;
  if (EXISTING_ACCOUNT.includes(code)) return 'check-email';
  if (RATE_LIMITS.includes(code)) return 'email-limit';
  if (code === 'weak_password') return 'signup-weak';
  if (code === 'email_address_invalid') return 'signup-email';
  if (code === 'signup_disabled' || code === 'email_provider_disabled') return 'signup-closed';
  if (code === 'email_address_not_authorized') return 'signup-not-allowed';
  return 'signup-unavailable';
}

export function resendErrorNotice(error) {
  const code = error?.code;
  if (EXISTING_ACCOUNT.includes(code)) return 'resent';
  if (RATE_LIMITS.includes(code)) return 'email-limit';
  return code === 'email_address_invalid' ? 'resend-email' : 'resend-unavailable';
}
