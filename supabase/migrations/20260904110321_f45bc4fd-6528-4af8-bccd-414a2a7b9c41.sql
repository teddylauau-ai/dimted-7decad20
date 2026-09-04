-- 1. Retire the old owner regalia
UPDATE public.profiles SET equipped_nametag = NULL WHERE equipped_nametag IN (SELECT slug FROM public.cosmetics WHERE pool = 'owner');
UPDATE public.profiles SET equipped_badge   = NULL WHERE equipped_badge   IN (SELECT slug FROM public.cosmetics WHERE pool = 'owner');
UPDATE public.profiles SET equipped_frame   = NULL WHERE equipped_frame   IN (SELECT slug FROM public.cosmetics WHERE pool = 'owner');
UPDATE public.profiles SET equipped_banner  = NULL WHERE equipped_banner  IN (SELECT slug FROM public.cosmetics WHERE pool = 'owner');
UPDATE public.profiles SET equipped_effect  = NULL WHERE equipped_effect  IN (SELECT slug FROM public.cosmetics WHERE pool = 'owner');
DELETE FROM public.inventory WHERE cosmetic_slug IN (SELECT slug FROM public.cosmetics WHERE pool = 'owner');
DELETE FROM public.cosmetics WHERE pool = 'owner';

-- 2. Sovereign regalia
INSERT INTO public.cosmetics (slug, name, slot, rarity, description, price_sparks, required_level, featured, pool, available_until) VALUES
  ('tag-sov-liquid',   'Liquid Sovereign', 'nametag', 'mythic', 'Molten gold poured into the letters, a live specular sweep and a soft halo burning behind the name.', 0, 100, true,  'owner', NULL),
  ('tag-sov-sunforge', 'Sunforge',         'nametag', 'mythic', 'White-hot at the core, ember-orange at the edges, with sparks rising off the letters.', 0, 100, true,  'owner', NULL),
  ('tag-sov-starlit',  'Starlit Crown',    'nametag', 'mythic', 'Deep gold with stars twinkling across the letters.', 0, 100, false, 'owner', NULL),
  ('tag-sov-obsidian', 'Obsidian Throne',  'nametag', 'mythic', 'Black glass letters edged in gold, with a hard bar of light sweeping through.', 0, 100, false, 'owner', NULL),
  ('tag-sov-halo',     'Halo',             'nametag', 'mythic', 'A thin ring of rotating gold light orbits the whole name.', 0, 100, false, 'owner', NULL),

  ('badge-sov-crown',  'Crown of Lazu',    'badge', 'mythic', 'The only crown on the platform. It floats.', 0, 100, true,  'owner', NULL),
  ('badge-sov-sun',    'Sunburst',         'badge', 'mythic', 'A private sun, slowly turning beside the name.', 0, 100, false, 'owner', NULL),
  ('badge-sov-star',   'North Star',       'badge', 'mythic', 'Twinkles. Everyone else navigates by it.', 0, 100, false, 'owner', NULL),
  ('badge-sov-seal',   'Royal Seal',       'badge', 'mythic', 'Black-gold seal, stamped once, never issued again.', 0, 100, false, 'owner', NULL),

  ('frame-sov-ascension', 'Ascension Ring', 'frame', 'mythic', 'Faceted gold turning around the avatar, breathing light.', 0, 100, true,  'owner', NULL),
  ('frame-sov-corona',    'Corona',         'frame', 'mythic', 'A white-gold ring that flares like a star''s edge.', 0, 100, false, 'owner', NULL),
  ('frame-sov-mirror',    'Mirrorgold',     'frame', 'mythic', 'Polished gold with a slow light sweep across its surface.', 0, 100, false, 'owner', NULL),
  ('frame-sov-eclipse',   'Eclipse Crown',  'frame', 'mythic', 'A black ring with a single blade of gold light circling it.', 0, 100, false, 'owner', NULL),

  ('banner-sov-dawn',     'Sovereign Dawn', 'banner', 'mythic', 'A gold sun breaking the horizon, rays cutting through the dark.', 0, 100, true,  'owner', NULL),
  ('banner-sov-goldrain', 'Gold Rain',      'banner', 'mythic', 'Streaks of molten gold falling through a black sky.', 0, 100, false, 'owner', NULL),
  ('banner-sov-throne',   'Throne Hall',    'banner', 'mythic', 'Gold pillars, a lit floor, and silence.', 0, 100, false, 'owner', NULL),
  ('banner-sov-blacksun', 'Black Sun',      'banner', 'mythic', 'A black disc ringed in hard gold, rays behind it.', 0, 100, false, 'owner', NULL),

  ('fx-sov-coronation', 'Coronation', 'effect', 'mythic', 'Messages rise on a column of gold light and burst into sparks.', 0, 100, true,  'owner', NULL),
  ('fx-sov-decree',     'Decree',     'effect', 'mythic', 'Every line lands like it was announced from the throne.', 0, 100, false, 'owner', NULL),
  ('fx-sov-goldwave',   'Goldwave',   'effect', 'mythic', 'A wave of light sweeps the row as the message lands.', 0, 100, false, 'owner', NULL);

-- 3. Hand the full set to the Owner
INSERT INTO public.inventory (user_id, cosmetic_slug)
SELECT ur.user_id, c.slug
FROM public.user_roles ur
CROSS JOIN public.cosmetics c
WHERE ur.role = 'owner' AND c.pool = 'owner'
ON CONFLICT DO NOTHING;