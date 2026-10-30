# scan4reuse

A React (Vite) web app for finding reusable building materials. Open the camera on a site, and the app
detects and counts what it sees, builds a **Reuse Report** (with CO₂ and resale estimates, exportable as a
PDF), and shows the materials in a sample **Reuse Marketplace** that can be filtered by price and Swiss canton.

## Run it

```bash
npm install
npm run dev
```

With no backend configured (`VITE_API_URL` empty) or with `VITE_USE_MOCK=true`, the app runs in **demo mode**:
the camera is real, processing is simulated, and saved scans stay in the browser. Copy `.env.example` to
`.env.local` to use your backend.

Browsers only allow camera access on HTTPS (or `localhost`). To test on a phone while developing, run
`npm run dev:phone` and open the HTTPS address it prints. Deployed to Vercel, HTTPS is automatic.

## Backend

The API lives in its own repository, [Scan4Resource-backend](https://github.com/Reazul-Islam-Fahim/Scan4Resource-backend).
Run it, then either:

- set `VITE_API_URL` to its base URL (for example `http://localhost:8000`) and add this app's origin
  (for example `http://localhost:5173`) to the backend's `ALLOWED_ORIGINS`, or
- during development, set `VITE_API_URL=/api` and `API_TARGET=http://localhost:8000` in `.env.local`. The dev
  server then forwards `/api/...` to the backend, so no CORS setup is needed.

## Accounts and dashboards (logistics branch)

Scan4Reuse is **scan → marketplace → logistics**, used by five roles: buyer, corporate buyer, seller, logistics
company and admin. Everyone logs in on the same page (`#/login`), picks their role there, and lands on that role's
dashboard (`#/dashboard`): a sidebar on wide screens, a tab bar on phones.

| Role | Dashboard pages |
| --- | --- |
| Buyer | Overview, Orders, Account |
| Corporate buyer | Overview, Tenders, Orders, Account |
| Seller | Overview, Listings (edit price and stock, publish, withdraw), Orders, Pickup & partners, Balance & payouts, Account |
| Logistics company | Sent straight to the [logistics app](https://github.com/Reazul-Islam-Fahim/Scan4Resource-logistics-frontend), already logged in |
| Admin | Overview, Verification (approve corporate buyers and logistics companies), Users (add admins), Payouts, Activity, Account |

`#/signup` creates buyer, seller, corporate buyer and logistics company accounts; the last two wait for an admin
to verify the company. One account can hold several roles (add them under Account, then switch). Admins are
created with the backend's `scripts/create_admin.py`, then by other admins. Logging in needs the backend.

Set `VITE_LOGISTICS_URL` (locally `http://localhost:5174`) so logistics companies are sent to the logistics app,
which in turn sends people here to log in (`#/login?app=logistics&next=...`) and gets the login back.

Tenders and payouts are empty pages in this step; they fill in as delivery and payments are connected.

### Marketplace

With a backend (`VITE_API_URL`) the marketplace and the map show the **published listings** and stay live: the app
listens to `/market/events`, so a new listing, a price change or a sell-out appears without a reload.

- **Sell:** on a scan report, **Sell on the marketplace** (`#/sell`) turns each item into a listing: title,
  category, material, condition, quantity and price (the catalog's price is suggested), a pickup address picked
  from geo.admin.ch suggestions, a pickup window and the logistics partners. Save as drafts or publish. Buyers see
  the town, never the street.
- **Buy:** tap a card for the details, choose the quantity and add it to the cart (kept in the browser). The cart
  (`#/cart`) asks for a Swiss delivery address and places the order, which reserves the materials. Logging in as
  a buyer or corporate buyer is asked for at that point, and the cart is kept.
- **Delivery:** after ordering, the buyer goes straight to the logistics app's checkout (`VITE_LOGISTICS_URL`) to
  pick a logistics company for each pickup. **Orders** in the buyer's dashboard shows the delivery status
  (not booked yet, booked, delivered) with **Book delivery**, **Pay** or **Delivery details**. Once every company
  has accepted, the buyer pays materials and delivery together by card (Stripe) in the logistics app. An order can
  be cancelled only until delivery is booked.
- **Money:** sellers see their balance in **Balance & payouts** (`#/dashboard/payouts`): each sale is credited when
  delivered and paid, minus the 10% commission, and they request payouts to a Swiss IBAN. Admins see what buyers
  paid, the commission and the balances owed in **Payments & payouts**, and mark payout requests paid once the bank
  transfer is made, or reject them with a note.
- **Map** (`#/map`): MapLibre with swisstopo's light base map, one point per listing (rounded to about 1 km),
  clustered until you zoom in, with the category chips, search, canton filter, list view and **near me**.
  Distances are measured from your location once you allow it, else from Zürich.

Without a backend (demo mode) the marketplace and map show sample listings and cannot be bought from.

## The flow

`Home → Camera → Processing → Detected items → Reuse Report → Marketplace` (and a Map of material sources)

| Screen | Route | What it does |
| --- | --- | --- |
| Home | `#/` | Start scanning. Tabs: Home, Scans, Reports, Profile |
| Camera | `#/scan` | **Start scanning** on Home. **Photo**: the shutter takes a photo. **Video**: the shutter starts and stops a recording. The gallery button adds photos or videos from the device, the flip button switches cameras. All of them can be mixed. **Finish** (top right, with the number of captures) uploads them. |
| Processing | `#/upload` | Uploads the captures with a progress bar, then follows the server: it builds a 3D model, then counts and measures the objects (this takes a few minutes, and the page can be left meanwhile). When it is done, the frames with the counted objects outlined are shown, and **Review items** continues. |
| Detected items | `#/items` | One row per label with its count. Tap a row to correct quantity, material, condition (doors: width and height) or remove an item. **Generate Reuse Report** saves the scan and continues. With nothing detected, sample items are shown, marked as sample data. |
| Reuse Report | `#/report` | Potential for reuse, items detected, CO₂ savings and resale value (both estimates), and the material list with values. The export icon in the top bar sends the PDF to the phone's share sheet (a download where sharing is not supported). **Downloads** has **Preview** and **Download** for the report PDF (drawn with PDF.js, so the preview also works on phones), the 3D model (`scene.glb`, turned with a finger in a three.js viewer) and the mask images (every frame with the objects outlined; `masks.zip`). The 3D model and mask images come from the server and are only there for an uploaded scan that finished processing. **Sell on the marketplace** publishes the items (see Marketplace above). |
| Reuse Marketplace | `#/market` | Published listings, live. Search, category chips, cards with a heart (kept in the browser), a cart button. The sliders button opens the filters: a **price range** and the **26 Swiss cantons**. A card opens the listing with **Add to cart**. |
| Material sources | `#/map` | The listings on a real map of Switzerland (MapLibre, swisstopo), clustered, with a details card, category chips, search, a canton filter, a list view and near me. |
| Scans | `#/scans` | Saved scans. **Open report** reloads one into the report; a scan can be deleted. |

Reports and Profile are placeholders in this version. A scan in progress survives an accidental reload.

### Sample data

If a scan detects nothing, the detected-items page, the report, the PDF and the marketplace show sample data
(the six materials of the design) and say so on screen and in the PDF ("SAMPLE DATA"). Sample data is never
saved.

### Estimates

**CO₂ savings** are the emissions of making new replacements, which reuse avoids, calculated per item from its
kind, measured size and material with the production factors of the Swiss KBOB list (Ökobilanzdaten im Baubereich
2009/1:2014). Doors and windows use KBOB's per-m² elements (a window frame is taken as 30% of the window); other
objects use a typical weight, scaled by the scanned size, times the KBOB factor of their material.

**Resale value** is a typical new price times the share a reused item fetches in its condition (good 40%, fair 25%,
poor 10%, not set 30%). The new prices are rough averages, not market data. All factors are in
`src/lib/impact.js`. The prices suggested when selling come from `src/lib/materials.js`.

## Photos

Materials without a camera photo (sample data, sample listings) use flat illustrations. To use real photos,
put JPEGs in `public/samples/` named after the category: `bricks`, `concrete`, `wood`, `windows`, `doors`,
`tiles`, `stone`, `steel` (for example `public/samples/bricks.jpg`), and `hero.jpg` for the home screen. They are
picked up automatically. Real scans always show the camera crop.

## Backend contract

Field names may also be camelCase; they are normalised in `src/lib/api.js`, the only file to change if your API
differs.

### Detected items

Items come from the processing job's `objects` (below). Field rules:

- `label` is matched to `bricks`, `concrete_beams`, `wooden_beams`, `window_frames`, `doors`, `floor_tiles` or
  `stone_slabs` (singular forms and spaces are accepted, and `glass door` counts as a door). Any other label is kept
  and shown as it is.
- `quantity` defaults to 1. `unit` is `pc` or `m2` (floor tiles and stone slabs are areas).

The backend's live `POST /detect` endpoint is no longer used by the app.

### `POST /reconstructions` and `GET /reconstructions/{id}`

Upload: `multipart/form-data` with every file as `files` and `scan_id`. The answer (202) is the job; the app then
asks for `GET /reconstructions/{id}` every 3 seconds until `status` is `done` or `failed`, and shows `stage`
(`picking frames`, `building 3D model`, `finding objects (frame 3 of 12)`) as progress. When it is done, `objects`
are added to the scan like detections (each with `width_cm`, `height_cm`, `depth_cm`, `material`, `partial`), and
`files.mask_frames` (paths on the API) are shown. `partial: true` means the object was only partly seen, so its
size is a lower bound: the item is marked "size uncertain" until the person types a measurement.

### `POST /scans`

Called when the report is generated. JSON body:

```json
{
  "id": "uuid",
  "site": "Scan 20 Sep 2026, 10:04",
  "started_at": "2026-09-20T10:02:11.000Z",
  "finished_at": "2026-09-20T10:14:40.000Z",
  "objects": [
    { "id": "brick-2", "label": "bricks", "quantity": 40, "unit": "pc", "width_cm": null, "height_cm": null,
      "material": "clay", "condition": "good", "confidence": 0.88, "image": "data:image/jpeg;base64,..." }
  ],
  "doors": [ { "id": "door-3", "label": "doors", "width_cm": 91.2, "height_cm": 203.8, "material": "wood" } ]
}
```

`objects` holds every item; `doors` repeats the doors in the older shape so an existing backend keeps storing them.
`condition` is `good`, `fair`, `poor` or `null`. Saving the same `id` again replaces the earlier save.

### `GET /scans` and `DELETE /scans/{id}`

`GET` returns saved scans, newest first, as an array or `{ "scans": [...] }`, each in the shape above plus
`created_at`. `DELETE` returns `204`, or `404` if the scan does not exist. Errors of the form `{ "detail": "..." }`
are shown to the person. The backend must allow CORS from your Vercel domain (its `ALLOWED_ORIGINS` setting).

## Deploy to Vercel

1. Import this repository in Vercel. The Vite preset is detected automatically.
2. Add the environment variable `VITE_API_URL` (your backend's base URL, no trailing slash).
3. Deploy. Variables prefixed `VITE_` are baked in at build time, so redeploy after changing them.

The app uses hash routes (`#/report`), so no rewrite rules are needed.

## Where things are

| Path | What it does |
| --- | --- |
| `src/App.jsx` | Session state, save, and the routes |
| `src/components/Scanner.jsx` | Camera: Photo/Video, shutter, recording, gallery, flip, Finish |
| `src/components/Upload.jsx`, `src/hooks/useJobPoll.js` | Upload the captures and follow their processing on the server |
| `src/components/DetectedItems.jsx`, `ItemSheet.jsx` | Label-and-count list and the editor for one label |
| `src/components/Report.jsx` | Reuse Report, PDF export and the downloads (PDF, 3D model, mask images) |
| `src/components/Viewer.jsx`, `PdfPreview.jsx`, `ModelPreview.jsx`, `MaskPreview.jsx` | Full-screen previews with Download; PDF.js and three.js load only when a preview opens |
| `src/components/Market.jsx`, `market/` | Marketplace, cards, filter sheet, listing sheet, the MapLibre map |
| `src/components/MapScreen.jsx` | Listings on the map |
| `src/components/sell/`, `Cart.jsx`, `AddressField.jsx` | Publishing a report's items, the cart and order, Swiss address search |
| `src/hooks/useListings.js`, `useCart.jsx`, `src/lib/marketApi.js`, `geo.js` | Live listings (server-sent events), the cart, marketplace calls, geo.admin.ch and location |
| `src/components/Scans.jsx` | Saved scans |
| `src/lib/materials.js` | Material catalog: names, units, suggested listing prices |
| `src/lib/impact.js` | CO₂ savings and resale value per item (KBOB factors, condition) |
| `src/lib/items.js` | Grouping items by label; report totals; sample report |
| `src/lib/market.js`, `swiss.js` | Filters, demo-mode sample listings, cantons and cities |
| `src/lib/pdf.js` | The PDF (`jspdf`, loaded only on export) |
| `src/lib/api.js`, `mock.js`, `session.js` | Network calls, demo mode, merging detections |
| `src/lib/auth.js`, `src/hooks/useAuth.jsx` | Login, sign-up, roles, the stored token, admin calls |
| `src/components/auth/` | The shared login page with the role picker, and sign-up |
| `src/components/dashboard/` | The dashboard frame and each role's pages (`roles.jsx` lists them) |
