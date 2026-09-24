import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Response } from "express";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class S3StorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined, // Will use IAM role if running on EC2/ECS
    });
    
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || "";
    if (!this.bucketName) {
      throw new Error("AWS_S3_BUCKET_NAME environment variable is required");
    }
  }

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      return [`${this.bucketName}/public`];
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    return process.env.PRIVATE_OBJECT_DIR || `${this.bucketName}/uploads`;
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const objectKey = `${privateObjectDir}/${objectId}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
    });

    const signedURL = await getSignedUrl(this.s3Client, command, {
      expiresIn: 900, // 15 minutes
    });

    return signedURL;
  }

  async getSignedUploadURL(objectKey: string, contentType: string, expiresInSec: number = 600): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
      ContentType: contentType,
    });

    const signedURL = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSec,
    });

    return signedURL;
  }

  async objectExists(objectKey: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      });
      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === "NotFound" || error.name === "NoSuchKey") {
        return false;
      }
      // For other errors, log and return false to be safe
      console.error("Error checking object existence:", error);
      return false;
    }
  }

  /**
   * Remove an object. Returns false when S3 refused rather than throwing, so a caller clearing
   * a database reference is not blocked by a bucket that has already lost the file — the
   * reference is the thing users see, and leaving it pointing at nothing is worse than an
   * orphaned object.
   *
   * DeleteObjectCommand was already imported here and unused; nothing had needed to delete yet.
   */
  async deleteObject(objectKey: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: this.bucketName, Key: objectKey })
      );
      return true;
    } catch (error) {
      console.error("Error deleting object:", objectKey, error);
      return false;
    }
  }

  async getSignedDownloadURL(objectKey: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
    });

    const signedURL = await getSignedUrl(this.s3Client, command, {
      expiresIn, // Default 1 hour
    });

    return signedURL;
  }

  async downloadObject(objectKey: string, res: Response, cacheTtlSec: number = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new ObjectNotFoundError();
      }

      res.set({
        "Content-Type": response.ContentType || "application/octet-stream",
        "Content-Length": response.ContentLength?.toString() || "0",
        "Cache-Control": `private, max-age=${cacheTtlSec}`,
      });

      // Convert stream to buffer and send
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      res.send(buffer);
    } catch (error: any) {
      if (error.name === "NoSuchKey" || error.name === "NotFound") {
        throw new ObjectNotFoundError();
      }
      console.error("Error downloading object:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  /**
   * Size and content type of an object without fetching its body.
   * Returns null when the object is missing or unreadable, so callers can
   * report a skipped attachment instead of failing the whole operation.
   */
  async getObjectMetadata(
    objectKey: string
  ): Promise<{ size: number; contentType: string | null } | null> {
    try {
      const response = await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucketName, Key: objectKey })
      );
      return {
        size: response.ContentLength ?? 0,
        contentType: response.ContentType ?? null,
      };
    } catch (error: any) {
      if (error.name !== "NotFound" && error.name !== "NoSuchKey") {
        console.error("Error reading object metadata:", objectKey, error);
      }
      return null;
    }
  }

  /**
   * A readable stream of an object's body, for piping straight into another
   * stream (an archive, an HTTP response) without buffering it in memory.
   * Unlike downloadObject, nothing is held in RAM — use this for bulk work
   * where total size is unbounded.
   */
  async getObjectStream(objectKey: string): Promise<{
    stream: Readable;
    size: number;
    contentType: string | null;
  }> {
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.bucketName, Key: objectKey })
      );
      if (!response.Body) {
        throw new ObjectNotFoundError();
      }
      return {
        stream: response.Body as Readable,
        size: response.ContentLength ?? 0,
        contentType: response.ContentType ?? null,
      };
    } catch (error: any) {
      if (error.name === "NoSuchKey" || error.name === "NotFound") {
        throw new ObjectNotFoundError();
      }
      throw error;
    }
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://") && !rawPath.startsWith("s3://")) {
      return rawPath;
    }
    
    // Extract key from S3 URL or HTTPS URL
    if (rawPath.startsWith(`https://${this.bucketName}.s3.`)) {
      const url = new URL(rawPath);
      return url.pathname.slice(1); // Remove leading /
    }
    
    if (rawPath.startsWith("s3://")) {
      return rawPath.replace(`s3://${this.bucketName}/`, "");
    }
    
    return rawPath;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    // S3 ACL is handled via bucket policies, so we just return the normalized path
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectKey,
    requestedPermission,
  }: {
    userId?: string;
    objectKey: string;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    // Basic access check - can be enhanced with S3 bucket policies
    // For now, allow access if object exists
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      });
      await this.s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  }
}

