// Bundled into page.js, which the popup injects into the tab it acts on. It runs
// in the extension's isolated world, so the page itself can't see or call this.
import { runOnPage } from "./shared/page";

(globalThis as unknown as { echoPage: typeof runOnPage }).echoPage = runOnPage;
