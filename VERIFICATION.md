# Wizzards choreography revision

Implemented locally on 2026-11-09. Not pushed or deployed.

## Source comparison

Retrieved actual public source from https://tattoowebsite-xi.vercel.app/. Its inline script 3 contains the third-order motion controller; script 4 contains input routing; script 5 hides the panel during camera travel and reveals it at the destination. The reference browser showed its WebGL fallback, so actual reference GPU animation could not be visually assessed.

The barber implementation reuses the reference motion controller, adapted to the existing head/clipper path. It preserves the barber's native document scroll, rather than adopting reference nested panel input. Each chapter has a travel runway before document scroll advances its reading content. Camera movement stops at the chapter pose during reading. Panels are substantially taller: desktop top 104px to bottom 88px; mobile portrait top 155px to bottom 79px plus safe area. Business data, links and models are unchanged.

## Passed

- npm run build
- npm run check: 44 local references, six GLB headers, five barbers, attribution, root route and Vercel config.
- node tests/motion-route.mjs: interrupted motion retains position/velocity/acceleration; exact destination settlement; native routes at 390, 844 and 1000px stage heights; travel precedes reading; all panel content is reachable.

## Not verified

Visual/browser and physical-phone QA remains outstanding. Local Chromium could not start because its process-singleton socket was prohibited, including an approved elevated attempt. Cloud browser could not connect to the executor's localhost. tests/browser_qa.py contains the intended desktop/mobile/landscape interaction tests, but these have not run successfully. Test GPU rendering, visual framing, native scrolling, quick navigation, Back/Forward, gallery tabs/dialogs and reduced motion before publication.

## Integration

This directory is isolated from github-handoff/atelier1674. No earlier push files were changed. Merge src/app.js, src/layout.js, src/layout.css, src/native-mobile-scroll.js and new src/reference-motion.js. The reference-input.js file is retained only for comparison, not imported. Tests and this report accompany the change. Keep the existing public assets and deployment configuration.
