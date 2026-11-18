import { api, s3 } from "@/lib/axios";
import { AxiosError } from "axios";

interface GeneratePresignedDownloadUrl {
  downloadUrl: string;
  expiresAt: string;
}

export async function downloadFile(
  fileId: number,
  defaultFilename = "unnamed",
) {
  try {
    const { data } = await api.get<GeneratePresignedDownloadUrl>(
      `/api/v1/files/${fileId}/presigned-download-urls`,
    );

    const { downloadUrl } = data;

    const response = await s3.get(downloadUrl, {
      responseType: "blob",
    });

    let filename = defaultFilename;

    const contentDisposition: string | undefined =
      response.headers["content-disposition"];

    if (contentDisposition) {
      // / regex /
      // i = case insensitive
      // ([^;]+) = 1 or more characters until you hits a ; or the end of the string
      const filenameMatch = contentDisposition.match(/filename=([^;]+)/i);

      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].trim();
      }
    }

    const blob = new Blob([response.data]);

    // create download blob link
    const url = window.URL.createObjectURL(blob);

    // create anchor element with download blob link
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;

    // append anchor element to page
    document.body.appendChild(link);

    // click link to start download
    link.click();

    // clean up and remove link
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    // if API request fails (4xx, 5xx)
    // due to responseType: "blob", axios will still process the error response as blob
    // to read the server's error message we need to convert the error back to text
    if (error instanceof AxiosError) {
      if (error.response && error.response.data instanceof Blob) {
        const errorText = await error.response.data.text();
        const errorJson = JSON.parse(errorText);

        console.error(errorJson);
      }
    }
  }
}
