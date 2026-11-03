import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone, MapPin, User, Stethoscope, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatNaira } from "@/lib/format";
import { statusLabel } from "@/lib/queue";

export const Route = createFileRoute("/_authenticated/patients/$id")({
  head: () => ({
    meta: [{ title: "Patient profile — ClinicCare Lite" }],
  }),
  component: PatientProfile,
});

function PatientProfile() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      const [patient, consultations, bills] = await Promise.all([
        supabase.from("patients").select("*").eq("id", id).single(),
        supabase.from("consultations").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
        supabase.from("billing").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
      ]);
      if (patient.error) throw patient.error;
      return { patient: patient.data, consultations: consultations.data ?? [], bills: bills.data ?? [] };
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data) return null;

  return (
    <>
      <Link to="/patients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-4 w-4" /> Back to patients
      </Link>

      <PageHeader title={data.patient.full_name} subtitle={data.patient.patient_code} />

      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="p-5 lg:col-span-1">
          <h3 className="font-semibold mb-3">Patient details</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {data.patient.phone}</li>
            <li className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> {data.patient.gender ?? "—"} · {data.patient.age ? `${data.patient.age} yrs` : "age n/a"}</li>
            {data.patient.address && (
              <li className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" /> {data.patient.address}</li>
            )}
            <li className="text-xs text-muted-foreground pt-2">Registered {formatDate(data.patient.created_at)}</li>
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button asChild variant="secondary"><Link to="/consultations">New consult</Link></Button>
            <Button asChild><Link to="/billing">New bill</Link></Button>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Stethoscope className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Consultation history</h3>
          </div>
          {data.consultations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No consultations recorded.</p>
          ) : (
            <ul className="divide-y">
              {data.consultations.map((c) => (
                <li key={c.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">{formatDate(c.created_at)}</div>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline">{statusLabel(c.status)}</Badge>
                      {c.status !== "completed" && (
                        <Badge variant={c.paid ? "secondary" : "destructive"}>{c.paid ? "Paid" : "Not paid"}</Badge>
                      )}
                    </span>
                  </div>
                  {c.diagnosis && <div className="font-medium mt-1">Diagnosis: {c.diagnosis}</div>}
                  {c.notes && <div className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{c.notes}</div>}
                  {c.prescription && <div className="text-sm mt-1"><span className="text-muted-foreground">Rx:</span> <span className="whitespace-pre-line">{c.prescription}</span></div>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 lg:col-span-3">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="h-4 w-4 text-secondary" />
            <h3 className="font-semibold">Payments</h3>
          </div>
          {data.bills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Service</th>
                    <th className="py-2 pr-4">Method</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bills.map((b) => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{formatDate(b.created_at)}</td>
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
