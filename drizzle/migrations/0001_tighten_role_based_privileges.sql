-- Tighten INSERT/UPDATE privileges so each staff role only gets what its job needs.
-- Views stay open to all authenticated staff (they need queue/payment/stock visibility).
-- Patients: reception, nurse and admin register/edit; doctors may correct details during a visit.
DROP POLICY IF EXISTS "Authenticated staff can insert patients" ON public.patients;
CREATE POLICY "Front desk can register patients" ON public.patients
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'receptionist'::app_role) OR has_role(auth.uid(), 'nurse'::app_role));
DROP POLICY IF EXISTS "Authenticated staff can update patients" ON public.patients;
CREATE POLICY "Clinical and front desk staff can update patients" ON public.patients
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'receptionist'::app_role) OR has_role(auth.uid(), 'nurse'::app_role) OR has_role(auth.uid(), 'doctor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'receptionist'::app_role) OR has_role(auth.uid(), 'nurse'::app_role) OR has_role(auth.uid(), 'doctor'::app_role));

-- Consultations: all staff roles record and update (reception assigns patients to doctors).
DROP POLICY IF EXISTS "Authenticated staff can insert consultations" ON public.consultations;
CREATE POLICY "Clinical and front desk staff can record consultations" ON public.consultations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated staff can update consultations" ON public.consultations;
CREATE POLICY "Clinical and front desk staff can update consultations" ON public.consultations
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Billing: only reception and admin take payments.
DROP POLICY IF EXISTS "Authenticated staff can insert billing" ON public.billing;
CREATE POLICY "Reception and admin can bill" ON public.billing
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'receptionist'::app_role));
DROP POLICY IF EXISTS "Authenticated staff can update billing" ON public.billing;
CREATE POLICY "Reception and admin can update billing" ON public.billing
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'receptionist'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'receptionist'::app_role));

-- Drug inventory: nurse and admin manage stock.
DROP POLICY IF EXISTS "Authenticated staff can insert drugs" ON public.drugs;
CREATE POLICY "Nurse and admin can add drugs" ON public.drugs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'nurse'::app_role));
DROP POLICY IF EXISTS "Authenticated staff can update drugs" ON public.drugs;
CREATE POLICY "Nurse and admin can adjust stock" ON public.drugs
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'nurse'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'nurse'::app_role));