# Dealer Platform — Backend (Node.js + Express)

Multi-tenant dealer platform API. Stack: Express, MongoDB Atlas (Mongoose),
Firebase Admin SDK (token verification + FCM), Cloudinary (media storage).

## Folder structure

```
server/
├── src/
│   ├── config/            database.js, firebase.js, cloudinary.js
│   ├── controllers/       auth, customer, dealer, product, lead, notification, upload
│   ├── middleware/        authMiddleware.js, errorMiddleware.js, upload.js
│   ├── models/            User, Dealer, Product, Lead, Favorite, Notification
│   ├── routes/            *Routes.js + index.js
│   ├── services/          firebaseService, cloudinaryService, notificationService
│   ├── utils/             responseHandler.js, validators.js
│   └── server.js          app entry
├── .env.example
├── package.json
├── Procfile
└── render.yaml
```

## Prerequisites

- Node.js >= 18
- MongoDB Atlas cluster
- Firebase project with a service account JSON
- Cloudinary account

## Installation

```bash
cd server
cp .env.example .env      # fill in the values
npm install
npm run dev               # development (nodemon)
npm start                 # production
```

## Environment variables

| Variable                    | Description                                            |
|-----------------------------|--------------------------------------------------------|
| `PORT`                      | Server port (default 5000)                             |
| `NODE_ENV`                  | `development` or `production`                          |
| `CLIENT_URL`                | Allowed CORS origin(s), comma separated, or `*`        |
| `MONGODB_URI`               | MongoDB Atlas connection string                        |
| `FIREBASE_SERVICE_ACCOUNT`  | Full service account JSON as a single-line string      |
| `CLOUDINARY_CLOUD_NAME`     | Cloudinary cloud name                                  |
| `CLOUDINARY_API_KEY`        | Cloudinary API key                                     |
| `CLOUDINARY_API_SECRET`     | Cloudinary API secret                                  |

### Getting the Firebase service account

Firebase Console → Project Settings → Service Accounts → Generate new private key.
Copy the JSON contents into `FIREBASE_SERVICE_ACCOUNT` as a single line (the
`firebase.js` config automatically restores newlines in the private key).

## Authentication model

The mobile app authenticates the user with Firebase (email/password), obtains a
Firebase ID token, and sends it as `Authorization: Bearer <token>` on every
request. The backend verifies the token with the Firebase Admin SDK and loads
the matching MongoDB user. Roles: `customer` and `dealer`.

## Deployment (Render example)

1. Push the `server/` folder to a Git repository.
2. Create a new Web Service on Render, pointing at the repo.
3. Build command: `npm install`, start command: `npm start`.
4. Add the environment variables listed above.
5. The stable URL serves the API; use it as the Flutter `API_BASE_URL`.

The same image runs on Railway, Fly.io, Heroku, or any Node host. A `Procfile`
and `render.yaml` are included.

See `API.md` for the complete endpoint reference.
