"use client";
import {
  Building2,
  CircleDollarSign,
  Compass,
  GitBranch,
  Home,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
const items = [
  ["Overview", Home],
  ["Housing", Building2],
  ["Moving Services", Truck],
  ["Budget", CircleDollarSign],
  ["MCP Explorer", GitBranch],
] as const;
export function DashboardNav({
  active,
  onChange,
}: {
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <nav className="flex flex-col gap-1.5">
      {items.map(([label, Icon]) => (
        <Button
          key={label}
          variant="ghost"
          className={`h-10 justify-start rounded-md px-3 text-sm font-medium transition-colors ${active === label ? "bg-[#171717] text-white hover:bg-[#171717]/85 hover:text-white" : "text-[#4d4d4d] hover:bg-[#f2f2f2] hover:text-[#171717]"}`}
          onClick={() => onChange(label)}
        >
          <Icon className="size-4" data-icon="inline-start" />
          {label}
          {label === "MCP Explorer" && (
            <span className="ml-auto size-2 rounded-full bg-[#0070f3]" />
          )}
        </Button>
      ))}
    </nav>
  );
}
export function DashboardSidebar({
  active,
  onChange,
}: {
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-[#ebebeb] bg-white px-5 py-7 text-[#171717] lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-2">
        <div className="grid size-9 place-items-center rounded-md bg-[#171717] text-white">
          <Compass className="size-5" />
        </div>
        <div>
          <div className="font-semibold tracking-[-0.02em]">MoveFlow</div>
          <div className="font-mono text-[11px] tracking-normal text-[#8f8f8f]">
            RELOCATION OS
          </div>
        </div>
      </div>
      <div className="mt-12 px-2 font-mono text-[11px] font-medium uppercase tracking-normal text-[#8f8f8f]">
        Workspace
      </div>
      <div className="mt-4">
        <DashboardNav active={active} onChange={onChange} />
      </div>
      <div className="mt-auto rounded-xl border border-[#ebebeb] bg-[#fafafa] p-5 text-[#171717]">
        <div className="mb-8 flex items-center justify-between">
          <span className="font-mono text-[11px] font-medium tracking-normal text-[#8f8f8f]">
            DEMO MODE
          </span>
          <Badge className="bg-[#d3e5ff] text-[#0761d1] hover:bg-[#d3e5ff]">
            LIVE MCP
          </Badge>
        </div>
        <p className="text-sm leading-6 text-[#4d4d4d]">
          Every action in this workspace runs through the MoveFlow MCP server.
        </p>
      </div>
    </aside>
  );
}
