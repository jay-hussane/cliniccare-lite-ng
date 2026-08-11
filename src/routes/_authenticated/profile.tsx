import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, useCurrentUser } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — ClinicCare Lite" },
      { name: "description", content: "Update your staff profile details and change your account password." },
      { property: "og:title", content: "My Profile — ClinicCare Lite" },
      { property: "og:description", content: "Keep your clinic staff details up to date." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (me?.profile) {
      setFullName(me.profile.full_name ?? "");
      setPhone(me.profile.phone ?? "");
    }
  }, [me?.profile]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!me) return;
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: phone.trim() || null })
        .eq("id", me.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: () => toast.error("Could not update profile"),
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password changed");
      setPassword("");
    },
    onError: () => toast.error("Could not change password"),
  });

  return (
    <>
      <PageHeader title="My Profile" subtitle="Your account details and password" />

      <div className="grid gap-4 md:grid-cols-2 max-w-4xl">
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-foreground">Details</h2>
            {me && <Badge variant="secondary">{ROLE_LABELS[me.role]}</Badge>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-email">Email</Label>
            <Input id="p-email" value={me?.email ?? ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Full name</Label>
            <Input id="p-name" maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-phone">Phone number</Label>
            <Input id="p-phone" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
            {saveProfile.isPending ? "Saving..." : "Save changes"}
          </Button>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-medium text-foreground">Change password</h2>
          <div className="space-y-1.5">
            <Label htmlFor="p-pass">New password</Label>
            <Input
              id="p-pass"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => changePassword.mutate()}
            disabled={password.length < 6 || changePassword.isPending}
          >
            {changePassword.isPending ? "Updating..." : "Update password"}
          </Button>
        </Card>
      </div>
    </>
  );
}
