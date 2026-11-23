# SalesPulse — Sales Analytics Dashboard

SalesPulse connects a React and Recharts dashboard to an Express API backed by SQLite. It starts with 520 fictional sales orders and accepts new orders via CSV. The seed covers 2025–2026 and displays sales in Indian rupees.

## Features

- Revenue, order count, average order value and unique customers
- Revenue by month, product category and region
- Region, category and date filters shared by KPIs, charts, transactions and export
- Search and pagination within the transaction table
- CSV export, authenticated import, and manual data refresh
- Loading states, actionable errors and responsive dashboard sections

## Run locally

Use Node.js 22.13 or newer. From this folder:

```sh
npm ci
npm run dev
```

Open the URL Vite prints. To enable import, create a local `.env` file and set `SALESPULSE_IMPORT_TOKEN` to a private value of your choosing, then restart the server. Enter that key in the import form. Never commit the key or put it in a variable prefixed with `VITE_`.

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `SALESPULSE_IMPORT_TOKEN` | Unset | Shared key for CSV imports. Imports are disabled when unset. |
| `SALESPULSE_DB` | `.salespulse/orders.sqlite` | Writable SQLite file. Use a persistent disk for production. |
| `PORT` | `3000` | HTTP port for the production server. |

## Demo a data update

1. Open SalesPulse and note the initial order count of 520.
2. Save the following text as a CSV and use **Import orders from CSV**. Use a new order ID for each repeat demo.
3. Confirm **Total Orders** increases by one, **Total Revenue** increases by ₹1,250, and the new order appears in **Transactions**. Reset active filters if they exclude the new order.
4. Import the same file again to demonstrate duplicate handling. Restart the server to verify persistence.

```csv
Order ID,Order Date,Customer ID,Product Category,Region,Sales Amount
CAPSTONE-001,2026-12-01,CUST-CAPSTONE,Electronics,South,1250.00
```

## Tests and deployment

```sh
npm test
npm run build
npm start
```

For deployment, use a Node.js host with a persistent volume, use `npm ci && npm run build` as the build command, and use `npm start` to serve the built frontend and same-origin API. Set `SALESPULSE_DB` to a file on the mounted volume and configure the import token through the host if needed. A static-only deployment cannot run this application's server. Use HTTPS on any hosted instance with CSV import enabled. The read endpoints are public and intended for demo data.

See [API documentation](API.md) for paths, request formats and errors.
