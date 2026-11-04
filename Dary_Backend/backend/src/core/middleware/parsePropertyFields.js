export const parsePropertyFields = (req, res, next) => {
  const toNumber = [
    "latitude",
    "longitude",
    "distanceToUniversity",
    "startingPrice",
  ];

  const toBoolean = [
    "isFurnished",
    "electricityIncluded",
    "waterIncluded",
    "internetIncluded",
  ];

  // 1. Remove empty strings so optional fields in Zod schema default to undefined
  if (req.body && typeof req.body === "object") {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === "string" && req.body[key].trim() === "") {
        delete req.body[key];
      }
    }
  }

  // 2. Parse numeric fields
  for (const key of toNumber) {
    if (req.body[key] !== undefined && req.body[key] !== null) {
      const parsed = Number(req.body[key]);
      if (!isNaN(parsed)) {
        req.body[key] = parsed;
      } else {
        delete req.body[key];
      }
    }
  }

  // 3. Parse boolean fields
  for (const key of toBoolean) {
    if (req.body[key] !== undefined && req.body[key] !== null) {
      req.body[key] = req.body[key] === true || req.body[key] === "true";
    }
  }

  next();
};
