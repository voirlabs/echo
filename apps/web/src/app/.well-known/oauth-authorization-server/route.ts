import { authServerMetadata } from "@/lib/oauth";
import { preflight, publicJson } from "@/lib/public-cors";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export const GET = () => publicJson(authServerMetadata());
