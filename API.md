# Dealer Platform — API Reference

Base URL: `http://<host>:5000/api`

All responses follow:

```json
{ "success": true, "message": "string", "data": { } }
```

Errors:

```json
{ "success": false, "message": "string", "errors": null }
```

Authenticated endpoints require the header:

```
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

`(F)` = Firebase token only, `(A)` = authenticated user, `(C)` = customer role,
`(D)` = dealer role, `(P)` = public, `(O)` = optional auth.

---

## Health

| Method | Path           | Notes |
|--------|----------------|-------|
| GET    | `/`            | Root health check |
| GET    | `/api/health`  | Health check with timestamp |

## Auth — `/api/auth`

| Method | Path                  | Access | Body |
|--------|-----------------------|--------|------|
| POST   | `/register/customer`  | (F)    | `{ fullName, email }` |
| POST   | `/register/dealer`    | (F)    | `{ companyName, ownerName, email, phone, address, whatsapp?, dealerTypes? }` |
| GET    | `/me`                 | (A)    | — returns `{ user, dealer? }` |
| POST   | `/fcm-token`          | (A)    | `{ token }` |
| DELETE | `/fcm-token`          | (A)    | `{ token }` |

## Products — `/api/products`

| Method | Path             | Access | Notes |
|--------|------------------|--------|-------|
| GET    | `/`              | (P)    | Query: `page, limit, category, status, q, minPrice, maxPrice, featured, dealer, sort` (`price_asc\|price_desc\|popular`) |
| GET    | `/featured`      | (P)    | Featured available products |
| GET    | `/:id`           | (O)    | Increments views; returns `isFavorite` when authed |
| POST   | `/`              | (D)    | Create product |
| PUT    | `/:id`           | (D)    | Update product (notifies favoriters) |
| PATCH  | `/:id/status`    | (D)    | `{ status: available\|reserved\|sold }` (notifies on sold) |
| DELETE | `/:id`           | (D)    | Delete product |

Product create/update body:

```json
{
  "category": "cars",
  "title": "Toyota Corolla 2021",
  "description": "Single owner...",
  "price": 18500,
  "location": "Downtown",
  "featured": false,
  "coverImage": "https://...",
  "galleryImages": ["https://...", "https://..."],
  "videoUrl": "https://...",
  "dynamicFields": { "brand": "Toyota", "model": "Corolla", "year": "2021" }
}
```

## Customers — `/api/customers` (C)

| Method | Path                         | Notes |
|--------|------------------------------|-------|
| PUT    | `/profile`                   | `{ fullName?, phone?, photoUrl? }` |
| GET    | `/favorites`                 | Paginated favorite products |
| POST   | `/favorites/:productId`      | Add favorite |
| DELETE | `/favorites/:productId`      | Remove favorite |

## Dealers — `/api/dealers`

| Method | Path           | Access | Notes |
|--------|----------------|--------|-------|
| GET    | `/dashboard`   | (D)    | Stats + recent leads |
| GET    | `/products`    | (D)    | Dealer's own products (`status`, `category` filters) |
| PUT    | `/profile`     | (D)    | Update dealer profile |
| GET    | `/:id`         | (P)    | Public dealer profile |

## Leads — `/api/leads`

| Method | Path            | Access | Notes |
|--------|-----------------|--------|-------|
| POST   | `/`             | (C)    | `{ productId, source: inquiry\|call\|whatsapp, message? }` (notifies dealer) |
| GET    | `/mine`         | (C)    | Customer's own leads |
| GET    | `/`             | (D)    | Dealer's leads (`status` filter) |
| PATCH  | `/:id/status`   | (D)    | `{ status: new\|contacted\|interested\|negotiation\|closed\|lost }` |

## Notifications — `/api/notifications` (A)

| Method | Path            | Notes |
|--------|-----------------|-------|
| GET    | `/`             | List + unread count |
| PATCH  | `/read-all`     | Mark all read |
| PATCH  | `/:id/read`     | Mark one read |

## Uploads — `/api/uploads` (A, multipart/form-data)

| Method | Path        | Field      | Returns |
|--------|-------------|------------|---------|
| POST   | `/image`    | `file`     | `{ url, publicId }` |
| POST   | `/images`   | `files[]`  | `{ images, urls }` |
| POST   | `/video`    | `file`     | `{ url, publicId }` |
