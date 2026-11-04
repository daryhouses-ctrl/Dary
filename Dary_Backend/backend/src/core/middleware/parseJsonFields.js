export const parseJsonFields = (fields) => (req, res, next) => {
  fields.forEach((field) => {
    if (req.body[field] && typeof req.body[field] === "string") {
      try {
        req.body[field] = JSON.parse(req.body[field]);
      } catch {
        req.body[field] = undefined;
      }
    }
  });

  next();
};
