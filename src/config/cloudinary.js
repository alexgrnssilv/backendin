import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const hasCloudinaryConfig =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (hasCloudinaryConfig) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export async function uploadFoto(file) {
  if (!hasCloudinaryConfig) {
    console.warn("Cloudinary credentials not set. Simulating upload locally.");
    return "https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=800&auto=format&fit=crop";
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "cartas",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          console.error("Erro no upload do Cloudinary:", error);
          return reject(error);
        }
        resolve(result.secure_url);
      }
    );

    uploadStream.end(file.buffer);
  });
}
