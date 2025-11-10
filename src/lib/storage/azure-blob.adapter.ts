import { 
  BlobServiceClient, 
  ContainerClient, 
  BlockBlobClient,
  BlobSASPermissions 
} from '@azure/storage-blob';

/**
 * Azure Blob Storage adapter for M3W
 * Replaces MinIO when deployed to Azure
 */
export class AzureBlobStorageAdapter {
  private blobServiceClient: BlobServiceClient;
  private containerName: string;
  private initPromise: Promise<void>;

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');
    }

    this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'music';
    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    
    // Initialize container (create if not exists)
    this.initPromise = this.ensureContainerExists();
  }

  private async ensureContainerExists(): Promise<void> {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    await containerClient.createIfNotExists();
  }

  private getContainerClient(): ContainerClient {
    return this.blobServiceClient.getContainerClient(this.containerName);
  }

  /**
   * Upload a file to Azure Blob Storage
   */
  async uploadFile(buffer: Buffer, key: string, contentType?: string): Promise<void> {
    // Wait for container to be ready
    await this.initPromise;
    
    const containerClient = this.getContainerClient();
    const blockBlobClient = containerClient.getBlockBlobClient(key);

    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType: contentType || 'application/octet-stream',
      },
    });
  }

  /**
   * Download a file from Azure Blob Storage
   */
  async downloadFile(key: string): Promise<Buffer> {
    const containerClient = this.getContainerClient();
    const blockBlobClient = containerClient.getBlockBlobClient(key);

    const downloadResponse = await blockBlobClient.download();
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download file: no stream body');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  /**
   * Get a temporary SAS URL for direct client access
   * @param key Blob key
   * @param expiryMinutes URL expiry time in minutes (default: 60)
   */
  async getFileUrl(key: string, expiryMinutes = 60): Promise<string> {
    const containerClient = this.getContainerClient();
    const blockBlobClient = containerClient.getBlockBlobClient(key);

    // Generate SAS token
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + expiryMinutes);

    const sasUrl = await blockBlobClient.generateSasUrl({
      permissions: BlobSASPermissions.parse('r'), // Read-only
      expiresOn: expiryDate,
    });

    return sasUrl;
  }

  /**
   * Stream a file with range support (for audio streaming)
   */
  async streamFile(key: string, start?: number, end?: number): Promise<NodeJS.ReadableStream> {
    const containerClient = this.getContainerClient();
    const blockBlobClient = containerClient.getBlockBlobClient(key);

    const downloadOptions = start !== undefined && end !== undefined
      ? { range: { offset: start, count: end - start + 1 } }
      : undefined;

    const downloadResponse = await blockBlobClient.download(start, downloadOptions?.range?.count);
    
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to stream file: no stream body');
    }

    return downloadResponse.readableStreamBody as NodeJS.ReadableStream;
  }

  /**
   * Delete a file from Azure Blob Storage
   */
  async deleteFile(key: string): Promise<void> {
    const containerClient = this.getContainerClient();
    const blockBlobClient = containerClient.getBlockBlobClient(key);

    await blockBlobClient.delete();
  }

  /**
   * Check if a file exists
   */
  async fileExists(key: string): Promise<boolean> {
    const containerClient = this.getContainerClient();
    const blockBlobClient = containerClient.getBlockBlobClient(key);

    return blockBlobClient.exists();
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<{
    size: number;
    contentType: string;
    lastModified: Date;
  }> {
    const containerClient = this.getContainerClient();
    const blockBlobClient = containerClient.getBlockBlobClient(key);

    const properties = await blockBlobClient.getProperties();

    return {
      size: properties.contentLength || 0,
      contentType: properties.contentType || 'application/octet-stream',
      lastModified: properties.lastModified || new Date(),
    };
  }

  /**
   * List files with a given prefix
   */
  async listFiles(prefix?: string): Promise<string[]> {
    const containerClient = this.getContainerClient();
    const files: string[] = [];

    const listOptions = prefix ? { prefix } : undefined;

    for await (const blob of containerClient.listBlobsFlat(listOptions)) {
      files.push(blob.name);
    }

    return files;
  }
}

/**
 * Factory function to create storage adapter based on environment
 */
export function createStorageAdapter() {
  // Check if running on Azure (has Azure Storage connection string)
  if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
    return new AzureBlobStorageAdapter();
  }

  // Fall back to MinIO adapter for local development
  // Note: You need to implement MinioStorageAdapter separately
  throw new Error('No storage adapter configured. Set AZURE_STORAGE_CONNECTION_STRING or MINIO_* variables.');
}
