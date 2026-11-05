import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Minus, Pill } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/drugs")({
  head: () => ({
    meta: [
      { title: "Drug Inventory — ClinicCare Lite" },
      { name: "description", content: "Track drug stock and low stock alerts." },
    ],
  }),
  component: DrugsPage,
});

function statusOf(d: { quantity: number; low_stock_threshold: number }) {
  if (d.quantity <= 0) return { label: "Out of Stock", cls: "bg-destructive/10 text-destructive" };
  if (d.quantity <= d.low_stock_threshold) return { label: "Low Stock", cls: "bg-warning/20 text-warning-foreground" };
  return { label: "In Stock", cls: "bg-success/15 text-success" };
}

function DrugsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: drugs = [], isLoading } = useQuery({
    queryKey: ["drugs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drugs").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const adjust = useMutation({
    mutationFn: async ({ id, qty }: { id: string; qty: number }) => {
      const { error } = await supabase.from("drugs").update({ quantity: Math.max(0, qty) }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drugs"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Drug Inventory"
        subtitle="Track stock and get low-stock alerts"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2"><Plus className="h-4 w-4" /> Add drug</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add drug</DialogTitle></DialogHeader>
              <DrugForm onDone={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : drugs.length === 0 ? (
          <div className="p-10 text-center">
            <Pill className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No drugs in inventory yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground bg-muted/50">
                <tr>
                  <th className="py-3 px-4">Drug</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Adjust</th>
                </tr>
              </thead>
              <tbody>
                {drugs.map((d) => {
                  const s = statusOf(d);
                  return (
                    <tr key={d.id} className="border-t">
                      <td className="py-3 px-4 font-medium">{d.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{d.unit ?? "—"}</td>
                      <td className="py-3 px-4 font-semibold">{d.quantity}</td>
                      <td className="py-3 px-4">
                        <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium", s.cls)}>
                          {s.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="outline" onClick={() => adjust.mutate({ id: d.id, qty: d.quantity - 1 })}>
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="outline" onClick={() => adjust.mutate({ id: d.id, qty: d.quantity + 1 })}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function DrugForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", quantity: "0", low_stock_threshold: "10", unit: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Drug name required");
      const { error } = await supabase.from("drugs").insert({
        name: form.name.trim(),
        quantity: Number(form.quantity) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 10,
        unit: form.unit || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Drug added");
      qc.invalidateQueries({ queryKey: ["drugs"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
      <div>
        <Label>Drug name *</Label>
        <Input className="h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Quantity</Label>
          <Input className="h-11" type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </div>
        <div>
          <Label>Low stock alert at</Label>
          <Input className="h-11" type="number" min="0" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Unit (optional)</Label>
        <Input className="h-11" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="tablets, vials, ml…" />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Add drug"}
      </Button>
    </form>
  );
}
