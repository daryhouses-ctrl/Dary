import multer from "multer";

const multerErrorHandler = (err, req, res, next) => {
 
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(400).json({
          success: false,
          message: "File size exceeds the allowed limit.",
        });

      case "LIMIT_FILE_COUNT":
        return res.status(400).json({
          success: false,
          message: "Too many files uploaded.",
        });

      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          message: "Unexpected file field.",
        });

      case "LIMIT_PART_COUNT":
        return res.status(400).json({
          success: false,
          message: "Too many parts in the request.",
        });

      case "LIMIT_FIELD_KEY":
        return res.status(400).json({
          success: false,
          message: "Field name is too long.",
        });

      case "LIMIT_FIELD_VALUE":
        return res.status(400).json({
          success: false,
          message: "Field value is too long.",
        });

      default:
        return res.status(400).json({
          success: false,
          message: err.message,
        });
    }
  }

  next(err);
};

export default multerErrorHandler;
