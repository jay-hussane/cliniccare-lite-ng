import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, type AppRole } from "@/hooks/useCurrentUser";
import { statusLabel, OPEN_STATUSES } from "@/lib/queue";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Stethoscope,
  Receipt,
  Pill,
  ArrowRight,
  AlertTriangle,
  UserPlus,
  Send,
  ClipboardList,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { formatDate, formatNaira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ClinicCare Lite" },
      { name: "description", content: "Your role-based clinic dashboard: patient queue, consultations, payments and inventory alerts." },
    ],
  }),
  component: Dashboard,
});

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

type QueueItem = {
  id: string;
  status: string;
  paid: boolean;
  created_at: string;
  assigned_doctor: string | null;
  patients: { full_name: string; patient_code: string | null } | null;
  doctor: { full_name: string } | null;
};

function Dashboard() {
  const { data: me } = useCurrentUser();
  const role: AppRole = me?.role ?? "receptionist";
  const meId = me?.id ?? null;

  // Open patient queue entries (doctors get theirs, others get the full queue)
  const { data: queue = [] } = useQuery({
    queryKey: ["dashboard-queue", meId, role],
    enabled: !!meId,
    refetchInterval: 30_000,
    queryFn: async () => {
      let query = supabase
        .from("consultations")
        .select(
          "id, status, paid, created_at, assigned_doctor, patients(full_name, patient_code), doctor:profiles!consultations_assigned_doctor_fkey(full_name)",
        )
        .in("status", OPEN_STATUSES)
        .order("created_at", { ascending: true });
      if (role === "doctor") query = query.eq("assigned_doctor", meId!);
      const { data, error } = await query;
      if (error) throw error;
      return data as QueueItem[];
    },
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = startOfTodayISO();
      const [patients, consultsToday, bills, lowStock, staff, mineToday] = await Promise.all([
        supabase.from("patients").select("*", { count: "exact", head: true }),
        supabase.from("consultations").select("*", { count: "exact", head: true }).gte("created_at", today),
        supabase.from("billing").select("amount").gte("created_at", today),
        supabase.from("drugs").select("id, name, quantity, low_stock_threshold"),
        role === "admin"
          ? supabase.from("profiles").select("*", { count: "exact", head: true })
          : Promise.resolve({ count: null }),
        role === "doctor"
          ? supabase
              .from("consultations")
              .select("*", { count: "exact", head: true })
              .eq("assigned_doctor", meId!)
              .gte("created_at", today)
          : Promise.resolve({ count: null }),
      ]);
      const paymentsToday = (bills.data ?? []).reduce((s, b) => s + Number(b.amount), 0);
      const low = (lowStock.data ?? []).filter((d) => d.quantity <= d.low_stock_threshold);
      return {
        patients: patients.count ?? 0,
        consultationsToday: consultsToday.count ?? 0,
        paymentsToday,
        lowStock: low,
        staff: staff.count ?? 0,
        myVisitsToday: mineToday.count ?? 0,
      };
    },
  });

  const waitingForMe = queue.filter((q) => q.status === "waiting" && (!meId || q.assigned_doctor === meId)).length;

  const statCards: { label: string; value: string | number; icon: typeof Users; color: string; to: "/patients" | "/consultations" | "/billing" | "/drugs" | "/staff" }[] =
    role === "doctor"
      ? [
          { label: "Waiting for me", value: queue.filter((q) => q.status === "waiting").length, icon: Clock, color: "bg-warning/20 text-warning-foreground", to: "/consultations" },
          { label: "With me now", value: queue.filter((q) => q.status === "in_consultation").length, icon: Stethoscope, color: "bg-secondary/10 text-secondary", to: "/consultations" },
          { label: "My visits today", value: stats?.myVisitsToday ?? 0, icon: ClipboardList, color: "bg-primary/10 text-primary", to: "/consultations" },
        ]
      : role === "nurse"
        ? [
            { label: "Today's consultations", value: stats?.consultationsToday ?? 0, icon: Stethoscope, color: "bg-secondary/10 text-secondary", to: "/consultations" },
            { label: "Patients waiting", value: queue.length, icon: Clock, color: "bg-warning/20 text-warning-foreground", to: "/consultations" },
            { label: "Low stock drugs", value: stats?.lowStock.length ?? 0, icon: Pill, color: "bg-destructive/10 text-destructive", to: "/drugs" },
            { label: "Registered patients", value: stats?.patients ?? 0, icon: Users, color: "bg-primary/10 text-primary", to: "/patients" },
          ]
        : role === "receptionist"
          ? [
              { label: "Registered patients", value: stats?.patients ?? 0, icon: Users, color: "bg-primary/10 text-primary", to: "/patients" },
              { label: "Patients waiting", value: queue.length, icon: Clock, color: "bg-warning/20 text-warning-foreground", to: "/consultations" },
              { label: "Payments today", value: formatNaira(stats?.paymentsToday ?? 0), icon: Receipt, color: "bg-success/15 text-success", to: "/billing" },
              { label: "Low stock drugs", value: stats?.lowStock.length ?? 0, icon: Pill, color: "bg-destructive/10 text-destructive", to: "/drugs" },
            ]
          : [
              { label: "Total Patients", value: stats?.patients ?? 0, icon: Users, color: "bg-primary/10 text-primary", to: "/patients" },
              { label: "Today's Consultations", value: stats?.consultationsToday ?? 0, icon: Stethoscope, color: "bg-secondary/10 text-secondary", to: "/consultations" },
              { label: "Payments Today", value: formatNaira(stats?.paymentsToday ?? 0), icon: Receipt, color: "bg-success/15 text-success", to: "/billing" },
              { label: "Staff accounts", value: stats?.staff ?? 0, icon: ShieldCheck, color: "bg-accent/60 text-foreground", to: "/staff" },
            ];

  const roleTitle =
    role === "doctor"
      ? "Doctor's dashboard"
      : role === "nurse"
        ? "Nurse's dashboard"
        : role === "receptionist"
          ? "Reception desk"
          : "Administrator dashboard";
  const roleSubtitle =
    role === "doctor"
      ? "Your patient queue for today"
      : role === "nurse"
        ? "Consultations and drug stock at a glance"
        : role === "receptionist"
          ? "Register patients, send them to doctors and take payments"
          : "Full overview of the clinic";

  return (
    <>
      <PageHeader
        title={roleTitle}
        subtitle={`${roleSubtitle} · ${new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}`}
      />

      {/* Doctor: the queue is the main content. Nothing shows when there is no patient. */}
      {(role === "doctor" || role === "receptionist" || role === "admin") && (
        <QueueCard items={queue} role={role} meId={meId} />
      )}

      <div className={`grid gap-3 md:gap-5 ${role === "doctor" ? "grid-cols-3" : "grid-cols-2 lg:grid-cols-4"}`}>
        {statCards.map((s) => (
          <Link to={s.to} key={s.label}>
            <Card className="p-4 md:p-5 hover:shadow-card transition-shadow border-border h-full">
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

      {/* Receptionist: quick actions are the daily work */}
      {role === "receptionist" && (
        <Card className="mt-6 p-5">
          <h3 className="font-semibold mb-1">Quick actions</h3>
          <p className="text-sm text-muted-foreground mb-4">Common daily tasks</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <QuickAction to="/patients" title="Register patient" desc="Add a new patient record" icon={UserPlus} />
            <QuickAction to="/consultations" title="Send to doctor" desc="Put a patient in a doctor's queue" icon={Send} />
            <QuickAction to="/billing" title="Issue bill" desc="Create a payment receipt" icon={Receipt} />
          </div>
        </Card>
      )}

      {/* Nurse: inventory focus */}
      {role === "nurse" && (
        <Card className="mt-6 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-warning-foreground" />
            <h3 className="font-semibold">Low stock alerts</h3>
          </div>
          {(stats?.lowStock ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">All drugs are well stocked.</p>
          ) : (
            <ul className="space-y-2">
              {stats!.lowStock.slice(0, 6).map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{d.name}</span>
                  <span className={d.quantity === 0 ? "text-destructive font-semibold" : "text-warning-foreground font-semibold"}>
                    {d.quantity} left
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="secondary" size="sm" className="mt-4 gap-2">
            <Link to="/drugs">Open inventory</Link>
          </Button>
        </Card>
      )}

      {/* Admin: low stock panel */}
      {role === "admin" && (
        <div className="grid lg:grid-cols-3 gap-5 mt-6">
          <Card className="lg:col-span-2 p-5">
            <h3 className="font-semibold mb-1">Quick actions</h3>
            <p className="text-sm text-muted-foreground mb-4">Common daily tasks</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <QuickAction to="/patients" title="Register patient" desc="Add a new patient record" icon={UserPlus} />
              <QuickAction to="/consultations" title="Send to doctor" desc="Put a patient in a doctor's queue" icon={Send} />
              <QuickAction to="/staff" title="Manage staff" desc="Create, edit or disable accounts" icon={ShieldCheck} />
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-warning-foreground" />
              <h3 className="font-semibold">Low stock alerts</h3>
            </div>
            {(stats?.lowStock ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">All drugs are well stocked.</p>
            ) : (
              <ul className="space-y-2">
                {stats!.lowStock.slice(0, 6).map((d) => (
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
      )}

      {/* Doctors keep a light reminder of unpaid patients only */}
      {role === "doctor" && waitingForMe === 0 && (
        <Card className="mt-6 p-8 text-center text-muted-foreground">
          <ClipboardList className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          No patients waiting for you right now. You'll be notified here as soon as reception sends one over.
        </Card>
      )}
    </>
  );
}

function QueueCard({ items, role, meId }: { items: QueueItem[]; role: AppRole; meId: string | null }) {
  if (items.length === 0) return null;
  const heading =
    role === "doctor" ? "Patients waiting for you" : role === "receptionist" ? "Patient queue" : "Patient queue";
  return (
    <Card className="mb-5 p-4 md:p-5 border-primary/30 bg-primary-soft/50">
      <div className="flex items-center gap-2 mb-3">
        {role === "doctor" ? <Clock className="h-4 w-4 text-primary" /> : <ClipboardList className="h-4 w-4 text-primary" />}
        <h3 className="font-semibold text-primary">
          {heading} · {items.length}
        </h3>
      </div>
      <ul className="space-y-1.5 mb-3">
        {items.slice(0, 5).map((q) => (
          <li key={q.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">
              <span className="font-medium">{q.patients?.full_name ?? "Unknown patient"}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {q.patients?.patient_code}
                {role !== "doctor" && <> · Dr {q.doctor?.full_name ?? "—"}</>}
              </span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <Badge variant="outline">{statusLabel(q.status)}</Badge>
              <Badge variant={q.paid ? "secondary" : "destructive"}>{q.paid ? "Paid" : "Not paid"}</Badge>
            </span>
          </li>
        ))}
        {items.length > 5 && <li className="text-xs text-muted-foreground">+ {items.length - 5} more</li>}
      </ul>
      <Button asChild variant="secondary" size="sm" className="gap-2">
        <Link to="/consultations">{role === "doctor" ? "Open my queue" : "Open patient queue"}</Link>
      </Button>
      <span className="sr-only">{meId}</span>
    </Card>
  );
}

function QuickAction({
  to,
  title,
  desc,
  icon: Icon,
}: {
  to: "/patients" | "/consultations" | "/staff" | "/billing";
  title: string;
  desc: string;
  icon: typeof Users;
}) {
  return (
    <Link
      to={to}
      className="block rounded-xl border border-border p-4 hover:border-primary hover:bg-primary-soft/40 transition-colors"
    >
      <Icon className="h-5 w-5 text-primary" />
      <div className="font-medium text-foreground mt-2">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
    </Link>
  );
}
