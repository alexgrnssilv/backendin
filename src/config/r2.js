import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import path from "path";

dotenv.config();

const hasR2Config =
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME;

let s3Client = null;

if (hasR2Config) {
  s3Client = new S3Client({
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: "auto",
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

export async function uploadFoto(file) {
  if (!hasR2Config) {
    console.warn("R2 Cloudflare credentials not set. Simulating upload locally.");
    return "https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=800&auto=format&fit=crop";
  }

  const fileExtension = path.extname(file.originalname) || ".jpg";
  const uniqueKey = `cartas/${uuidv4()}${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: uniqueKey,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await s3Client.send(command);

  // Return the public URL
  const publicUrl = process.env.R2_PUBLIC_URL.endsWith("/")
    ? process.env.R2_PUBLIC_URL
    : `${process.env.R2_PUBLIC_URL}/`;

  return `${publicUrl}${uniqueKey}`;
}
