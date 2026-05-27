import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Phone, Search, User } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/patients/")({
  head: () => ({
    meta: [
      { title: "Patients — ClinicCare Lite" },
      { name: "description", content: "Register and search patients, view profiles and visit history." },
    ],
  }),
  component: PatientsPage,
});

function PatientsPage() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["patients", q],
    queryFn: async () => {
      let query = supabase.from("patients").select("*").order("created_at", { ascending: false }).limit(200);
      if (q.trim()) {
        const term = `%${q.trim()}%`;
        query = query.or(`full_name.ilike.${term},phone.ilike.${term},patient_code.ilike.${term}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle="Register and find patients quickly"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Plus className="h-4 w-4" /> New patient
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Register new patient</DialogTitle></DialogHeader>
              <PatientForm onDone={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="p-3 md:p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone or patient ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 h-11"
          />
        </div>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : patients.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">No patients yet. Register your first patient.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {patients.map((p) => (
            <Link key={p.id} to="/patients/$id" params={{ id: p.id }}>
              <Card className="p-4 hover:shadow-card hover:border-primary/30 transition-all">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-full bg-primary-soft text-primary grid place-items-center font-semibold">
                    {p.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground truncate">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground">{p.patient_code}</div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                      <Phone className="h-3.5 w-3.5" /> {p.phone}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <User className="h-3.5 w-3.5" />
                      {p.gender ?? "—"} · {p.age ? `${p.age} yrs` : "age n/a"}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-muted-foreground">
                  Registered {formatDate(p.created_at)}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function PatientForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    full_name: "", phone: "", age: "", gender: "", address: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim() || !form.phone.trim()) throw new Error("Name and phone are required");
      const { error } = await supabase.from("patients").insert({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        age: form.age ? Number(form.age) : null,
        gender: form.gender || null,
        address: form.address || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Patient registered");
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
    >
      <div>
        <Label>Full name *</Label>
        <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="h-11" required />
      </div>
      <div>
        <Label>Phone number *</Label>
        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-11" required inputMode="tel" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Age</Label>
          <Input type="number" min="0" max="130" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className="h-11" />
        </div>
        <div>
          <Label>Gender</Label>
          <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Address (optional)</Label>
        <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Register patient"}
      </Button>
    </form>
  );
}
