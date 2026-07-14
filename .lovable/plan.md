
## What we're building

A safe sign-in flow, a role-based profile (Farmer / Seller / Buyer) with location, and an in-app marketplace where farmers and sellers post listings and negotiate offers — all filtered by location so advice and listings stay local.

## User flow

1. **Auth screen** — Email + password OR Phone + password. Google sign-in as a fast option. Password strength + leaked-password check enabled.
2. **Profile setup wizard** (first sign-in only):
   - Step 1: Pick role — Farmer, Seller, or Buyer
   - Step 2: Location — "Use my GPS" button + manual province/town fallback. Stored as lat/lng + region label.
   - Step 3: Role-specific details
     - Farmer: crops grown, farm size (ha), livestock
     - Seller: business name, product categories, delivery radius (default 80 km)
     - Buyer: interests (what they want to buy)
   - Step 4: Done → land on the orb home with location-aware greeting.
3. **Marketplace tab** (new orbital button):
   - Browse listings within 80 km (slider 10–200 km)
   - Filter by category (produce, livestock, inputs, equipment)
   - Each listing shows seller, distance, price, photo
   - "Make offer" opens an in-app negotiation thread
   - Seller dashboard: my listings + incoming offers (accept / counter / decline)
4. **Abuti advice** automatically uses the saved profile + location so every tip is local (weather, market prices, biosecurity already wired — we just feed them the profile coordinates instead of asking each time).

## Backend (Lovable Cloud)

New tables, all with RLS:

- `profiles` — id (= auth.uid), role, display_name, phone, province, town, lat, lng, language, created_at
- `farmer_details` — user_id, crops[], farm_size_ha, livestock[], notes
- `seller_details` — user_id, business_name, categories[], delivery_radius_km, description
- `listings` — id, seller_id, title, description, category, price, unit, quantity, photo_url, lat, lng, status (active/sold/paused)
- `offers` — id, listing_id, buyer_id, seller_id, amount, message, status (pending/accepted/countered/declined), parent_offer_id (for counters)
- `messages` — id, offer_id, sender_id, body, created_at (negotiation thread)
- Storage bucket `listing-photos` (public read, auth write)

Helper SQL function `distance_km(lat1,lng1,lat2,lng2)` for radius filtering. Trigger auto-creates the `profiles` row on signup.

## Frontend

- `src/pages/Auth.tsx` — tabs: Email / Phone, plus Google button
- `src/pages/ProfileSetup.tsx` — 4-step wizard, GPS request, role-specific forms
- `src/pages/Marketplace.tsx` — listings grid, filters, distance pill
- `src/pages/Listing.tsx` — detail + make-offer panel
- `src/pages/SellerDashboard.tsx` — my listings + offers inbox
- `src/components/OfferThread.tsx` — counter / accept / message thread
- Route guard in `App.tsx`: unauthenticated → `/auth`; authed-without-profile → `/setup`; otherwise normal.
- New "Marketplace" orbital button on the home orb.

## Security

- RLS: users read/write only their own profile and details; listings public-read when `status='active'`; offers visible only to the buyer + seller involved; messages visible only to the two parties on the offer.
- Roles stored in a separate `user_roles` table (not on profiles) to prevent privilege escalation, using the standard `has_role()` security-definer function.
- HIBP leaked-password check enabled, email+Google providers enabled, no anonymous signups, no auto-confirm.
- All inputs validated with zod (length caps, sane numeric ranges, image size limit).

## What ships in this round

Everything above except payments/checkout (out of scope per your choice) and SMS notifications on new offers (can add after).
