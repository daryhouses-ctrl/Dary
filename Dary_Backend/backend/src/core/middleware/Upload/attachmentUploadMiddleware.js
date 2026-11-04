import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

import { attachmentFilter } from "./fileFilters.js";

const ATTACHMENT_MAX_FILE_SIZE =
  Number(process.env.ATTACHMENT_MAX_FILE_SIZE) || 200 * 1024 * 1024;

const CHUNK_SIZE =
  Number(process.env.CLOUDINARY_CHUNK_SIZE) || 10 * 1024 * 1024;

const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const attachmentStorage = {
  _handleFile(req, file, cb) {
    const isImage = IMAGE_MIME_TYPES.includes(file.mimetype);

    if (isImage) {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "uploads/attachments/images",
          resource_type: "image",
          transformation: [
            {
              width: 2000,
              height: 2000,
              crop: "limit",
            },
            {
              fetch_format: "auto",
              quality: "auto",
            },
          ],
        },
        (error, result) => {
          if (error) {
            return cb(error);
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
        uploadStream.destroy(
          new Error("Attachment file size limit exceeded."),
        );
      });

      return;
    }

    const uploadStream = cloudinary.uploader.upload_chunked_stream(
      {
        folder: "uploads/attachments/documents",
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
      uploadStream.destroy(
        new Error("Attachment file size limit exceeded."),
      );
    });
  },

  _removeFile(req, file, cb) {
    cb(null);
  },
};

export const uploadAttachment = multer({
  storage: attachmentStorage,
  fileFilter: attachmentFilter,
  limits: {
    fileSize: ATTACHMENT_MAX_FILE_SIZE,
  },
});