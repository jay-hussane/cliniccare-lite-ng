import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { statusLabel } from "@/lib/queue";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Users, Stethoscope, Receipt, Pill, ArrowRight, AlertTriangle } from "lucide-react";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ClinicCare Lite" },
      { name: "description", content: "Daily clinic overview: patients, consultations, payments and inventory alerts." },
    ],
  }),
  component: Dashboard,
});

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = startOfTodayISO();
      const [patients, consults, bills, lowStock] = await Promise.all([
        supabase.from("patients").select("*", { count: "exact", head: true }),
        supabase.from("consultations").select("*", { count: "exact", head: true }).gte("created_at", today),
        supabase.from("billing").select("amount").gte("created_at", today),
        supabase.from("drugs").select("id, name, quantity, low_stock_threshold"),
      ]);
      const paymentsToday = (bills.data ?? []).reduce((s, b) => s + Number(b.amount), 0);
      const low = (lowStock.data ?? []).filter((d) => d.quantity <= d.low_stock_threshold);
      return {
        patients: patients.count ?? 0,
        consultations: consults.count ?? 0,
        paymentsToday,
        lowStock: low,
      };
    },
  });

  const stats = [
    { label: "Total Patients", value: data?.patients ?? 0, icon: Users, color: "bg-primary/10 text-primary", to: "/patients" as const },
    { label: "Today's Consultations", value: data?.consultations ?? 0, icon: Stethoscope, color: "bg-secondary/10 text-secondary", to: "/consultations" as const },
    { label: "Payments Today", value: formatNaira(data?.paymentsToday ?? 0), icon: Receipt, color: "bg-success/15 text-success", to: "/billing" as const },
    { label: "Low Stock Drugs", value: data?.lowStock.length ?? 0, icon: Pill, color: "bg-warning/20 text-warning-foreground", to: "/drugs" as const },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back · ${new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        {stats.map((s) => (
          <Link to={s.to} key={s.label}>
            <Card className="p-4 md:p-5 hover:shadow-card transition-shadow border-border">
              <div className="flex items-start justify-between gap-3">
                <div className={`h-10 w-10 rounded-xl grid place-items-center ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-4">
                <div className="text-2xl md:text-3xl font-semibold text-foreground">
                  {isLoading ? "—" : s.value}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground mt-1">{s.label}</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mt-6">
        <Card className="lg:col-span-2 p-5">
          <h3 className="font-semibold mb-1">Quick actions</h3>
          <p className="text-sm text-muted-foreground mb-4">Common daily tasks</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <QuickAction to="/patients" title="Register patient" desc="Add a new patient record" />
            <QuickAction to="/consultations" title="New consultation" desc="Record a visit" />
            <QuickAction to="/billing" title="Issue bill" desc="Create a payment receipt" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-warning-foreground" />
            <h3 className="font-semibold">Low stock alerts</h3>
          </div>
          {(data?.lowStock ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">All drugs are well stocked.</p>
          ) : (
            <ul className="space-y-2">
              {data!.lowStock.slice(0, 6).map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{d.name}</span>
                  <span className={d.quantity === 0 ? "text-destructive font-semibold" : "text-warning-foreground font-semibold"}>
                    {d.quantity} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function QuickAction({ to, title, desc }: { to: "/patients" | "/consultations" | "/billing"; title: string; desc: string }) {
  return (
    <Link to={to} className="block rounded-xl border border-border p-4 hover:border-primary hover:bg-primary-soft/40 transition-colors">
      <div className="font-medium text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
    </Link>
  );
}
