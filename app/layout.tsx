import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "./globals.css";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "MoveFlow — AI relocation assistant",
  description: "A calmer way to move forward.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fontVariables = {
    "--font-sans":
      '"Inter", "SF Pro Display", ui-sans-serif, system-ui, sans-serif',
    "--font-geist-mono":
      '"SFMono-Regular", "Roboto Mono", ui-monospace, monospace',
  } as CSSProperties;

  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", "font-sans")}
      style={fontVariables}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
