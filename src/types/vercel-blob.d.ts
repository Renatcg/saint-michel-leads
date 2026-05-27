declare module "@vercel/blob/client" {
  export type HandleUploadBody = unknown;

  export function handleUpload(options: {
    body: HandleUploadBody;
    request: Request;
    onBeforeGenerateToken: (pathname: string) => Promise<{
      allowedContentTypes?: string[];
      maximumSizeInBytes?: number;
      tokenPayload?: string;
    }>;
    onUploadCompleted?: (body: unknown) => Promise<void>;
  }): Promise<unknown>;

  export function upload(
    pathname: string,
    body: File,
    options: {
      access: "public" | "private";
      handleUploadUrl: string;
      multipart?: boolean;
      contentType?: string;
      onUploadProgress?: (event: { loaded: number; total: number; percentage: number }) => void;
    },
  ): Promise<{ url: string }>;
}
