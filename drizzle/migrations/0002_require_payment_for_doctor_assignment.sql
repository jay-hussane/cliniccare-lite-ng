CREATE OR REPLACE FUNCTION public.validate_paid_doctor_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('waiting', 'in_consultation') OR (TG_OP = 'UPDATE' AND OLD.status IN ('waiting', 'in_consultation')) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.billing b
      WHERE b.patient_id = NEW.patient_id
    ) THEN
      RAISE EXCEPTION 'A recorded payment receipt is required before this patient can be sent to or seen by a doctor.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.assigned_doctor IS DISTINCT FROM OLD.assigned_doctor THEN
    IF NEW.status IN ('waiting', 'in_consultation') THEN
      IF NEW.assigned_doctor IS NULL THEN
        RAISE EXCEPTION 'Choose an assigned doctor before adding this patient to the queue.'
          USING ERRCODE = '23514';
      END IF;
      IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.user_roles r ON r.user_id = p.id
        WHERE p.id = NEW.assigned_doctor
          AND p.is_active = true
          AND r.role = 'doctor'::public.app_role
      ) THEN
        RAISE EXCEPTION 'Choose an active doctor account.'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  IF NEW.status IN ('waiting', 'in_consultation') THEN
    NEW.paid := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_paid_doctor_assignment ON public.consultations;
CREATE TRIGGER trg_validate_paid_doctor_assignment
BEFORE INSERT OR UPDATE ON public.consultations
FOR EACH ROW EXECUTE FUNCTION public.validate_paid_doctor_assignment();

DROP POLICY IF EXISTS "Clinical and front desk staff can record consultations" ON public.consultations;
DROP POLICY IF EXISTS "Authenticated staff can insert consultations" ON public.consultations;
CREATE POLICY "Reception and admin can assign paid patients"
  ON public.consultations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'receptionist'::public.app_role)
  );