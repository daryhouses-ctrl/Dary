export const validateUUID = (req, res, next) => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const uuidParams = Object.values(req.params);

  const isValid =
    uuidParams.length > 0 &&
    uuidParams.every(
      (value) => typeof value === "string" && uuidRegex.test(value.trim()),
    );

  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: "Invalid UUID",
    });
  }

  next();
};