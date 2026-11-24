import type { NextConfig } from "next";

// The Content-Security-Policy is set per request in src/proxy.ts, with a nonce.
// HSTS covers this host only: no includeSubDomains or preload, which would bind
// every other site on the domain to HTTPS too.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const config: NextConfig = {
  // Don't write an AGENTS.md into the app on dev; CLAUDE.md at the root covers it.
  agentRules: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default config;
