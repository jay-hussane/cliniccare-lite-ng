import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  createStaffAccount,
  deleteStaffAccount,
  resetStaffPassword,
} from "@/lib/api/staff.functions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { ROLE_LABELS, useCurrentUser, type AppRole } from "@/hooks/useCurrentUser";

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

type StaffMember = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  role: AppRole;
};

function StaffPage() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [deleting, setDeleting] = useState<StaffMember | null>(null);

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
      })) as StaffMember[];
    },
  });

  const setActive = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Staff status updated");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: () => toast.error("Could not update status"),
  });

  const remove = useMutation({
    mutationFn: async (userId: string) => {
      await deleteStaffAccount({ data: { userId } });
    },
    onSuccess: () => {
      toast.success("Staff account deleted");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["doctors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Staff & Roles" subtitle="Create, edit and remove staff accounts, and decide what each person can do" />

      <div className="flex justify-end mb-4">
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" /> Add staff
        </Button>
      </div>

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
                  {!member.is_active && <Badge variant="destructive">Disabled</Badge>}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {member.email}
                  {member.phone ? ` · ${member.phone}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={member.is_active}
                    onCheckedChange={(v) => setActive.mutate({ userId: member.id, isActive: v })}
                    aria-label="Active"
                  />
                  <span className="text-xs text-muted-foreground">{member.is_active ? "Active" : "Disabled"}</span>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(member)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  disabled={member.id === me?.id}
                  onClick={() => setDeleting(member)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddStaffDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <EditStaffDialog member={editing} onClose={() => setEditing(null)} />
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.full_name || "this staff account"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes their sign-in account, profile and role. Their patient records stay in the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleting) remove.mutate(deleting.id);
              }}
            >
              {remove.isPending ? "Deleting…" : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ---------------- Add staff ---------------- */

function AddStaffDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", role: "receptionist", password: "" });

  const create = useMutation({
    mutationFn: async () => {
      await createStaffAccount({
        data: {
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          role: form.role as AppRole,
          password: form.password,
        },
      });
    },
    onSuccess: () => {
      toast.success("Staff account created");
      setForm({ fullName: "", email: "", phone: "", role: "receptionist", password: "" });
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["doctors"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add staff member</DialogTitle>
          <DialogDescription>
            Create a sign-in account. Share the email and password with the staff member.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div>
            <Label>Full name</Label>
            <Input className="h-11 mt-1.5" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Dr. Amina Bello" required />
          </div>
          <div>
            <Label>Email</Label>
            <Input className="h-11 mt-1.5" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@clinic.com" required />
          </div>
          <div>
            <Label>Phone</Label>
            <Input className="h-11 mt-1.5" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0803 000 0000" />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger className="h-11 mt-1.5 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Password</Label>
            <Input className="h-11 mt-1.5" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" required minLength={8} />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create account"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Edit staff ---------------- */

function EditStaffDialog({ member, onClose }: { member: StaffMember | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ fullName: "", phone: "", role: "receptionist" as AppRole, password: "" });
  const [initialized, setInitialized] = useState<string | null>(null);

  // Reset local form whenever a different member is opened.
  if (member && initialized !== member.id) {
    setInitialized(member.id);
    setForm({ fullName: member.full_name ?? "", phone: member.phone ?? "", role: member.role, password: "" });
  }
  if (!member && initialized) setInitialized(null);

  const saveDetails = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.fullName.trim() || "Unnamed staff",
          phone: form.phone.trim() || null,
        })
        .eq("id", member!.id);
      if (error) throw error;
      if (form.role !== member!.role) {
        const { error: delError } = await supabase.from("user_roles").delete().eq("user_id", member!.id);
        if (delError) throw delError;
        const { error: insError } = await supabase
          .from("user_roles")
          .insert({ user_id: member!.id, role: form.role });
        if (insError) throw insError;
      }
    },
    onSuccess: () => {
      toast.success("Staff details updated");
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["current-user"] });
      qc.invalidateQueries({ queryKey: ["doctors"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      await resetStaffPassword({ data: { userId: member!.id, password: form.password } });
    },
    onSuccess: () => {
      toast.success("Password updated");
      setForm((f) => ({ ...f, password: "" }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {member?.full_name || "staff member"}</DialogTitle>
          <DialogDescription>{member?.email}</DialogDescription>
        </DialogHeader>
        {member && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveDetails.mutate();
            }}
          >
            <div>
              <Label>Full name</Label>
              <Input className="h-11 mt-1.5" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input className="h-11 mt-1.5" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                <SelectTrigger className="h-11 mt-1.5 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={saveDetails.isPending}>
              {saveDetails.isPending ? "Saving…" : "Save changes"}
            </Button>

            <div className="border-t pt-3">
              <Label>Reset password</Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="New password (8+ characters)"
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={changePassword.isPending || form.password.length < 8}
                  onClick={() => changePassword.mutate()}
                >
                  {changePassword.isPending ? "Saving…" : "Update"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
