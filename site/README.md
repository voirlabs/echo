# Landing page

The static site for https://echo.voirlabs.io, styled to match voirlabs.io. There's no build step and no dependencies.

- Preview: open `index.html` in a browser, or run `firebase serve --only hosting` from this folder.
- Deploy: it's served by Firebase Hosting as site `echo-voirlabs` in the Voir Labs open-source Firebase project `open-source-65128` (`firebase.json`, `.firebaserc`). Pushes to `main` that touch `site/` deploy it through `.github/workflows/site.yml`. To deploy by hand, run `firebase deploy --only hosting` from this folder.
- SEO files: `robots.txt`, `sitemap.xml` and `llms.txt` sit next to `index.html`, which carries the title, description, Open Graph and Twitter tags and the JSON-LD graph. `og.png` (1200×630) is rendered with headless Chrome from a page kept outside this folder.
- Shared styles: `styles.css` is shared with the other Voir Labs open-source projects, so keep changes generic. Page-specific CSS goes in the `<style>` block of `index.html`.

`assets/logo.svg` (the Echo mark, also `favicon.svg`, `favicon-32.png` and `apple-touch-icon.png`), `assets/voir-mark.svg` and the hero art `assets/hero.webp` are Voir Labs brand assets. They are not covered by this repository's MIT license and may not be reused outside this project.
