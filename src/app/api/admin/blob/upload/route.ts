import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const { response } = await requireAdminUser(["ADMIN", "MANAGER"]);

  if (response) {
    return response;
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (
          !pathname.startsWith("landing/") &&
          !pathname.startsWith("logos/") &&
          !pathname.startsWith("success/") &&
          !pathname.startsWith("chat/")
        ) {
          throw new Error("Caminho de upload inválido.");
        }

        return {
          allowedContentTypes: [
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/svg+xml",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ],
          maximumSizeInBytes: 20 * 1024 * 1024,
          tokenPayload: JSON.stringify({ area: pathname.startsWith("chat/") ? "chat" : "landing" }),
        };
      },
      onUploadCompleted: async () => {
        // The client stores the returned public URL in the landing settings.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível subir o arquivo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
