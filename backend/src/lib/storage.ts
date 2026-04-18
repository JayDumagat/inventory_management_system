import * as Minio from "minio";

let minioClient: Minio.Client | null = null;
let bucketEnsured = false;

const DEFAULT_BUCKET = process.env.MINIO_BUCKET || "inventory-files";

function getMinioClient(): Minio.Client | null {
  if (minioClient) return minioClient;

  const endpoint = process.env.MINIO_ENDPOINT;
  if (!endpoint) return null;

  try {
    minioClient = new Minio.Client({
      endPoint: endpoint,
      port: parseInt(process.env.MINIO_PORT || "9000", 10),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
      secretKey: process.env.MINIO_SECRET_KEY || "minioadmin123",
    });
    console.log("[MinIO] Client created");
    return minioClient;
  } catch (err) {
    console.error("[MinIO] Failed to create client:", err);
    return null;
  }
}

async function ensureBucket(client: Minio.Client, bucket: string): Promise<void> {
  if (bucketEnsured) return;
  try {
    const exists = await client.bucketExists(bucket);
    if (!exists) {
      await client.makeBucket(bucket);
      console.log(`[MinIO] Created bucket: ${bucket}`);
    }
    const publicReadPolicy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    });
    await client.setBucketPolicy(bucket, publicReadPolicy);
    bucketEnsured = true;
  } catch (err) {
    console.error("[MinIO] Bucket setup error:", err);
  }
}

export async function uploadFile(
  objectName: string,
  buffer: Buffer,
  mimeType: string,
  bucket = DEFAULT_BUCKET
): Promise<string | null> {
  const client = getMinioClient();
  if (!client) return null;
  try {
    await ensureBucket(client, bucket);
    await client.putObject(bucket, objectName, buffer, buffer.length, {
      "Content-Type": mimeType,
    });
    return objectName;
  } catch (err) {
    console.error("[MinIO] Upload error:", err);
    return null;
  }
}

export async function getPresignedUrl(
  objectName: string,
  bucket = DEFAULT_BUCKET,
  expirySeconds = 3600
): Promise<string | null> {
  const client = getMinioClient();
  if (!client) return null;
  try {
    const url = await client.presignedGetObject(bucket, objectName, expirySeconds);
    return url;
  } catch (err) {
    console.error("[MinIO] Presign error:", err);
    return null;
  }
}

export async function deleteFile(
  objectName: string,
  bucket = DEFAULT_BUCKET
): Promise<boolean> {
  const client = getMinioClient();
  if (!client) return false;
  try {
    await client.removeObject(bucket, objectName);
    return true;
  } catch (err) {
    console.error("[MinIO] Delete error:", err);
    return false;
  }
}

export function getPublicUrl(objectName: string, bucket = DEFAULT_BUCKET): string {
  const publicBase = process.env.MINIO_PUBLIC_BASE_URL;
  if (publicBase) {
    // Use configured public base while normalizing localhost/frontend-origin URLs to relative proxy paths.
    const configuredBase = publicBase.endsWith("/") ? publicBase.slice(0, -1) : publicBase;
    let base = configuredBase;
    if (!configuredBase.startsWith("/")) {
      try {
        const parsedBase = new URL(configuredBase);
        const normalizedPath = parsedBase.pathname === "/" ? "" : parsedBase.pathname.replace(/\/+$/, "");
        const localHostnames = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);
        let useRelativePath =
          localHostnames.has(parsedBase.hostname);
        const frontendUrl = process.env.FRONTEND_URL;
        if (!useRelativePath && frontendUrl) {
          try {
            const parsedFrontend = new URL(frontendUrl);
            useRelativePath = parsedFrontend.origin === parsedBase.origin;
          } catch {
            // Ignore invalid FRONTEND_URL and keep absolute configured base.
          }
        }
        base = useRelativePath ? normalizedPath : `${parsedBase.origin}${normalizedPath}`;
      } catch {
        // Keep non-URL configured values unchanged.
      }
    }
    return `${base}/${bucket}/${objectName}`;
  }
  const endpoint = process.env.MINIO_ENDPOINT || "localhost";
  const port = process.env.MINIO_PORT || "9000";
  const protocol = process.env.MINIO_USE_SSL === "true" ? "https" : "http";
  return `${protocol}://${endpoint}:${port}/${bucket}/${objectName}`;
}

export { getMinioClient, DEFAULT_BUCKET };
