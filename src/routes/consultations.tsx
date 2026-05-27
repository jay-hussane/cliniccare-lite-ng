import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { Search } from "lucide-react";

export const Route = createFileRoute("/consultations")({
  head: () => ({
    meta: [
      { title: "Consultations — ClinicCare Lite" },
      { name: "description", content: "Record consultations, diagnosis, and prescriptions." },
    ],
  }),
  component: ConsultationsPage,
});

function ConsultationsPage() {
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-quick", q],
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

  const selected = patients.find((p) => p.id === selectedId);

  return (
    <>
      <PageHeader title="Consultations" subtitle="Select a patient and record their visit" />

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
            <ConsultationWorkspace patientId={selected.id} patientName={selected.full_name} />
          )}
        </div>
      </div>
    </>
  );
}

function ConsultationWorkspace({ patientId, patientName }: { patientId: string; patientName: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ notes: "", diagnosis: "", prescription: "" });

  const { data: history = [] } = useQuery({
    queryKey: ["consults", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultations").select("*").eq("patient_id", patientId).order("created_at", { ascending: false });
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
        <p className="text-xs text-muted-foreground mb-4">New consultation</p>
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
