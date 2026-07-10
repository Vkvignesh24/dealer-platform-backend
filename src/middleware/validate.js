const { fail } = require('../utils/respond');

module.exports = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    return fail(res, error.details.map((d) => d.message).join(', '), 422);
  }
  req[source] = value;
  next();
};
