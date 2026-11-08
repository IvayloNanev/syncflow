// Supabase writes a fresh PKCE verifier before sending the email. A rejected
// resend must not strand an earlier email by replacing its browser verifier.
export async function preserveRecoveryOnFailure(jar, secure, request) {
  const recoveryCookie = name => name.includes('-code-verifier') || name === 'syncflow-auth-return';
  const previous = jar.getAll().filter(({name}) => recoveryCookie(name));
  const error = await request();
  if (error) {
    for (const {name} of jar.getAll().filter(({name}) => recoveryCookie(name))) {
      jar.delete({name, path:name === 'syncflow-auth-return' ? '/auth/callback' : '/'});
    }
    for (const {name,value} of previous) {
      jar.set(name,value,{path:name === 'syncflow-auth-return' ? '/auth/callback' : '/',sameSite:'lax',secure,httpOnly:name === 'syncflow-auth-return',maxAge:3600});
    }
  }
  return error;
}
