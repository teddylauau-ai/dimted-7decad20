INSERT INTO public.inventory (user_id, cosmetic_slug)
SELECT r.user_id, c.slug
FROM public.user_roles r
CROSS JOIN public.cosmetics c
WHERE c.pool = 'admin' AND r.role IN ('admin', 'owner')
ON CONFLICT DO NOTHING;

INSERT INTO public.inventory (user_id, cosmetic_slug)
SELECT r.user_id, c.slug
FROM public.user_roles r
CROSS JOIN public.cosmetics c
WHERE c.pool = 'owner' AND r.role = 'owner'
ON CONFLICT DO NOTHING;