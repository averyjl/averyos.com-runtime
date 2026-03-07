/**
 * Shared vault authentication cookie configuration.
 *
 * Kept in a dedicated lib module so it can be imported by both the auth route
 * and downstream API routes without triggering Next.js App Router's strict
 * constraint that route files must not export non-handler values.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

/** HttpOnly Secure cookie name used for vault authentication. */
export const VAULT_COOKIE_NAME = "aos-vault-auth";
