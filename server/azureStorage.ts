import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = "deals-clients";

let containerClient: ContainerClient | null = null;

async function getContainerClient(): Promise<ContainerClient> {
  if (containerClient) return containerClient;
  
  if (!AZURE_STORAGE_CONNECTION_STRING) {
    throw new Error("Azure Storage connection string is not configured");
  }
  
  const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
  containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
  
  const exists = await containerClient.exists();
  if (!exists) {
    await containerClient.create({ access: "blob" });
  }
  
  return containerClient;
}

export async function uploadImageToAzure(base64Data: string, dealId: string, index: number): Promise<string> {
  const container = await getContainerClient();
  
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid base64 image data");
  }
  
  const contentType = matches[1];
  const base64Content = matches[2];
  const buffer = Buffer.from(base64Content, "base64");
  
  const extension = contentType.split("/")[1] || "png";
  const blobName = `${dealId}/${Date.now()}-${index}.${extension}`;
  
  const blockBlobClient = container.getBlockBlobClient(blobName);
  await blockBlobClient.upload(buffer, buffer.length, {
    blobHTTPHeaders: { blobContentType: contentType }
  });
  
  return blockBlobClient.url;
}

export async function uploadMultipleImages(base64Images: string[], dealId: string): Promise<string[]> {
  const urls: string[] = [];
  
  for (let i = 0; i < base64Images.length; i++) {
    if (base64Images[i] && base64Images[i].startsWith("data:")) {
      const url = await uploadImageToAzure(base64Images[i], dealId, i);
      urls.push(url);
    } else if (base64Images[i] && base64Images[i].startsWith("http")) {
      urls.push(base64Images[i]);
    }
  }
  
  return urls;
}

export async function deleteImagesFromAzure(dealId: string): Promise<void> {
  const container = await getContainerClient();
  
  for await (const blob of container.listBlobsFlat({ prefix: `${dealId}/` })) {
    await container.deleteBlob(blob.name);
  }
}

export async function migrateExistingImages(deals: Array<{ id: string; images: string[] | null }>): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();
  
  for (const deal of deals) {
    if (!deal.images || deal.images.length === 0) continue;
    
    const hasBase64 = deal.images.some(img => img && img.startsWith("data:"));
    if (!hasBase64) {
      results.set(deal.id, deal.images);
      continue;
    }
    
    try {
      const urls = await uploadMultipleImages(deal.images, deal.id);
      results.set(deal.id, urls);
      console.log(`[Azure] Migrated ${urls.length} images for deal ${deal.id}`);
    } catch (error) {
      console.error(`[Azure] Failed to migrate images for deal ${deal.id}:`, error);
      results.set(deal.id, deal.images);
    }
  }
  
  return results;
}
