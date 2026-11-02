import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DoctorOption = { id: string; full_name: string };

/** Doctors a receptionist can send a patient to. */
export function useDoctors() {
  return useQuery({
    queryKey: ["doctors"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, user_roles!inner(role)")
        .eq("user_roles.role", "doctor")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((d) => ({ id: d.id, full_name: d.full_name })) as DoctorOption[];
    },
  });
}
