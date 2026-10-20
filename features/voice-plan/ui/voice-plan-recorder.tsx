"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  LoaderCircle,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { VoicePoweredOrb } from "./voice-powered-orb";

type RecorderState = "idle" | "recording" | "transcribing" | "review";

const MAX_RECORDING_MS = 120_000;

function preferredMimeType() {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return options.find((type) => MediaRecorder.isTypeSupported(type));
}

function audioFilename(mimeType: string) {
  return mimeType.includes("mp4") ? "move-request.mp4" : "move-request.webm";
}

export function VoicePlanRecorder({
  pending,
  onSubmit,
  serverError,
  contextControls,
  compact = false,
  idleHeading = "Tell us about your move",
  description = "Start with where you want to move. We’ll ask a few quick questions for anything missing before building your plan.",
  textareaPlaceholder = "I’m moving from Boston to New York in December…",
  submitLabel = "Continue",
}: {
  pending: boolean;
  onSubmit: (prompt: string) => void | Promise<void>;
  serverError?: string;
  contextControls?: ReactNode;
  compact?: boolean;
  idleHeading?: string;
  description?: string;
  textareaPlaceholder?: string;
  submitLabel?: string;
}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [transcript, setTranscript] = useState("");
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string>();
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const recordingTimeoutRef = useRef<number | undefined>(undefined);
  const transcriptionControllerRef = useRef<AbortController | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrlRef = useRef<string | undefined>(undefined);

  const stopCapture = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (animationFrameRef.current)
      cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = undefined;
    if (recordingTimeoutRef.current)
      window.clearTimeout(recordingTimeoutRef.current);
    recordingTimeoutRef.current = undefined;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setVoiceLevel(0);
  }, []);

  const transcribeRecording = useCallback(async (blob: Blob) => {
    if (!blob.size) {
      setError("No audio was captured. Please record your request again.");
      setState("idle");
      return;
    }

    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const nextUrl = URL.createObjectURL(blob);
    audioUrlRef.current = nextUrl;
    setAudioUrl(nextUrl);

    const controller = new AbortController();
    transcriptionControllerRef.current = controller;
    try {
      const formData = new FormData();
      formData.append("audio", blob, audioFilename(blob.type));
      const response = await fetch("/api/audio/transcribe", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const data = (await response.json()) as {
        text?: string;
        error?: string;
      };
      if (!response.ok || !data.text)
        throw new Error(
          data.error || "The recording could not be transcribed.",
        );
      setTranscript(data.text);
      setState("review");
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "The recording could not be transcribed.",
      );
      setState("review");
    } finally {
      if (transcriptionControllerRef.current === controller)
        transcriptionControllerRef.current = null;
    }
  }, []);

  const finishRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    setState("transcribing");
    recorder.stop();
    mediaRecorderRef.current = null;
    stopCapture();
  }, [stopCapture]);

  useEffect(
    () => () => {
      transcriptionControllerRef.current?.abort();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      stopCapture();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    [stopCapture],
  );

  const beginRecording = useCallback(async () => {
    setError(undefined);
    transcriptionControllerRef.current?.abort();
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(
        "Voice recording is not supported in this browser. Use the form below instead.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = undefined;
        setAudioUrl(undefined);
      }
      setTranscript("");

      const mimeType = preferredMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        recorder.onstop = null;
        stopCapture();
        setError("Recording stopped unexpectedly. Please try again.");
        setState("idle");
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        void transcribeRecording(blob);
      };
      recorder.start(250);

      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioContextClass) {
        const context = new AudioContextClass();
        audioContextRef.current = context;
        if (context.state === "suspended") await context.resume();
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.55;
        context.createMediaStreamSource(stream).connect(analyser);
        const values = new Uint8Array(analyser.frequencyBinCount);
        const analyze = () => {
          analyser.getByteFrequencyData(values);
          let sum = 0;
          for (const value of values) sum += (value / 255) ** 2;
          setVoiceLevel(Math.min(Math.sqrt(sum / values.length) * 4, 1));
          animationFrameRef.current = requestAnimationFrame(analyze);
        };
        analyze();
      }

      setState("recording");
      recordingTimeoutRef.current = window.setTimeout(
        finishRecording,
        MAX_RECORDING_MS,
      );
    } catch (cause) {
      stopCapture();
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Microphone access was blocked. Allow access or use the form below."
          : "The microphone could not be started. Try again or use the form below.",
      );
    }
  }, [finishRecording, stopCapture, transcribeRecording]);

  async function restartRecording() {
    transcriptionControllerRef.current?.abort();
    audioRef.current?.pause();
    setPlaying(false);
    setState("idle");
    await beginRecording();
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  async function submitPrompt() {
    const prompt = transcript.trim();
    if (prompt.length < 8) {
      setError(
        "Add a little more detail—at minimum, say where you are moving from and to.",
      );
      return;
    }
    setError(undefined);
    await onSubmit(prompt);
  }

  const statusText =
    state === "recording"
      ? "Listening…"
      : state === "transcribing"
        ? "Transcribing your move…"
        : state === "review"
          ? "Your request is ready"
          : idleHeading;
  const Heading = compact ? "h3" : "h1";

  return (
    <Card
      aria-labelledby="voice-plan-title"
      className={compact ? "rounded-xl py-5" : "rounded-3xl py-8 sm:py-10"}
    >
      <CardHeader
        className={
          compact ? "w-full text-left" : "mx-auto w-full max-w-xl text-center"
        }
      >
        <p className="font-mono text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Voice plan
        </p>
        <CardTitle>
          <Heading
            id="voice-plan-title"
            className={
              compact
                ? "text-lg tracking-[-0.02em]"
                : "text-2xl tracking-[-0.04em] sm:text-3xl"
            }
          >
            {statusText}
          </Heading>
        </CardTitle>
        <CardDescription
          className={
            compact ? "max-w-2xl leading-5" : "mx-auto max-w-lg leading-6"
          }
        >
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent
        className={
          compact ? "flex flex-col gap-4" : "flex flex-col items-center"
        }
      >
        <div
          className={
            compact
              ? "relative mx-auto aspect-square w-28"
              : "relative aspect-square w-full max-w-80 sm:max-w-96"
          }
        >
          <div className="absolute inset-[12%] rounded-full bg-primary/5 blur-3xl" />
          <VoicePoweredOrb
            active={state === "recording"}
            voiceLevel={voiceLevel}
            className="relative"
          />
          <div
            aria-live="polite"
            className={
              compact
                ? "absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border border-border/50 bg-background/85 px-2 py-1 text-[10px] font-medium shadow-sm backdrop-blur"
                : "absolute bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/50 bg-background/85 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur"
            }
          >
            {state === "transcribing" ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : state === "recording" ? (
              <span className="size-1.5 rounded-full bg-destructive" />
            ) : (
              <span className="size-1.5 rounded-full bg-muted-foreground" />
            )}
            {state === "recording"
              ? "Listening"
              : state === "transcribing"
                ? "Creating transcript"
                : state === "review"
                  ? "Ready to review"
                  : "Ready"}
          </div>
        </div>

        <div
          className={
            compact
              ? "flex min-h-8 flex-wrap items-center justify-center gap-2"
              : "mt-2 flex min-h-11 flex-wrap items-center justify-center gap-2"
          }
        >
          {state === "idle" ? (
            <>
              <Button
                type="button"
                size={compact ? "default" : "lg"}
                className={
                  compact ? "rounded-full" : "h-11 rounded-full px-6 text-sm"
                }
                onClick={beginRecording}
                disabled={pending}
              >
                <Mic data-icon="inline-start" />
                {compact ? "Speak" : "Start speaking"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size={compact ? "default" : "lg"}
                className={
                  compact ? "rounded-full" : "h-11 rounded-full px-6 text-sm"
                }
                disabled={pending}
                onClick={() => setState("review")}
              >
                Type instead
              </Button>
            </>
          ) : null}
          {state === "recording" ? (
            <Button
              type="button"
              size={compact ? "default" : "lg"}
              className={
                compact ? "rounded-full" : "h-11 rounded-full px-6 text-sm"
              }
              onClick={finishRecording}
            >
              <Square data-icon="inline-start" />
              Stop speaking
            </Button>
          ) : null}
        </div>

        {state === "review" ? (
          <div className={compact ? "w-full" : "mt-7 w-full max-w-xl"}>
            <Field data-disabled={pending || undefined}>
              <FieldLabel htmlFor="voice-plan-transcript">
                Review your request
              </FieldLabel>
              <Textarea
                id="voice-plan-transcript"
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder={textareaPlaceholder}
                className={
                  compact
                    ? "min-h-24 bg-background p-3 text-sm leading-6"
                    : "min-h-32 bg-background p-3 text-base leading-6 sm:text-sm"
                }
                disabled={pending}
              />
              <FieldDescription>
                {audioUrl
                  ? "Edit your transcript, then continue to move setup."
                  : "Describe your move, then we’ll ask for any missing details."}
              </FieldDescription>
            </Field>
          </div>
        ) : null}

        {contextControls}

        {error || serverError ? (
          <Alert
            variant="destructive"
            className={compact ? "max-w-none" : "mt-5 max-w-xl"}
          >
            <AlertDescription>{error || serverError}</AlertDescription>
          </Alert>
        ) : null}

        {state === "review" ? (
          <div
            className={
              compact
                ? "flex w-full flex-col gap-4"
                : "mt-7 flex w-full max-w-xl flex-col gap-4"
            }
          >
            <div
              className={
                compact
                  ? "flex flex-wrap gap-2"
                  : "flex flex-wrap gap-2 sm:justify-center"
              }
            >
              <Button
                type="button"
                variant="outline"
                size={compact ? "default" : "lg"}
                className={
                  compact ? "rounded-full" : "h-11 rounded-full px-4 text-sm"
                }
                onClick={togglePlayback}
                disabled={!audioUrl || pending}
              >
                {playing ? (
                  <Pause data-icon="inline-start" />
                ) : (
                  <Play data-icon="inline-start" />
                )}
                {playing ? "Pause" : "Play recording"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size={compact ? "default" : "lg"}
                className={
                  compact ? "rounded-full" : "h-11 rounded-full px-4 text-sm"
                }
                onClick={restartRecording}
                disabled={pending}
              >
                <RotateCcw data-icon="inline-start" />
                Restart
              </Button>
              <Button
                type="button"
                size={compact ? "default" : "lg"}
                className={
                  compact ? "rounded-full" : "h-11 rounded-full px-5 text-sm"
                }
                onClick={submitPrompt}
                disabled={pending}
              >
                {pending ? "Sending request…" : submitLabel}
                {!pending ? <ArrowRight data-icon="inline-end" /> : null}
              </Button>
            </div>
          </div>
        ) : null}

        {audioUrl ? (
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setPlaying(false)}
            onPause={() => setPlaying(false)}
          />
        ) : null}
      </CardContent>

      <CardFooter
        className={compact ? "text-left" : "justify-center text-center"}
      >
        <p className="max-w-lg text-xs leading-5 text-muted-foreground">
          Your recording is sent to OpenAI for transcription. MoveFlow does not
          save the audio file; only the reviewed text is saved with your plan.
        </p>
      </CardFooter>
    </Card>
  );
}
