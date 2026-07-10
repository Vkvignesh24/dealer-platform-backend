// const admin = require('firebase-admin');

// let initialized = false;

// function initFirebase() {
//   if (initialized) return admin;
//   const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
//   if (!b64) {
//     console.warn('⚠ Firebase service account missing — token verification disabled');
//     return null;
//   }
//   try {
//     const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
//     admin.initializeApp({ credential: admin.credential.cert(json) });
//     initialized = true;
//     console.log('✔ Firebase admin initialized');
//     return admin;
//   } catch (e) {
//     console.error('Firebase init failed:', e.message);
//     return null;
//   }
// }

// module.exports = { initFirebase, admin };


const admin = require('firebase-admin');

function initFirebase() {
  if (admin.apps.length) {
    return admin;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID missing');
  }

  if (!clientEmail) {
    throw new Error('FIREBASE_CLIENT_EMAIL missing');
  }

  if (!privateKey) {
    throw new Error('FIREBASE_PRIVATE_KEY missing');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });

  console.log('✔ Firebase Admin Initialized');

  return admin;
}

module.exports = {
  admin,
  initFirebase,
};