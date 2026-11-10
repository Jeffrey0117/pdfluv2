/**
 * Props for an <input> that holds a secret which is NOT a login password
 * (API keys, tokens, client secrets).
 *
 * Why not type="password": the LetMeUse login form is rendered inside this
 * site's own page, so the browser stores a login password for this origin —
 * and will autofill it into any type=password field it finds here. Chrome
 * deliberately ignores autocomplete="off" on password fields. An API-key field
 * filled that way would save the user's login password as "the key" and send
 * it as a Bearer token to whatever API URL is configured.
 *
 * A key is not a credential the browser should manage: render a plain text
 * field and mask it with CSS instead.
 *
 *   <input {...SECRET_INPUT_PROPS} className={`${inputClass} ${SECRET_INPUT_CLASS}`} ... />
 */
export const SECRET_INPUT_PROPS = {
  type: "text",
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
  // Password managers: this is not a login field.
  "data-lpignore": "true",
  "data-1p-ignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
} as const;

/** Tailwind arbitrary property: show dots instead of the characters. */
export const SECRET_INPUT_CLASS = "[-webkit-text-security:disc]";
