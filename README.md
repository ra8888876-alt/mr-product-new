# MR PRODUCT — updated starter

Responsive black-and-gold storefront with a cart and one combined delivery/order form.

## Files
- `index.html`, `styles.css`, `app.js`: storefront.
- `config.example.js`: browser-safe Supabase URL + publishable key template.
- `supabase/migrations/202611030001_mr_product.sql`: starter database schema and sample catalogue.
- `supabase/functions/place-order/index.ts`: server-side order endpoint. It calculates prices from database records; the browser cannot choose its own price.

## Important setup before accepting real orders
1. Run the SQL migration in Supabase SQL Editor.
2. Copy `config.example.js` to `config.js`, then fill in the Project URL and Publishable key. Never use a Secret/service-role key in the browser.
3. Deploy the `place-order` Edge Function using the Supabase CLI or Dashboard. Set its server-side secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the function environment only.
4. Ensure the function is deployed and test using a non-live test product/order before public launch.
5. Add admin authentication and protected admin endpoints before exposing order/customer records to staff. No public admin panel is included yet.

The starter does NOT yet include admin dashboard, payment verification, COD, courier integrations, stock decrement/transaction locking, rate limiting, CAPTCHA, automatic repeat-order discounts, affiliate tools, or logo upload/storage. Do not claim these features are live. The order endpoint currently accepts bKash/Nagad/bank as selected payment labels only; it does not verify payment.
