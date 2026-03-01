import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { env } from "~/server/env";

let client: S3Client | undefined;

function getClient(): S3Client {
  if (client) return client;
  if (!env.s3Endpoint || !env.s3AccessKeyId || !env.s3SecretAccessKey || !env.s3Bucket) {
    throw new Error("S3 configuration is incomplete — set S3_ENDPOINT, S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY");
  }
  client = new S3Client({
    region: env.s3Region,
    endpoint: env.s3Endpoint,
    credentials: {
      accessKeyId: env.s3AccessKeyId,
      secretAccessKey: env.s3SecretAccessKey,
    },
  });
  return client;
}

export async function uploadBuffer(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const s3 = getClient();
  await s3.send(
    new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  return key;
}

export async function getObject(key: string): Promise<Uint8Array | null> {
  const s3 = getClient();
  try {
    const result = await s3.send(
      new GetObjectCommand({
        Bucket: env.s3Bucket,
        Key: key,
      }),
    );
    if (!result.Body) return null;
    return await result.Body.transformToByteArray();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "NoSuchKey") return null;
    throw err;
  }
}
