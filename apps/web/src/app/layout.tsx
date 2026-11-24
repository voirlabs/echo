import { APP_NAME, APP_URL } from "@/lib/site";
import type { Metadata, Viewport } from "next";
import { Urbanist } from "next/font/google";
import { connection } from "next/server";
import "@/styles/globals.css";

// Downloaded at build time and served from this app: no requests to Google at runtime.
const urbanist = Urbanist({ subsets: ["latin"], variable: "--font-urbanist", display: "swap" });

const TAGLINE = "Emails, messages, posts and applications in your own voice, written by the AI you already use.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: TAGLINE,
  applicationName: APP_NAME,
  // The app is private and auth-gated, so keep it out of search indexes.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#080809", colorScheme: "dark" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Every page renders per request, so each gets the CSP nonce from src/proxy.ts.
  await connection();
  return (
    <html lang="en" className={urbanist.variable}>
      <body>{children}</body>
    </html>
  );
}
