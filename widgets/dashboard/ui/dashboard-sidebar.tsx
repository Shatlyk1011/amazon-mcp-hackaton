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
          className={`h-10 justify-start rounded-lg px-3 text-sm font-medium transition-colors ${active === label ? "bg-[#c9b4fa] text-[#1b1938] hover:bg-[#c9b4fa] hover:text-[#1b1938]" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
          onClick={() => onChange(label)}
        >
          <Icon className="size-4" data-icon="inline-start" />
          {label}
          {label === "MCP Explorer" && (
            <span className="ml-auto size-2 rounded-full bg-[#8be0b0]" />
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
    <aside className="hidden w-72 shrink-0 border-r border-[#3f3a52] bg-[#1b1938] px-5 py-7 text-white lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-2">
        <div className="grid size-10 place-items-center rounded-lg bg-[#c9b4fa] text-[#1b1938] shadow-[0_8px_24px_rgba(201,180,250,0.18)]">
          <Compass className="size-5" />
        </div>
        <div>
          <div className="font-semibold tracking-[-0.02em]">MoveFlow</div>
          <div className="text-[11px] tracking-[0.16em] text-white/45">
            RELOCATION OS
          </div>
        </div>
      </div>
      <div className="mt-12 px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
        Workspace
      </div>
      <div className="mt-4">
        <DashboardNav active={active} onChange={onChange} />
      </div>
      <div className="mt-auto rounded-xl border border-[#155555] bg-[#0e3030] p-5 text-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
        <div className="mb-8 flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-[0.16em] text-white/55">
            DEMO MODE
          </span>
          <Badge className="bg-[#c9b4fa] text-[#1b1938] hover:bg-[#c9b4fa]">
            LIVE MCP
          </Badge>
        </div>
        <p className="text-sm leading-6 text-white/70">
          Every action in this workspace runs through the MoveFlow MCP server.
        </p>
      </div>
    </aside>
  );
}
