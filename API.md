# SalesPulse API

All routes are same-origin under `/api` and send `Cache-Control: no-store`.

| Method and path | Authentication | Success |
| --- | --- | --- |
| GET /api/health | None | 200 with `{"status":"ok"}` |
| GET /api/orders | None | 200 with an `orders` array and ISO UTC `loadedAt` timestamp |
| POST /api/orders/import | `Authorization: Bearer <import key>` | 200 with counts such as `{"imported":1,"skipped":0}` |

Each order has `id`, `date` (YYYY-MM-DD), `customer`, `category`, `region`, and `amount` (number in INR). Orders are sorted by date descending and then order ID ascending. The frontend uses one snapshot for filters, charts, metrics, table and export.

Send imports as a raw `text/csv` request body up to 1 MiB with the exact headers shown in the README. Quoted fields are supported. Dates must be valid calendar dates and sales amounts must be nonnegative with up to two decimal places. The server validates the whole file before saving a transaction. Existing or repeated order IDs are skipped.

Error bodies use `{"message":"..."}`.

| Status | Meaning |
| --- | --- |
| 400 | Missing or invalid CSV fields or rows |
| 401 | Missing or incorrect import key |
| 404 | Unknown API route |
| 413 | CSV exceeds 1 MiB |
| 415 | Request content type is not `text/csv` |
| 500 | Unexpected server or database error |
| 503 | Import is disabled because no key is configured |
