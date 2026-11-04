import {AppError} from "../error/AppError.js";

export const validatePropertyFiles = (req, res, next) => {
  const roomsConfig = req.body.roomsConfig || [];
  const roomPhotos = req.files?.roomPhotos || [];

  if (roomsConfig.length !== roomPhotos.length) {
    return next(
      new AppError(
        "The number of uploaded room photos must match the number of configured rooms.",
        400
      )
    );
  }

  next();
};