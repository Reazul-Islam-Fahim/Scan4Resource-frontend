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

## The flow

`Home → Camera → Processing → Detected items → Reuse Report → Marketplace` (and a Map of material sources)

| Screen | Route | What it does |
| --- | --- | --- |
| Home | `#/` | Start scanning. Tabs: Home, Scans, Reports, Profile |
| Camera | `#/scan` | **Start scanning** on Home. **Photo**: the shutter takes a photo. **Video**: the shutter starts and stops a recording. The gallery button adds photos or videos from the device, the flip button switches cameras. All of them can be mixed. **Finish** (top right, with the number of captures) uploads them. |
| Processing | `#/upload` | Uploads the captures with a progress bar, then follows the server while it counts and measures the objects (this takes a few minutes, and the page can be left meanwhile). When it is done, the frames with the counted objects outlined are shown, and **Review items** continues. |
| Detected items | `#/items` | One row per label with its count. Tap a row to correct quantity, material, condition (doors: width and height) or remove an item. **Generate Reuse Report** saves the scan and continues. With nothing detected, sample items are shown, marked as sample data. |
| Reuse Report | `#/report` | Potential for reuse, items detected, CO₂ savings and resale value (both estimates), and the material list with values. **Downloads**: **Report** (and the document icon in the header) opens a preview of the PDF, drawn with PDF.js so it also works on phones, with a **Download PDF** button. **Mask images** (`masks.zip`) comes from the server and is only there for an uploaded scan that finished processing. **Find buyers / next steps** opens the marketplace. |
| Reuse Marketplace | `#/market` | Search, category chips, 2-column cards with a heart (kept in the browser). The sliders button opens the filters: a **price range** and the **26 Swiss cantons**. Scanned materials come first. |
| Material sources | `#/map` | A map of Switzerland with clustered sources (tap a cluster to zoom in), a details card, type chips, search, a canton filter and a list view. |
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
`src/lib/impact.js`. Marketplace listing prices come from `src/lib/materials.js` and are samples. Marketplace
distances are measured from Zürich.

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
(`picking frames`, `measuring`, `finding objects (frame 3 of 12)`) as progress. When it is done, `objects`
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
| `src/components/PdfPreview.jsx` | Full-screen PDF preview (PDF.js, loaded on demand) with Download |
| `src/components/Report.jsx` | Reuse Report and its downloads (PDF, mask images) |
| `src/components/Market.jsx`, `market/` | Marketplace, cards, filter sheet |
| `src/components/MapScreen.jsx` | Map of material sources |
| `src/components/Scans.jsx` | Saved scans |
| `src/lib/materials.js` | Material catalog: names, units, sample listing prices |
| `src/lib/impact.js` | CO₂ savings and resale value per item (KBOB factors, condition) |
| `src/lib/items.js` | Grouping items by label; report totals; sample report |
| `src/lib/market.js`, `sites.js`, `swiss.js` | Sample listings and sources, cantons and cities, filters |
| `src/lib/pdf.js` | The PDF (`jspdf`, loaded only on export) |
| `src/lib/swissMap.js` | Generated map paths (swisstopo, via the `swiss-maps` package) |
| `src/lib/api.js`, `mock.js`, `session.js` | Network calls, demo mode, merging detections |
