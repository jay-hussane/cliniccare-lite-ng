-- Patient visit queue: status + assigned doctor + payment flag
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS assigned_doctor uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_consultations_queue
  ON public.consultations (assigned_doctor, created_at)
  WHERE status <> 'completed';

COMMENT ON COLUMN public.consultations.status IS 'waiting = sent to doctor, in_consultation = doctor attending, completed = visit finished';

-- When reception records a payment for a patient, mark their open visits as paid
CREATE OR REPLACE FUNCTION public.mark_open_consultations_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.consultations
  SET paid = true
  WHERE patient_id = NEW.patient_id
    AND status IN ('waiting', 'in_consultation')
    AND paid = false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_marks_paid ON public.billing;
CREATE TRIGGER trg_billing_marks_paid
AFTER INSERT ON public.billing
FOR EACH ROW EXECUTE FUNCTION public.mark_open_consultations_paid();
