import { api, s3 } from "@/lib/axios";

interface GetPresignedUploadUrl {
  uploadUrl: string;
  fileId: number;
  expiresAt: string;
}

async function singleUpload(file: File) {
  const { data } = await api.post<GetPresignedUploadUrl>(
    "/api/v1/files/presigned-upload-urls",
    {
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      fileSize: file.size,
    },
  );

  const { uploadUrl, fileId } = data;

  await s3.put(uploadUrl, file, {
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    onUploadProgress: (progressEvent) => {
      const total = progressEvent.total;
      if (total) {
        const completed = Math.round((progressEvent.loaded / total) * 100);

        console.log("PROGRESS: ", completed);
      }
    },
  });

  return fileId;
}

interface StartMultipartUpload {
  uploadId: string;
  fileId: number;
}

interface GetPresignedPartUploadUrl {
  partUploadUrl: string;
  expiresAt: string;
}

async function multipartUpload(file: File, maxConcurrency = 3) {
  // start multipart upload
  const { data } = await api.post<StartMultipartUpload>(
    "/api/v1/multipart-uploads",
    {
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      fileSize: file.size,
    },
  );

  const { uploadId, fileId } = data;

  // slice file to chunks
  // MIN(CHUNK_SIZE) = 5 MB (https://docs.aws.amazon.com/AmazonS3/latest/userguide/qfacts.html)
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB

  const totalParts = Math.ceil(file.size / CHUNK_SIZE);
  const completedParts: { partNumber: number; eTag: string }[] = [];

  try {
    let currentPart = 1;

    // for each chunk:
    //    1. generate presigned part upload URL
    //    2. upload chunk to object store
    //    3. cache etag + completed parts
    const partUpload = async () => {
      while (currentPart <= totalParts) {
        const partNumber = currentPart++;

        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const partSize = chunk.size;

        const { data } = await api.post<GetPresignedPartUploadUrl>(
          `/api/v1/multipart-uploads/${uploadId}/presigned-upload-urls`,
          {
            fileId,
            partNumber,
            partSize,
          },
        );

        const { partUploadUrl } = data;

        const response = await s3.put(partUploadUrl, chunk);

        const eTag = response.headers["etag"];

        if (!eTag) throw new Error("eTag header is missing!");

        completedParts.push({ partNumber, eTag });
      }
    };

    const partUploads = Array.from(
      { length: Math.min(maxConcurrency, totalParts) },
      () => partUpload(),
    );

    await Promise.all(partUploads);

    // complete multipart upload
    await api.post(`/api/v1/multipart-uploads/${uploadId}/complete`, {
      fileId,
      parts: completedParts,
    });

    return fileId;
  } catch (error) {
    await api.post(`/api/v1/multipart-uploads/${uploadId}/cancel`, {
      fileId,
    });

    throw error;
  }
}

async function uploadFile(file: File) {
  const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

  let fileId: number;

  if (file.size > MAX_SIZE) {
    fileId = await multipartUpload(file);
  } else {
    fileId = await singleUpload(file);
  }

  return fileId;
}

// concurrent file uploads
// partial failures
// retry with exponential backoffs on 429 or 5xx HTTP errors
export async function uploadFiles(files: File[], maxConcurrency = 3) {
  const uplodedFileIds: number[] = [];
  const failedFileNames: string[] = [];

  let index = 0;

  const fileUpload = async () => {
    while (index < files.length) {
      const currentIndex = index++;
      const file = files[currentIndex];

      try {
        const fileId = await uploadFile(file);
        uplodedFileIds.push(fileId);
      } catch (error) {
        console.error(`failed to upload ${file.name}: ${error}`);
        failedFileNames.push(file.name);
      }
    }
  };

  const fileUploads = Array.from(
    { length: Math.min(maxConcurrency, files.length) },
    () => fileUpload(),
  );

  await Promise.all(fileUploads);

  return { uplodedFileIds, failedFileNames };
}
