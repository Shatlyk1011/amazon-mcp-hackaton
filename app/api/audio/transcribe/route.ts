import { errorResponse, PlanError } from "@/lib/plans/errors";
import {
  MAX_AUDIO_BYTES,
  transcribeMoveAudio,
} from "@/lib/plans/transcription";
import { checkOrigin } from "@/lib/plans/session";

export const maxDuration = 90;

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (!request.headers.get("content-type")?.includes("multipart/form-data"))
      throw new PlanError("Expected an audio upload.", 415);

    const contentLength = Number(request.headers.get("content-length"));
    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_AUDIO_BYTES + 64_000
    )
      throw new PlanError("The recording is too large.", 413);

    const formData = await request.formData();
    const audio = formData.get("audio");
    if (!(audio instanceof File))
      throw new PlanError("Please attach a recorded audio file.", 400);

    return Response.json({ text: await transcribeMoveAudio(audio) });
  } catch (error) {
    return errorResponse(error);
  }
}
