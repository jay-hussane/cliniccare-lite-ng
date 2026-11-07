import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DoctorOption = { id: string; full_name: string };

/** Doctors a receptionist can send a patient to. */
export function useDoctors() {
  return useQuery({
    queryKey: ["doctors"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data: roleRows, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "doctor");
      if (rolesError) throw rolesError;

      const doctorIds = [...new Set((roleRows ?? []).map((row) => row.user_id))];
      if (doctorIds.length === 0) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", doctorIds)
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DoctorOption[];
    },
  });
}
