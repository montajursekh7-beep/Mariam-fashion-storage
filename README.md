# MARIAM SHEIKH FASHION STORE

A mobile-first clothing ecommerce starter with a customer storefront, session-based customer accounts, cart, checkout, order history, return requests and a protected admin dashboard.

## Requirements
- Node.js 18+
- npm

## Run locally
1. Extract the ZIP.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env`.
5. Change `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
6. Run `npm start`.
7. Open `http://localhost:3000`.

The server creates JSON data files in `data/` automatically. This is suitable for a starter/demo deployment, not high-volume production. For production, replace JSON storage with MongoDB Atlas, use persistent file storage/object storage for uploads, configure HTTPS and secure session storage, and use a transactional payment provider.

## Admin
Open `/admin.html` and sign in using the credentials configured in `.env`.

## Important production notes
- Payment is intentionally NOT marked successful by this starter. COD is available; online payment requires a real payment gateway account and server-side verification.
- OTP/Google login, live courier tracking, WhatsApp notifications and automated refunds require provider credentials and integration.
- Admin credentials must be changed before deployment.
- Render free instances may not provide persistent local storage. Use a persistent disk or managed database/storage.
- Add your own logo, product photos, shipping charges, tax rules and return policy before launch.
