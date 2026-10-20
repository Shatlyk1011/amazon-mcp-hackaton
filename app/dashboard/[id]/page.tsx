import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/plans/session";
import { getPlan, listRequests } from "@/lib/plans/repository";
import { PlanError } from "@/lib/plans/errors";
import { PlanWorkspace } from "@/widgets/dashboard/ui/plan-workspace";
import { Skeleton } from "@/components/ui/skeleton";

async function SavedDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data;
  try {
    const { owner } = await getSession();
    const [plan, requests] = await Promise.all([
      getPlan(id, owner),
      listRequests(id, owner),
    ]);
    data = { plan, requests };
  } catch (error) {
    if (error instanceof PlanError && error.status === 404) notFound();
    throw error;
  }
  return (
    <PlanWorkspace initialPlan={data.plan} initialRequests={data.requests} />
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-6xl p-8">
          <p className="mb-6">Loading your saved plan…</p>
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <SavedDashboard params={params} />
    </Suspense>
  );
}
