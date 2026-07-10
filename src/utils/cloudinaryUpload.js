const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');

/**
 * Uploads a single in-memory file buffer (from multer's memoryStorage)
 * to Cloudinary and resolves with the Cloudinary upload result.
 *
 *   uploadBuffer(buffer, folder = 'inventoryhub', resourceType = 'image')
 *
 * Called from controllers/uploadController.js as:
 *   uploadBuffer(f.buffer, 'inventoryhub', f.mimetype.startsWith('video') ? 'video' : 'image')
 */
function uploadBuffer(buffer, folder = 'inventoryhub', resourceType = 'image') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

module.exports = { uploadBuffer };
