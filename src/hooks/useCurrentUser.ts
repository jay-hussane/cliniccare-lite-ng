import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "doctor" | "nurse" | "receptionist";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      const roleList = (roles ?? []).map((r) => r.role as AppRole);
      return {
        id: user.id,
        email: user.email ?? "",
        profile,
        roles: roleList,
        role: (roleList[0] ?? "receptionist") as AppRole,
        isAdmin: roleList.includes("admin"),
      };
    },
  });
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrator",
  doctor: "Doctor",
  nurse: "Nurse",
  receptionist: "Receptionist",
};
