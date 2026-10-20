"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 p-8">
      <h1 className="text-2xl font-semibold">Could not load your saved plan</h1>
      <p>Check the database configuration and connection, then try again.</p>
      <Button onClick={reset}>Try again</Button>
      <Link href="/" className="underline">
        Back to the form
      </Link>
    </main>
  );
}
