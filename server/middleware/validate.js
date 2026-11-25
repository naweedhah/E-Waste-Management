/**
 * Request validation with zod.
 *
 * Usage: router.post('/', validate({ body: schema, params: schema, query: schema }), handler)
 *
 * On success the parsed (trimmed, coerced, defaulted) values replace req.body / req.params /
 * req.query, so controllers only ever see clean data. On failure the request stops here with
 * 400 and the same shape the error handler uses for Mongoose errors:
 *   { success: false, message, errors: [messages], fields: { "shippingAddress.city": [messages] } }
 */
export const validate = (schemas) => (req, res, next) => {
  const fields = {};

  for (const part of ['params', 'query', 'body']) {
    const schema = schemas[part];
    if (!schema) continue;

    const result = schema.safeParse(req[part] ?? {});

    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path.length ? issue.path.join('.') : part;
        (fields[key] ??= []).push(issue.message);
      }
      continue;
    }

    if (part === 'query') {
      // Express 4 exposes req.query as a plain property; replace it with the parsed copy.
      Object.defineProperty(req, 'query', { value: result.data, writable: true, configurable: true });
    } else {
      req[part] = result.data;
    }
  }

  const errors = Object.values(fields).flat();
  if (errors.length) {
    return res.status(400).json({ success: false, message: errors[0], errors, fields });
  }

  return next();
};
