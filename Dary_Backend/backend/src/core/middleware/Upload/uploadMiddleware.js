import multer from "multer";

import { imageFilter, videoFilter } from "./fileFilters.js";

const IMAGE_MAX_FILE_SIZE =
  Number(process.env.IMAGE_MAX_FILE_SIZE) || 10 * 1024 * 1024;

const VIDEO_MAX_FILE_SIZE =
  Number(process.env.VIDEO_MAX_FILE_SIZE) || 200 * 1024 * 1024;

const memoryStorage = multer.memoryStorage();

export const uploadImage = multer({
  storage: memoryStorage,

  fileFilter: imageFilter,

  limits: {
    fileSize: IMAGE_MAX_FILE_SIZE,
  },
});

export const uploadVideo = multer({
  storage: memoryStorage,

  fileFilter: videoFilter,

  limits: {
    fileSize: VIDEO_MAX_FILE_SIZE,
  },
});
