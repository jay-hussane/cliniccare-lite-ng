import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS, type AppRole } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Staff & Roles — ClinicCare Lite" },
      { name: "description", content: "Administrators manage clinic staff accounts, roles and access." },
      { property: "og:title", content: "Staff & Roles — ClinicCare Lite" },
      { property: "og:description", content: "Manage who works in your clinic and what they can do." },
    ],
  }),
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw redirect({ to: "/" });
  },
  component: StaffPage,
});

const ROLES: AppRole[] = ["admin", "doctor", "nurse", "receptionist"];

function StaffPage() {
  const queryClient = useQueryClient();

  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: true }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw error;
      return (profiles ?? []).map((p) => ({
        ...p,
        role: ((roles ?? []).find((r) => r.user_id === p.id)?.role ?? "receptionist") as AppRole,
      }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error: delError } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delError) throw delError;
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
    },
    onError: () => toast.error("Could not update role"),
  });

  const setActive = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Staff status updated");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: () => toast.error("Could not update status"),
  });

  return (
    <>
      <PageHeader title="Staff & Roles" subtitle="Manage who can access the clinic system and what they can do" />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading staff...</p>
      ) : (staff ?? []).length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">No staff accounts yet.</Card>
      ) : (
        <div className="space-y-3">
          {(staff ?? []).map((member) => (
            <Card key={member.id} className="p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">{member.full_name || "Unnamed staff"}</span>
                  <Badge variant="secondary">{ROLE_LABELS[member.role]}</Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {member.email}
                  {member.phone ? ` · ${member.phone}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Select
                  value={member.role}
                  onValueChange={(role) => setRole.mutate({ userId: member.id, role: role as AppRole })}
                >
                  <SelectTrigger className="w-[170px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={member.is_active}
                    onCheckedChange={(v) => setActive.mutate({ userId: member.id, isActive: v })}
                    aria-label="Active"
                  />
                  <span className="text-xs text-muted-foreground">{member.is_active ? "Active" : "Disabled"}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
