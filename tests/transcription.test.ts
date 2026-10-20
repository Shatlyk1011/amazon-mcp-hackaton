import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MAX_AUDIO_BYTES,
  transcribeMoveAudio,
  validateAudioFile,
} from "@/lib/plans/transcription";
import { POST } from "@/app/api/audio/transcribe/route";

function audioFile(type = "audio/webm") {
  return new File([new Uint8Array([1, 2, 3])], "move-request.webm", {
    type,
  });
}

describe("OpenAI move transcription", () => {
  it("requires a multipart audio upload", async () => {
    const response = await POST(
      new Request("http://localhost/api/audio/transcribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(415);
  });

  it("sends supported audio to the configured transcription model", async () => {
    const create = vi.fn().mockResolvedValue({
      text: "Move me from Boston to New York next month.",
    });
    const client = {
      audio: { transcriptions: { create } },
    } as unknown as Pick<OpenAI, "audio">;

    await expect(transcribeMoveAudio(audioFile(), client)).resolves.toBe(
      "Move me from Boston to New York next month.",
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        file: expect.any(File),
        model: "gpt-transcribe",
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("rejects unsupported formats before calling OpenAI", () => {
    expect(() => validateAudioFile(audioFile("text/plain"))).toThrow(
      "audio format is not supported",
    );
  });

  it("rejects recordings above the app upload limit", () => {
    const oversized = {
      size: MAX_AUDIO_BYTES + 1,
      type: "audio/webm",
    } as File;
    expect(() => validateAudioFile(oversized)).toThrow(
      "recording is too large",
    );
  });

  it("rejects an empty transcription", async () => {
    const client = {
      audio: {
        transcriptions: { create: vi.fn().mockResolvedValue({ text: "  " }) },
      },
    } as unknown as Pick<OpenAI, "audio">;
    await expect(
      transcribeMoveAudio(audioFile(), client),
    ).rejects.toMatchObject({ status: 422 });
  });
});
