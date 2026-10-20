import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 p-8">
      <h1 className="text-2xl font-semibold">Plan not found</h1>
      <p>
        Open this plan in the browser where you created it, or start a new
        moving plan.
      </p>
      <Link href="/" className="underline">
        Create a moving plan
      </Link>
    </main>
  );
}
