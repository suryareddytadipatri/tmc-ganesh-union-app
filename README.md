# TMC Ganesh Union — Vinayaka Chaturthi App

One app: the contribution page and the payment backend now live together
and deploy as a single unit — no separate frontend/backend URLs to manage.

```
ganesh-union-app/
├── server.js          # Express server: serves the page + handles payments
├── public/
│   ├── index.html     # the contribution page (mobile-friendly, single column)
│   └── manifest.json  # lets phones "Add to Home Screen" like a real app
├── package.json
└── .env.example
```

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Register TMC Ganesh Union on Razorpay (https://razorpay.com) using the
   individual/trust onboarding flow, completing KYC with the committee's
   bank account — that's the account contributions settle into.

3. Copy `.env.example` to `.env` and fill in your Key ID and Key Secret
   (Razorpay dashboard → Settings → API Keys).

4. In `public/index.html`, set `RAZORPAY_KEY_ID` to your **publishable**
   Key ID (safe to expose in the page — never put the Key Secret here).

5. Run it locally:
   ```
   npm run dev
   ```
   Visit `http://localhost:4001` — the same server serves the page and the
   API, so everything works from one address.

6. Deploy the whole folder to Railway, Render, or similar (they all support
   "one command, one URL" Node app deployment). Set the same env vars there.

7. Once deployed, add a webhook in the Razorpay dashboard pointing to
   `https://your-deployed-url.com/webhook/razorpay`, subscribed to
   `payment.captured`, and put its secret into your deployed env vars.

## Mobile-friendly / "installable" behavior

- The page is single-column, touch-sized inputs, and capped at a phone-width
  480px layout even on desktop browsers.
- `manifest.json` + the meta tags in `index.html` let visitors tap
  "Add to Home Screen" (Android Chrome) or "Add to Home Screen" from the
  Share sheet (iOS Safari) so it opens full-screen like a native app.
- To get a proper home-screen icon (rather than a generic browser icon),
  add PNG icons (e.g. 192×192 and 512×512) to `public/` and list them in
  `manifest.json`'s `icons` array — currently left empty since no logo
  artwork was provided.

## Endpoints (same server now)

- `GET /` — the contribution page
- `POST /donations` — creates a Razorpay order for a given amount
- `POST /webhook/razorpay` — Razorpay's payment confirmation (source of truth)
- `GET /donations/:id` — check one donation's status
- `GET /donations-summary` — running total collected + contributor count

## Still worth doing before going live

- Replace the in-memory `donations` array with a real database so records
  survive a restart.
- Add a simple protected admin view for `/donations-summary` (it's currently
  open to anyone who knows the URL).
- Add real home-screen icons as noted above.
