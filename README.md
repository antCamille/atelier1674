# L’Atelier 1674

Source for the approved revision-6 interactive website, ready for Vercel deployment from this repository. The application code, visual design, desktop/mobile models and business assets are unchanged. The build now opens the website at `/`, without the old preview-link token or any dependency on its former host.

## Run locally

Install Node.js 22 or newer, then run these commands inside this folder:

```sh
npm ci
npm run build
npm run check
npm run preview
```

Open `http://127.0.0.1:5173/`. Do not open the HTML directly with `file://`; ES modules and model loading require a web server. Python and environment variables are not needed.

## Deploy through GitHub and Vercel

1. Use this repository, or copy its contents to another GitHub repository. Keep `package.json`, `package-lock.json`, `vercel.json`, `src/`, `scripts/` and `public/` at the repository root.
2. In Vercel, choose **Add New → Project**, import that GitHub repository, and select **Other** if asked for a framework.
3. Leave Root Directory at the repository root. The included `vercel.json` sets Install Command to `npm ci`, Build Command to `npm run build`, and Output Directory to `dist`.
4. Choose Node.js 22 or newer if asked. No environment variables are required. Click **Deploy**.
5. Open the returned Vercel URL at its root. Optionally add your domain in the project's domain settings when you are ready.

If you place this entire folder inside a larger repository, set Vercel's Root Directory to that folder instead. Do not upload `node_modules/` or `dist/`; Vercel installs dependencies and builds the site. Publishing source to GitHub does not by itself configure a Vercel project; import the repository in Vercel as described above.

## Behavior and content

- Five barber profiles, 14 portfolio photos, 12 original YouTube links, team image and logos.
- Scroll-driven 3D head and clipper, mobile-specific assets, native mobile document scrolling, gallery filters, photo viewer, navigation and reduced-motion support.
- Reservations open Squire. Rental and training links open the existing L’Atelier website's forms. This package does not include a backend or process form submissions/payments.
- All model/image assets are local. Outgoing booking, map, video and business links retain their original destinations.
- A still image and recovery controls remain available when WebGL or asset loading fails.

## Visibility and search indexing

This standalone build has **no sign-in, password or secret preview path**. Anyone who can access your deployment can view it, unless you configure Vercel access protection. The existing `noindex`, `nofollow`, `noarchive` and no-referrer settings are retained to keep this concept out of search results; they are not access control.

For an intended search-indexed launch, update the robots meta tag in `src/template.html`, the robots.txt text in `scripts/build.mjs`, and the `X-Robots-Tag` header in `vercel.json` together. Review concept labels, business details, link destinations and media permissions before replacing the business's live website.

## Files to edit

- `src/template.html` and `src/layout.css`: page structure and styling.
- `src/business-content.js` and `src/business-data.js`: copy, contact links, team and gallery.
- `src/layout.js` and `src/native-mobile-scroll.js`: navigation and scrolling.
- `src/app.js` and the other scene modules: 3D behavior and materials.
- `public/assets/`: images and desktop/mobile GLB models.
- `scripts/build.mjs`: portable static build using esbuild; emits `dist/`.

## Verification and limitations

See `VERIFICATION.md` for checks run on this export. Physical-phone Safari behavior, actual GPU shader compilation and frame rates still require device testing. The included `npm run check` is a packaging/content check, not a full browser test suite. The archived source excludes the former repository history, old test fixtures and hosting metadata.

## Credits

Hair Clipper by **ADopustim (Artem D.)**, [Cad Crowd source](https://www.cadcrowd.com/3d-models/hair-clipper), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The model was converted and simplified; materials, animated blade and reversible hair deformation were adapted. Preserve the visible in-page attribution and `THIRD_PARTY_NOTICES.md` when redistributing.

Three.js is MIT-licensed; its license is included in `public/THREE-LICENSE.txt` and copied into the deployed site. The business's logo, portraits and media remain subject to their owners' rights. Their inclusion is not a new license grant.
