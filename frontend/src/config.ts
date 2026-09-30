// Self sign-up is temporarily closed. Build with VITE_REGISTRATION_ENABLED=true
// (and set REGISTRATION_ENABLED=true in the API) to reopen it. Read on every
// call so tests can flip it with vi.stubEnv.
export function isRegistrationEnabled(): boolean {
  return import.meta.env.VITE_REGISTRATION_ENABLED === 'true';
}
