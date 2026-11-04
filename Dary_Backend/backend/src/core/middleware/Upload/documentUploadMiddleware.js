import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

import { documentFilter } from "./fileFilters.js";

const DOCUMENT_MAX_FILE_SIZE =
  Number(process.env.DOCUMENT_MAX_FILE_SIZE) || 200 * 1024 * 1024;

const CHUNK_SIZE =
  Number(process.env.CLOUDINARY_CHUNK_SIZE) || 10 * 1024 * 1024;

const documentStorage = {
  _handleFile(req, file, cb) {
    const uploadStream = cloudinary.uploader.upload_chunked_stream(
      {
        folder: "uploads/documents",
        resource_type: "raw",
        chunk_size: CHUNK_SIZE,
      },
      (error, result) => {
        if (error) {
          return cb(error);
        }

        if (result?.done === false) {
          return;
        }

        return cb(null, {
          fieldname: file.fieldname,
          originalname: file.originalname,
          encoding: file.encoding,
          mimetype: file.mimetype,
          size: result.bytes,
          filename: result.public_id,
          public_id: result.public_id,
          secure_url: result.secure_url,
          url: result.url,
          resource_type: result.resource_type,
          format: result.format,
        });
      },
    );

    file.stream.pipe(uploadStream);

    file.stream.on("error", (error) => {
      uploadStream.destroy(error);
    });

    file.stream.on("limit", () => {
      uploadStream.destroy(new Error("Document file size limit exceeded."));
    });
  },

  _removeFile(req, file, cb) {
    cb(null);
  },
};

export const uploadDocument = multer({
  storage: documentStorage,
  fileFilter: documentFilter,
  limits: {
    fileSize: DOCUMENT_MAX_FILE_SIZE,
  },
});
