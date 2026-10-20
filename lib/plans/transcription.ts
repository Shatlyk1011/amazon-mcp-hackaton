import "server-only";

import OpenAI from "openai";
import { PlanError } from "./errors";

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

const allowedAudioTypes = new Set([
  "audio/flac",
  "audio/m4a",
  "audio/mp3",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
]);

export function validateAudioFile(file: File) {
  if (!file.size)
    throw new PlanError("The recording was empty. Please try again.", 400);
  if (file.size > MAX_AUDIO_BYTES)
    throw new PlanError(
      "The recording is too large. Keep it under two minutes and try again.",
      413,
    );

  const baseType = file.type.split(";", 1)[0].toLowerCase();
  if (!allowedAudioTypes.has(baseType))
    throw new PlanError("That audio format is not supported.", 415);
}

export async function transcribeMoveAudio(
  file: File,
  openai?: Pick<OpenAI, "audio">,
) {
  validateAudioFile(file);
  if (!openai && !process.env.OPENAI_API_KEY)
    throw new PlanError(
      "OpenAI transcription is not configured. Set OPENAI_API_KEY on the server.",
      503,
    );

  const client =
    openai ??
    new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0,
      timeout: 60_000,
    });

  try {
    const transcription = await client.audio.transcriptions.create(
      {
        file,
        model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-transcribe",
        keywords: [
          "MoveFlow",
          "relocation",
          "moving date",
          "moving budget",
          "monthly rent",
          "pet-friendly",
        ],
      },
      { signal: AbortSignal.timeout(65_000) },
    );
    const text = transcription.text.trim();
    if (!text)
      throw new PlanError(
        "No speech was detected. Please record your request again.",
        422,
      );
    return text;
  } catch (error) {
    if (error instanceof PlanError) throw error;
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401)
        throw new PlanError(
          "OpenAI rejected the API key. Check OPENAI_API_KEY on the server.",
          503,
        );
      if (error.status === 429)
        throw new PlanError(
          "Transcription is temporarily rate limited. Please try again shortly.",
          503,
        );
    }
    throw new PlanError(
      "The recording could not be transcribed. Please try again.",
      503,
    );
  }
}
