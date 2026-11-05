import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDate, formatNaira } from "@/lib/format";
import { Banknote, Building2, Printer, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing — ClinicCare Lite" },
      { name: "description", content: "Create bills and receipts; track payments." },
    ],
  }),
  component: BillingPage,
});

type Receipt = {
  patient_name: string;
  patient_code: string;
  service_description: string;
  amount: number;
  payment_method: string;
  created_at: string;
};

function BillingPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [form, setForm] = useState({ service: "", amount: "", method: "Cash" });
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-bill", q],
    queryFn: async () => {
      let query = supabase.from("patients").select("id, full_name, patient_code, phone").order("created_at", { ascending: false }).limit(50);
      if (q.trim()) {
        const term = `%${q.trim()}%`;
        query = query.or(`full_name.ilike.${term},phone.ilike.${term},patient_code.ilike.${term}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["bills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing")
        .select("id, service_description, amount, payment_method, created_at, patients(full_name, patient_code)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const selected = patients.find((p) => p.id === patientId);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a patient");
      if (!form.service.trim()) throw new Error("Service description required");
      const amt = Number(form.amount);
      if (!amt || amt <= 0) throw new Error("Enter a valid amount");

      const { data, error } = await supabase.from("billing").insert({
        patient_id: selected.id,
        service_description: form.service.trim(),
        amount: amt,
        payment_method: form.method,
      }).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Payment recorded");
      setReceipt({
        patient_name: selected!.full_name,
        patient_code: selected!.patient_code ?? "",
        service_description: data.service_description,
        amount: Number(data.amount),
        payment_method: data.payment_method,
        created_at: data.created_at,
      });
      setForm({ service: "", amount: "", method: "Cash" });
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["visit-queue"] });
      qc.invalidateQueries({ queryKey: ["visit-patient-bills"] });

    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Billing" subtitle="Create a bill and print a receipt" />

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="font-semibold mb-3">New bill</h3>

          <Label>Patient</Label>
          <div className="relative mb-2">
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
            {patients.length === 0 && <div className="p-3 text-sm text-muted-foreground">No patients.</div>}
          </div>

          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
            <div>
              <Label>Service description</Label>
              <Textarea rows={2} value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} placeholder="e.g. Consultation + Lab test" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (₦)</Label>
                <Input className="h-11" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <Label>Payment method</Label>
                <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button type="submit" size="lg" disabled={mutation.isPending} className="gap-2">
                <Banknote className="h-4 w-4" /> Record payment
              </Button>
              <Button type="button" size="lg" variant="secondary" disabled={mutation.isPending}
                onClick={() => { setForm({ ...form, method: "Bank Transfer" }); mutation.mutate(); }} className="gap-2">
                <Building2 className="h-4 w-4" /> Transfer
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Receipt</h3>
            {receipt && (
              <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
                <Printer className="h-4 w-4" /> Print
              </Button>
            )}
          </div>
          {!receipt ? (
            <p className="text-sm text-muted-foreground">Record a payment to preview a receipt.</p>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-border p-5 bg-accent/40">
              <div className="text-center mb-4">
                <div className="font-semibold text-lg text-primary">ClinicCare Lite</div>
                <div className="text-xs text-muted-foreground">Payment Receipt</div>
              </div>
              <dl className="text-sm space-y-1.5">
                <Row label="Date" value={formatDate(receipt.created_at)} />
                <Row label="Patient" value={`${receipt.patient_name} (${receipt.patient_code})`} />
                <Row label="Service" value={receipt.service_description} />
                <Row label="Method" value={receipt.payment_method} />
              </dl>
              <div className="border-t mt-3 pt-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total paid</span>
                <span className="text-xl font-semibold text-secondary">{formatNaira(receipt.amount)}</span>
              </div>
              <div className="text-center text-[11px] text-muted-foreground mt-4">Thank you. Get well soon.</div>
            </div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="font-semibold mb-3">Recent payments</h3>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Patient</th>
                    <th className="py-2 pr-4">Service</th>
                    <th className="py-2 pr-4">Method</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((b: any) => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{formatDate(b.created_at)}</td>
                      <td className="py-2 pr-4">{b.patients?.full_name ?? "—"}</td>
                      <td className="py-2 pr-4">{b.service_description}</td>
                      <td className="py-2 pr-4">{b.payment_method}</td>
                      <td className="py-2 text-right font-medium">{formatNaira(b.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}
