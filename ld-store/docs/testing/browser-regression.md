# Browser regression

Run `npm ci`, `npx playwright install chromium`, then `npm run test:e2e`.
For a single project: `npm run test:e2e -- --project=mobile`.
Density-only viewports: `--project=tablet-1024`, `--project=laptop-1280x720`, `--project=desktop-wide`, `--project=tablet-768`.
Those extra projects only run `e2e/density.spec.ts`; they do not repeat the commerce suite.
The CI browser job installs Chromium and runs desktop, mobile, and the density viewports.
It runs on `ubuntu-24.04` with Node.js 22. Failures retain a screenshot, trace and HTML report for seven days.
Touch-target checks round the measured height: a 2.625 device pixel ratio can report 43.999px for a 44px control.
The seller fulfillment page does not render `.seller-fulfillment-gate`; that banner is for other seller routes.

The suite loads the actual application, router, Pinia stores, components and
service contracts. It exercises cross-tab session changes, late authentication
failures, OAuth validation/retry, idle expiry, login/redirect/logout, checkout response loss,
reload recovery, price changes, blocked payment popups and catalog filters with
back navigation. It mocks HTTP at the browser boundary, including OAuth and
payment: it does not verify a real payment provider or production rendering.

Safety boundaries:
- The runner rejects production markers and passes only basic OS variables to
  Playwright. Application/provider credentials and VITE overrides are excluded.
- The dedicated Vite config uses `envDir: false`, has no production proxy, binds
  only loopback and rejects any `/api` request reaching its server.
- A fresh server is required; an existing development server cannot be reused.
- Browser contexts block service workers and abort all non-test-origin traffic.
- Every API request needs an explicit fixture; unmocked endpoints fail the test.
- Do not replace these boundaries with a staging/production base URL or real
  authentication tokens.

Playwright reference: [local web server](https://playwright.dev/docs/test-webserver)
and [HTTP mocks](https://playwright.dev/docs/mock).
