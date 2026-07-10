# Admin Module (additive)

New admin-only API mounted at `/api/v1/admin`. It reuses the existing Firebase
auth (`middleware/auth.js`) and only adds an admin-role guard. No existing
backend, auth, or routes were modified except one additive line in
`src/routes/index.js`:

```js
router.use('/admin', require('../admin'));
```

## Endpoints (all require admin role)

- `GET  /admin/dashboard`
- `GET  /admin/products` `?page&limit&search&category&status&dealer`
- `GET  /admin/products/:id`
- `PATCH /admin/products/:id/archive`
- `DELETE /admin/products/:id`
- `GET  /admin/customers` · `GET /admin/customers/:id`
- `GET  /admin/leads` · `GET /admin/leads/analytics`
- `GET  /admin/loans` · `GET /admin/loans/analytics`
- `GET  /admin/dealers` · `GET /admin/dealers/:id`
- `GET  /admin/analytics/inventory|leads|revenue|aging`
- `GET  /admin/notifications` · `POST /admin/notifications`

The only new model is `src/models/Notification.js`.
