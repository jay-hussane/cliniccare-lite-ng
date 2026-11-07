import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDate, formatNaira } from "@/lib/format";
import { isPaymentConfirmed, statusLabel } from "@/lib/queue";
import { useDoctors } from "@/hooks/useDoctors";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Search, Send, ClipboardList, Banknote, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/consultations")({
  head: () => ({
    meta: [
      { title: "Consultations — ClinicCare Lite" },
      { name: "description", content: "Send patients to doctors and record consultations, diagnosis, and prescriptions." },
    ],
  }),
  component: ConsultationsPage,
});

type QueueItem = {
  id: string;
  status: string;
  paid: boolean;
  created_at: string;
  patient_id: string;
  assigned_doctor: string | null;
  patients: { full_name: string; patient_code: string | null } | null;
  doctor: { full_name: string } | null;
};

type PatientOption = { id: string; full_name: string; patient_code: string | null; phone: string };

function ConsultationsPage() {
  const { data: me } = useCurrentUser();

  return (
    <>
      <PageHeader
        title="Consultations"
        subtitle="Send patients to a doctor, then record the visit notes, diagnosis and prescription"
      />
      <Tabs defaultValue="queue">
        <TabsList className="mb-4">
          <TabsTrigger value="queue">Patient queue</TabsTrigger>
          {me?.role !== "receptionist" && <TabsTrigger value="record">Record visit</TabsTrigger>}
        </TabsList>
        <TabsContent value="queue" className="mt-0">
          <QueueTab meId={me?.id ?? null} isAdmin={me?.isAdmin ?? false} role={me?.role ?? "receptionist"} />
        </TabsContent>
        {me?.role !== "receptionist" && (
          <TabsContent value="record" className="mt-0">
            <RecordVisitTab />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}

/* ---------------- Queue tab: send patients to doctors + live waiting list ---------------- */

function QueueTab({ meId, isAdmin, role }: { meId: string | null; isAdmin: boolean; role: string }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string>("");
  const [mineOnly, setMineOnly] = useState(role === "doctor");
  const [openVisit, setOpenVisit] = useState<QueueItem | null>(null);

  const { data: doctors = [], isLoading: doctorsLoading, isError: doctorsError } = useDoctors();

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-send", q],
    queryFn: async () => {
      let query = supabase
        .from("patients")
        .select("id, full_name, patient_code, phone")
        .order("created_at", { ascending: false })
        .limit(50);
      if (q.trim()) {
        const term = `%${q.trim()}%`;
        query = query.or(`full_name.ilike.${term},phone.ilike.${term},patient_code.ilike.${term}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as PatientOption[];
    },
  });

  const { data: queue = [] } = useQuery({
    queryKey: ["visit-queue"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultations")
        .select(
          "id, status, paid, created_at, patient_id, assigned_doctor, patients(full_name, patient_code), doctor:profiles!consultations_assigned_doctor_fkey(full_name)",
        )
        .in("status", ["waiting", "in_consultation"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as QueueItem[];
    },
  });

  const selected = patients.find((p) => p.id === patientId);

  const { data: paymentProof, isLoading: paymentLoading } = useQuery({
    queryKey: ["patient-payment-proof", selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      if (!selected?.id) return null;
      const { data, error } = await supabase
        .from("billing")
        .select("id, service_description, amount, payment_method, created_at")
        .eq("patient_id", selected.id)
        .gt("amount", 0)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const paymentConfirmed = paymentProof ? isPaymentConfirmed(Number(paymentProof.amount)) : false;
  const canAssign = role === "receptionist" || isAdmin;

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a patient");
      if (!doctorId) throw new Error("Choose the doctor to see the patient");
      if (!paymentConfirmed) throw new Error("Record a payment receipt before sending this patient to a doctor.");
      const doctor = doctors.find((d) => d.id === doctorId);
      const { error } = await supabase.from("consultations").insert({
        patient_id: selected.id,
        assigned_doctor: doctorId,
        status: "waiting",
      });
      if (error) throw error;
      return doctor?.full_name ?? "the doctor";
    },
    onSuccess: (doctorName) => {
      toast.success(`Patient sent to ${doctorName}`);
      setPatientId(null);
      setDoctorId("");
      qc.invalidateQueries({ queryKey: ["visit-queue"] });
      qc.invalidateQueries({ queryKey: ["doctor-banner"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["patient-payment-proof"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visible = queue.filter((item) => (mineOnly ? item.assigned_doctor === meId : true));

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      {canAssign && <Card className="p-5 h-fit">
        <div className="flex items-center gap-2 mb-1">
          <Send className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Send patient to doctor</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Select a patient with a recorded payment, then choose an active doctor to send them to the queue.
        </p>

        <Label>Patient</Label>
        <div className="relative mb-2 mt-1.5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search patient…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-11" />
        </div>
        <div className="max-h-40 overflow-y-auto border rounded-lg divide-y mb-4">
          {patients.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPatientId(p.id)}
              className={`w-full text-left px-3 py-2 text-sm ${patientId === p.id ? "bg-primary-soft" : "hover:bg-muted"}`}
            >
              <span className="font-medium">{p.full_name}</span>
              <span className="text-xs text-muted-foreground ml-2">{p.patient_code}</span>
            </button>
          ))}
          {patients.length === 0 && <div className="p-3 text-sm text-muted-foreground">No patients found.</div>}
        </div>

        {selected && (
          paymentLoading ? (
            <p className="mb-4 text-sm text-muted-foreground">Checking payment receipt…</p>
          ) : paymentConfirmed && paymentProof ? (
            <div className="mb-4 rounded-md border border-secondary/40 bg-secondary/10 px-3 py-2 text-sm text-secondary">
              Payment confirmed · {paymentProof.service_description} · {formatNaira(paymentProof.amount)} · {paymentProof.payment_method}
            </div>
          ) : (
            <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              A payment receipt is required before assignment. <Link to="/billing" className="font-medium underline">Open Billing</Link> to record payment.
            </div>
          )
        )}

        <Label>Doctor</Label>
        <Select value={doctorId} onValueChange={setDoctorId} disabled={doctorsLoading || doctors.length === 0}>
          <SelectTrigger className="h-11 mt-1.5 mb-4 w-full">
            <SelectValue placeholder="Choose a doctor" />
          </SelectTrigger>
          <SelectContent>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {doctorsError ? (
          <p className="-mt-3 mb-4 text-sm text-destructive">Unable to load doctors. Refresh and try again.</p>
        ) : !doctorsLoading && doctors.length === 0 ? (
          <p className="-mt-3 mb-4 text-sm text-muted-foreground">No active doctor accounts are available.</p>
        ) : null}

        <Button
          size="lg"
          className="w-full gap-2"
          disabled={sendMutation.isPending || !selected || !doctorId || !paymentConfirmed || paymentLoading || doctorsLoading || doctors.length === 0}
          onClick={() => sendMutation.mutate()}
        >
          <Send className="h-4 w-4" />
          {sendMutation.isPending ? "Sending…" : !selected ? "Select a patient" : !paymentConfirmed ? "Confirm payment first" : !doctorId ? "Choose a doctor" : `Send ${selected.full_name} to doctor`}
        </Button>
      </Card>}

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-secondary" />
            <h3 className="font-semibold">Waiting patients</h3>
            <Badge variant="secondary">{visible.length}</Badge>
          </div>
          {(role === "doctor" || isAdmin) && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={mineOnly}
                onChange={(e) => setMineOnly(e.target.checked)}
                className="accent-[hsl(var(--primary))]"
              />
              Mine only
            </label>
          )}
        </div>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No patients waiting.</p>
        ) : (
          <ul className="divide-y -mx-2">
            {visible.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setOpenVisit(item)}
                  className="w-full text-left px-2 py-3 hover:bg-muted/60 rounded-lg transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{item.patients?.full_name ?? "Unknown patient"}</span>
                    <Badge variant={item.paid ? "secondary" : "destructive"}>
                      {item.paid ? "Paid" : "Not paid"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                    <span>{item.patients?.patient_code}</span>
                    <span>· Dr {item.doctor?.full_name ?? "—"}</span>
                    <span>· {statusLabel(item.status)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formatDate(item.created_at)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <VisitWorkspaceDialog item={openVisit} onClose={() => setOpenVisit(null)} canAttend={role !== "receptionist"} />
    </div>
  );
}

/* ---------------- Visit workspace dialog: payment status, patient payments, notes ---------------- */

function VisitWorkspaceDialog({
  item,
  onClose,
  canAttend,
}: {
  item: QueueItem | null;
  onClose: () => void;
  canAttend: boolean;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ notes: "", diagnosis: "", prescription: "" });

  const { data: payments = [] } = useQuery({
    queryKey: ["visit-patient-bills", item?.patient_id],
    enabled: !!item,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing")
        .select("id, service_description, amount, payment_method, created_at")
        .eq("patient_id", item!.patient_id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["visit-queue"] });
    qc.invalidateQueries({ queryKey: ["doctor-banner"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const startMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("consultations").update({ status: "in_consultation" }).eq("id", item!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Consultation started");
      invalidate();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.notes.trim() && !form.diagnosis.trim() && !form.prescription.trim()) {
        throw new Error("Fill at least one field before completing");
      }
      const { error } = await supabase
        .from("consultations")
        .update({
          notes: form.notes || null,
          diagnosis: form.diagnosis || null,
          prescription: form.prescription || null,
          status: "completed",
        })
        .eq("id", item!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Consultation completed");
      setForm({ notes: "", diagnosis: "", prescription: "" });
      invalidate();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item?.patients?.full_name ?? "Patient visit"}</DialogTitle>
        </DialogHeader>
        {item && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {item.patients?.patient_code} · Dr {item.doctor?.full_name ?? "—"} · sent {formatDate(item.created_at)}
              <Badge variant="outline" className="ml-2">{statusLabel(item.status)}</Badge>
            </div>

            {!item.paid && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-sm px-3 py-2 flex items-center gap-2">
                <Banknote className="h-4 w-4 shrink-0" />
                This patient has not paid yet. Confirm payment at billing before attending.
              </div>
            )}

            {canAttend && item.status === "waiting" && (
              <Button
                variant="secondary"
                className="w-full"
                disabled={startMutation.isPending}
                onClick={() => startMutation.mutate()}
              >
                {startMutation.isPending ? "Starting…" : "Start consultation"}
              </Button>
            )}

            {canAttend && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveMutation.mutate();
                }}
              >
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    rows={4}
                    className="mt-1.5"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Chief complaint, examination findings…"
                  />
                </div>
                <div>
                  <Label>Diagnosis</Label>
                  <Input
                    className="h-11 mt-1.5"
                    value={form.diagnosis}
                    onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                    placeholder="e.g. Malaria"
                  />
                </div>
                <div>
                  <Label>Prescription</Label>
                  <Textarea
                    rows={3}
                    className="mt-1.5"
                    value={form.prescription}
                    onChange={(e) => setForm({ ...form, prescription: e.target.value })}
                    placeholder="Drug · dose · duration"
                  />
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving…" : "Save & complete visit"}
                </Button>
              </form>
            )}

            <div>
              <h4 className="font-semibold text-sm mb-2">Patient's recent payments</h4>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded for this patient.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {payments.map((b) => (
                    <li key={b.id} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate">{b.service_description}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(b.created_at)} · {b.payment_method}
                        </div>
                      </div>
                      <span className="font-medium whitespace-nowrap">{formatNaira(b.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Record tab: direct consultation entry (walk-in / past visits) ---------------- */

function RecordVisitTab() {
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-quick", q],
    queryFn: async () => {
      let query = supabase
        .from("patients")
        .select("id, full_name, patient_code, phone")
        .order("created_at", { ascending: false })
        .limit(50);
      if (q.trim()) {
        const term = `%${q.trim()}%`;
        query = query.or(`full_name.ilike.${term},phone.ilike.${term},patient_code.ilike.${term}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as PatientOption[];
    },
  });

  const selected = patients.find((p) => p.id === selectedId);

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-5">
      <Card className="p-3 md:p-4 h-fit">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search patient…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-11" />
        </div>
        <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
          {patients.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  selectedId === p.id ? "bg-primary-soft text-primary font-medium" : "hover:bg-muted"
                }`}
              >
                <div className="font-medium">{p.full_name}</div>
                <div className="text-xs text-muted-foreground">{p.patient_code} · {p.phone}</div>
              </button>
            </li>
          ))}
          {patients.length === 0 && <li className="text-sm text-muted-foreground p-2">No patients found.</li>}
        </ul>
      </Card>

      <div>
        {!selected ? (
          <Card className="p-10 text-center text-muted-foreground">Select a patient to start.</Card>
        ) : (
          <RecordWorkspace patientId={selected.id} patientName={selected.full_name} />
        )}
      </div>
    </div>
  );
}

function RecordWorkspace({ patientId, patientName }: { patientId: string; patientName: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ notes: "", diagnosis: "", prescription: "" });

  const { data: history = [] } = useQuery({
    queryKey: ["consults", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultations")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.notes.trim() && !form.diagnosis.trim() && !form.prescription.trim()) {
        throw new Error("Please fill at least one field");
      }
      const { error } = await supabase.from("consultations").insert({
        patient_id: patientId,
        notes: form.notes || null,
        diagnosis: form.diagnosis || null,
        prescription: form.prescription || null,
        status: "completed",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Consultation saved");
      setForm({ notes: "", diagnosis: "", prescription: "" });
      qc.invalidateQueries({ queryKey: ["consults", patientId] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid md:grid-cols-2 gap-5">
      <Card className="p-5">
        <h3 className="font-semibold">{patientName}</h3>
        <p className="text-xs text-muted-foreground mb-4">Record a visit directly (no queue entry)</p>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div>
            <Label>Notes</Label>
            <Textarea rows={5} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Chief complaint, examination findings…" />
          </div>
          <div>
            <Label>Diagnosis</Label>
            <Input className="h-11" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder="e.g. Malaria" />
          </div>
          <div>
            <Label>Prescription</Label>
            <Textarea rows={4} value={form.prescription} onChange={(e) => setForm({ ...form, prescription: e.target.value })} placeholder="Drug · dose · duration" />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save consultation"}
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Previous consultations</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No previous consultations.</p>
        ) : (
          <ul className="divide-y max-h-[60vh] overflow-y-auto">
            {history.map((c) => (
              <li key={c.id} className="py-3">
                <div className="text-xs text-muted-foreground">{formatDate(c.created_at)}</div>
                {c.diagnosis && <div className="font-medium mt-1">Diagnosis: {c.diagnosis}</div>}
                {c.notes && <div className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{c.notes}</div>}
                {c.prescription && <div className="text-sm mt-1"><span className="text-muted-foreground">Rx:</span> <span className="whitespace-pre-line">{c.prescription}</span></div>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
