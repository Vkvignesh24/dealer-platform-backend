const Joi = require('joi');

/**
 * Joi validation schemas, used with middleware/validate.js as:
 *   router.post('/register', authenticate, validate(register), c.register);
 *
 * Matches the fields read in controllers/authController.js#register
 * (name, email, phone).
 */
const register = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().email().required(),
  phone: Joi.string().trim().min(7).max(20).allow('', null),
});

module.exports = { register };
