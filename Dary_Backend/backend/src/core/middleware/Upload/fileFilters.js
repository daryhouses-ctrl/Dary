import path from "path";

const imageExtensions = /\.(jpg|jpeg|png|gif|webp)$/i;

const documentExtensions = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt)$/i;

const videoExtensions = /\.(mp4|mov|avi|mkv|webm)$/i;

const attachmentExtensions =
  /\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|xls|xlsx|ppt|pptx|txt)$/i;

const imageMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const documentMimeTypes = [
  "application/pdf",

  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  "text/plain",
];

export const imageFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  const validExtension = imageExtensions.test(extension);

  const validMimeType = imageMimeTypes.includes(file.mimetype);

  if (validExtension && validMimeType) {
    return cb(null, true);
  }

  cb(new Error("Only valid image files are allowed."));
};

export const documentFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  const validExtension = documentExtensions.test(extension);

  const validMimeType = documentMimeTypes.includes(file.mimetype);

  if (validExtension && validMimeType) {
    return cb(null, true);
  }

  cb(new Error("Only valid document files are allowed."));
};

export const videoFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  const validExtension = videoExtensions.test(extension);

  const validMimeType = file.mimetype.startsWith("video/");

  if (validExtension && validMimeType) {
    return cb(null, true);
  }

  cb(new Error("Only valid video files are allowed."));
};

export const attachmentFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  const validExtension = attachmentExtensions.test(extension);

  const validMimeType =
    imageMimeTypes.includes(file.mimetype) ||
    documentMimeTypes.includes(file.mimetype);

  if (validExtension && validMimeType) {
    return cb(null, true);
  }

  cb(new Error("Invalid attachment type."));
};
