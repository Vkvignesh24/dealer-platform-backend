const { uploadBuffer } = require('../utils/cloudinaryUpload');
const { ok, fail } = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');

exports.upload = asyncHandler(async (req, res) => {
  const files = req.files || (req.file ? [req.file] : []);
  if (!files.length) return fail(res, 'No files uploaded');

  const uploads = await Promise.all(
    files.map((f) =>
      uploadBuffer(
        f.buffer,
        'inventoryhub',
        f.mimetype.startsWith('video') ? 'video' : 'image'
      )
    )
  );
  ok(
    res,
    uploads.map((u) => ({ url: u.secure_url, publicId: u.public_id })),
    'Uploaded'
  );
});
