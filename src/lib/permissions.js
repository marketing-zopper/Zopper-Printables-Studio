// Mirror of the server's role matrix (api/_lib/access.js), used only to decide
// what to show. The server re-checks every action, so this is never the gate.
export const ROLE_LABELS = {
  viewer: 'Viewer',
  editor: 'Editor',
  admin: 'Admin',
  super_admin: 'Super Admin',
}

export const DENIED_MESSAGES = {
  not_registered: 'Your account has not been set up for Zopper Marketing Studio yet.',
  inactive: 'Your employee account is inactive.',
  no_access: 'You have not been given access to Printables Studio.',
  domain_not_allowed: 'Only verified @zopper.com accounts can use Printables Studio.',
  super_admin_requires_google: 'This account must sign in with Google.',
}
