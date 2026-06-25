import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Receipt,
  Pill,
  HeartPulse,
  LogOut,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/consultations", label: "Consultations", icon: Stethoscope },
  { to: "/billing", label: "Billing", icon: Receipt },
  { to: "/drugs", label: "Inventory", icon: Pill },
] as const;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-card">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-sidebar-foreground">ClinicCare Lite</div>
            <div className="text-[11px] text-muted-foreground">Clinic Management</div>
          </div>
        </div>
        <nav className="p-3 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive(to)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60",
              )}
            >
              <Icon className="h-4.5 w-4.5" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-3 space-y-2">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
          >
            <LogOut className="h-4.5 w-4.5" />
            <span>Sign out</span>
          </button>
          <div className="px-3 text-[11px] text-muted-foreground">MVP build · v0.1</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden h-14 flex items-center justify-between gap-2 px-4 border-b bg-card">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <HeartPulse className="h-4 w-4" />
            </div>
            <div className="font-semibold">ClinicCare Lite</div>
          </div>
          <button onClick={handleSignOut} aria-label="Sign out" className="p-2 text-muted-foreground hover:text-foreground">
            <LogOut className="h-5 w-5" />
          </button>
        </header>


        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-x-hidden">
          <div className="max-w-7xl mx-auto w-full">{children}</div>
        </main>

        {/* Bottom nav (mobile) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t z-40">
          <ul className="grid grid-cols-5">
            {nav.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium",
                    isActive(to) ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
