"use client";

import { Compass } from "lucide-react";
import type { ReactNode } from "react";
import { VoicePlanRecorder } from "@/features/voice-plan/ui/voice-plan-recorder";

export function LandingPage({
  onPromptSubmit,
  pending = false,
  error,
  contextControls,
  resumeControl,
}: {
  onPromptSubmit: (prompt: string) => void | Promise<void>;
  pending?: boolean;
  error?: string;
  contextControls?: ReactNode;
  resumeControl?: ReactNode;
}) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fafafa] text-[#171717]">
      <header className="mx-auto flex max-w-6xl items-center border-b border-[#ebebeb] px-6 py-5 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-md bg-[#171717] text-white">
            <Compass className="size-5" />
          </div>
          <span className="text-base font-semibold tracking-[-0.02em]">
            MoveFlow
          </span>
        </div>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:pb-24">
        {resumeControl}
        <VoicePlanRecorder
          onSubmit={onPromptSubmit}
          pending={pending}
          serverError={error}
          contextControls={contextControls}
        />
      </div>
    </main>
  );
}
