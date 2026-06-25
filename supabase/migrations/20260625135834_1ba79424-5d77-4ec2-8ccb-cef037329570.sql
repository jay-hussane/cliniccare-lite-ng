
DROP POLICY IF EXISTS public_all ON public.patients;
DROP POLICY IF EXISTS public_all ON public.consultations;
DROP POLICY IF EXISTS public_all ON public.billing;
DROP POLICY IF EXISTS public_all ON public.drugs;

REVOKE ALL ON public.patients FROM anon;
REVOKE ALL ON public.consultations FROM anon;
REVOKE ALL ON public.billing FROM anon;
REVOKE ALL ON public.drugs FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drugs TO authenticated;

CREATE POLICY "Authenticated staff can view patients" ON public.patients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated staff can insert patients" ON public.patients FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated staff can update patients" ON public.patients FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated staff can delete patients" ON public.patients FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated staff can view consultations" ON public.consultations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated staff can insert consultations" ON public.consultations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated staff can update consultations" ON public.consultations FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated staff can delete consultations" ON public.consultations FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated staff can view billing" ON public.billing FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated staff can insert billing" ON public.billing FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated staff can update billing" ON public.billing FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated staff can delete billing" ON public.billing FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated staff can view drugs" ON public.drugs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated staff can insert drugs" ON public.drugs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated staff can update drugs" ON public.drugs FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated staff can delete drugs" ON public.drugs FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
