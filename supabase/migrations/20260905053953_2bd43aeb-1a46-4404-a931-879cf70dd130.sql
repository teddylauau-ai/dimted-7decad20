DROP POLICY IF EXISTS "Crews visible to members and public crews" ON public.crews;
CREATE POLICY "Crews visible to members and public crews"
ON public.crews FOR SELECT TO authenticated
USING (visibility = 'public' OR public.is_crew_member(id, auth.uid()));

DROP POLICY IF EXISTS "Members can view their crew memberships" ON public.crew_members;
CREATE POLICY "Members can view their crew memberships"
ON public.crew_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_crew_member(crew_id, auth.uid()) OR EXISTS (
  SELECT 1 FROM public.crews c WHERE c.id = crew_members.crew_id AND c.visibility = 'public'
));

DROP POLICY IF EXISTS "Owners and captains can manage members" ON public.crew_members;
CREATE POLICY "Managers can add members"
ON public.crew_members FOR INSERT TO authenticated
WITH CHECK (public.is_crew_manager(crew_id, auth.uid()));
CREATE POLICY "Managers can update members"
ON public.crew_members FOR UPDATE TO authenticated
USING (public.is_crew_manager(crew_id, auth.uid()))
WITH CHECK (public.is_crew_manager(crew_id, auth.uid()));
CREATE POLICY "Managers can remove members"
ON public.crew_members FOR DELETE TO authenticated
USING (public.is_crew_manager(crew_id, auth.uid()));

DROP POLICY IF EXISTS "Users can view their own crew invites" ON public.crew_invites;
CREATE POLICY "Users can view their own crew invites"
ON public.crew_invites FOR SELECT TO authenticated
USING (user_id = auth.uid() OR invited_by = auth.uid() OR public.is_crew_manager(crew_id, auth.uid()));

DROP POLICY IF EXISTS "Owners and captains can invite" ON public.crew_invites;
CREATE POLICY "Owners and captains can invite"
ON public.crew_invites FOR INSERT TO authenticated
WITH CHECK (public.is_crew_manager(crew_id, auth.uid()));

DROP POLICY IF EXISTS "Invitees and managers can delete invites" ON public.crew_invites;
CREATE POLICY "Invitees and managers can delete invites"
ON public.crew_invites FOR DELETE TO authenticated
USING (user_id = auth.uid() OR invited_by = auth.uid() OR public.is_crew_manager(crew_id, auth.uid()));

DROP POLICY IF EXISTS "Crew members can view and send messages" ON public.crew_messages;
CREATE POLICY "Crew members can read messages"
ON public.crew_messages FOR SELECT TO authenticated
USING (public.is_crew_member(crew_id, auth.uid()));
CREATE POLICY "Crew members can send messages"
ON public.crew_messages FOR INSERT TO authenticated
WITH CHECK (public.is_crew_member(crew_id, auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Authors and managers can delete messages"
ON public.crew_messages FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_crew_manager(crew_id, auth.uid()));
CREATE POLICY "Authors can edit messages"
ON public.crew_messages FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());