import { S3Client, HeadBucketCommand, CreateBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
export class ObjectStorage {
  private readonly client = new S3Client({ endpoint: `${process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http'}://${process.env.MINIO_ENDPOINT ?? 'localhost'}:${process.env.MINIO_PORT ?? 59000}`, region: 'us-east-1', forcePathStyle: true, credentials: { accessKeyId: process.env.MINIO_ACCESS_KEY ?? '', secretAccessKey: process.env.MINIO_SECRET_KEY ?? '' }, maxAttempts: 2 });
  async bucketExists(Bucket: string) { try { await this.client.send(new HeadBucketCommand({ Bucket })); return true; } catch (e) { if ((e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false; throw e; } }
  async makeBucket(Bucket: string) { await this.client.send(new CreateBucketCommand({ Bucket })); }
  async putObject(Bucket: string, Key: string, Body: Buffer, ContentLength: number, metadata: { 'Content-Type': string }) { await this.client.send(new PutObjectCommand({ Bucket, Key, Body, ContentLength, ContentType: metadata['Content-Type'] })); }
  async getObject(Bucket: string, Key: string): Promise<Readable> { const output = await this.client.send(new GetObjectCommand({ Bucket, Key })); if (!(output.Body instanceof Readable)) throw new Error('Missing object stream'); return output.Body; }
  async removeObject(Bucket: string, Key: string) { await this.client.send(new DeleteObjectCommand({ Bucket, Key })); }
}
