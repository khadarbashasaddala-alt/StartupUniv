/**
 * Where "Start Learning" sends a learner.
 *
 * The button deliberately goes through /api/lms/start rather than linking straight out, so the
 * destination lives in one place and a logged-out user is bounced to the portal login instead of
 * the LMS. Extracted from the route so the precedence below can be tested; it used to be inline
 * and answered 500 whenever nothing was configured.
 */

/**
 * Rooman's Moodle login page. A default rather than required configuration, because none of the
 * MOODLE_* variables were ever passed to the production container — so the route answered
 * "Moodle is not configured" with a 500 on every click, and the button looked broken.
 *
 * It points at the plain login page, not the OAuth2 entry point, so it works whether or not
 * Moodle-side SSO is set up. Once it is, set MOODLE_OAUTH2_START_URL and that wins.
 */
export const DEFAULT_LMS_START_URL = "https://learn.rooman.com/login/index.php";

export interface LmsEnv {
  MOODLE_OAUTH2_START_URL?: string;
  MOODLE_BASE_URL?: string;
  /** Present so process.env satisfies this; the two names above are the ones read. */
  [key: string]: string | undefined;
}

/**
 * Precedence: an explicit start URL, then one derived from the Moodle base, then the default.
 *
 * The derived form is the OAuth2 entry point, which only works when SSO is configured on the
 * Moodle side — so it is preferred over the default only when someone has deliberately set
 * MOODLE_BASE_URL, and never inferred.
 */
export function resolveLmsStartUrl(env: LmsEnv = process.env): string {
  const explicit = (env.MOODLE_OAUTH2_START_URL ?? "").trim();
  if (explicit) return explicit;

  const base = (env.MOODLE_BASE_URL ?? "").trim();
  if (base) return `${base.replace(/\/+$/, "")}/auth/oauth2/`;

  return DEFAULT_LMS_START_URL;
}
