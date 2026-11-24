/**
 * The product name, repo and deployment-specific values. Deployment values come
 * from public env vars so they work in server and client components. Everything
 * except APP_URL is optional: when a value is unset, whatever would use it is
 * not shown. See .env.example.
 */
export const APP_NAME = "Echo";
export const REPO_URL = "https://github.com/voirlabs/echo";

const clean = (v: string | undefined): string | null => {
  const s = v?.trim().replace(/\/+$/, "");
  return s ? s : null;
};

/** This app's public origin, e.g. https://echo.example.com. */
export const APP_URL = clean(process.env.NEXT_PUBLIC_APP_URL) ?? "http://localhost:3000";

/** The instance's terms and privacy policy, linked from the footer. */
export const TERMS_URL = clean(process.env.NEXT_PUBLIC_TERMS_URL);
export const PRIVACY_URL = clean(process.env.NEXT_PUBLIC_PRIVACY_URL);

/** Where users can write to the people running this instance. */
export const SUPPORT_EMAIL = clean(process.env.NEXT_PUBLIC_SUPPORT_EMAIL);

/** Who runs this instance, e.g. "Example Studio LLC". Shown in the footer. */
export const OPERATOR_NAME = clean(process.env.NEXT_PUBLIC_OPERATOR_NAME);

/** The browser extension's store listing. */
export const EXTENSION_URL = clean(process.env.NEXT_PUBLIC_EXTENSION_URL);
