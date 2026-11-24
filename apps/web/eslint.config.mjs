import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  { ignores: [".next/**", "next-env.d.ts"] },
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The export links download files from route handlers, which need a plain <a>.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];

export default config;
