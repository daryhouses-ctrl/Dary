import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const cloudinaryUploadImage = async (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "uploads/images",

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
          return reject(error);
        }

        resolve(result);
      },
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

export const cloudinaryUploadMultipleImages = async (files) => {
  return Promise.all(files.map((file) => cloudinaryUploadImage(file.buffer)));
};

export const cloudinaryUploadFile = async (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "uploads/files",

        resource_type: "raw",
      },

      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve(result);
      },
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

export const cloudinaryUpload = async (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "uploads",

        resource_type: "auto",
      },

      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve(result);
      },
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

export const cloudinaryRemove = async (publicId) => {
  return cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
  });
};

export const cloudinaryRemoveMultiple = async (publicIds) => {
  return cloudinary.api.delete_resources(publicIds);
};

export default cloudinary;
