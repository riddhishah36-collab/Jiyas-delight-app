# Jiya's Delight

Bakery & Cloud Kitchen for Bangkok (THB). Custom cakes, bakery products, buy/sell inventory, local currency payments — all data auto-saved to GitHub.

## Structure

- `backend/` — Express API on port 3001, JSON data store at `backend/data/db.json`, auto-commits data changes to Git on every save.
- `frontend/` — Vite + React shop on port 5173, proxies `/api` to backend.
- `start.sh` — Starts both servers.

## Run

```bash
npm install --prefix backend
npm install --prefix frontend
./start.sh
```

## Admin

Staff dashboard at the "Staff" nav button. Default admin key: `jiya-admin-2024`.

## Data safety

Every order, purchase and inventory change is written to disk immediately (`db.json`) and auto-committed + pushed to GitHub within a few seconds.
