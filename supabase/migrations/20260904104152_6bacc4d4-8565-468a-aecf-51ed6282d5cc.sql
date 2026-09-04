-- Clear anything equipped from the old owner pool
UPDATE public.profiles p SET
  equipped_nametag = CASE WHEN equipped_nametag IN (SELECT slug FROM public.cosmetics WHERE pool='owner') THEN NULL ELSE equipped_nametag END,
  equipped_badge   = CASE WHEN equipped_badge   IN (SELECT slug FROM public.cosmetics WHERE pool='owner') THEN NULL ELSE equipped_badge END,
  equipped_frame   = CASE WHEN equipped_frame   IN (SELECT slug FROM public.cosmetics WHERE pool='owner') THEN NULL ELSE equipped_frame END,
  equipped_banner  = CASE WHEN equipped_banner  IN (SELECT slug FROM public.cosmetics WHERE pool='owner') THEN NULL ELSE equipped_banner END,
  equipped_effect  = CASE WHEN equipped_effect  IN (SELECT slug FROM public.cosmetics WHERE pool='owner') THEN NULL ELSE equipped_effect END;

DELETE FROM public.inventory WHERE cosmetic_slug IN (SELECT slug FROM public.cosmetics WHERE pool='owner');
DELETE FROM public.cosmetics WHERE pool='owner';

INSERT INTO public.cosmetics (slug, name, slot, rarity, description, price_sparks, required_level, featured, pool, available_until) VALUES
('tag-crown-ascendant','Ascendant','nametag','mythic','Living gold that rises through your name like sunlight through cathedral glass.',0,100,true,'owner',NULL),
('tag-crown-molten','Molten Sovereign','nametag','mythic','Poured metal, still cooling. It moves because it has not set yet.',0,100,true,'owner',NULL),
('tag-crown-oracle','Oracle','nametag','mythic','Gold refracted through prophecy — the hue shifts as it speaks.',0,100,true,'owner',NULL),
('tag-crown-infinite','Infinite','nametag','mythic','A loop of light with no beginning. It never repeats the same frame twice.',0,100,true,'owner',NULL),
('tag-crown-blackgold','Black Gold','nametag','mythic','Absolute black split by a single unbearable seam of gold.',0,100,true,'owner',NULL),
('badge-crown-diadem','Diadem','badge','mythic','The only crown on the platform.',0,100,true,'owner',NULL),
('badge-crown-solaris','Solaris','badge','mythic','A private sun, worn beside the name.',0,100,false,'owner',NULL),
('badge-crown-seal','Prime Seal','badge','mythic','Stamped once. Never issued again.',0,100,false,'owner',NULL),
('badge-crown-monolith','Monolith','badge','mythic','A mark older than the ladder itself.',0,100,false,'owner',NULL),
('frame-crown-ascension','Ascension','frame','mythic','Two counter-turning rings of gold with light caught between them.',0,100,true,'owner',NULL),
('frame-crown-solarcrown','Solar Crown','frame','mythic','A corona that breathes, flaring at the edges of your avatar.',0,100,true,'owner',NULL),
('frame-crown-mirrorgold','Mirrorgold','frame','mythic','Polished bullion that catches the room as it turns.',0,100,false,'owner',NULL),
('frame-crown-eclipsecrown','Eclipse Crown','frame','mythic','Total darkness ringed by a thin, blinding rim of gold.',0,100,false,'owner',NULL),
('banner-crown-empyrean','Empyrean','banner','mythic','Dawn breaking over a gold horizon that never fully rises.',0,100,true,'owner',NULL),
('banner-crown-goldsea','Gold Sea','banner','mythic','Molten tide under a dark sky, moving slowly.',0,100,true,'owner',NULL),
('banner-crown-thronehall','Throne Hall','banner','mythic','Vaulted light, gold pillars, silence.',0,100,false,'owner',NULL),
('banner-crown-solareclipse','Solar Eclipse','banner','mythic','A black disc with a gold ring burning behind it.',0,100,false,'owner',NULL),
('fx-crown-ascend','Ascension','effect','mythic','Your messages rise into place on a column of gold light.',0,100,true,'owner',NULL),
('fx-crown-decree','Decree','effect','mythic','Every line lands like it was announced.',0,100,false,'owner',NULL),
('fx-crown-goldwave','Goldwave','effect','mythic','A wave of gold sweeps the row as the message arrives.',0,100,false,'owner',NULL);

-- Hand the new regalia to the owner account
DO $$
DECLARE _first uuid;
BEGIN
  SELECT id INTO _first FROM public.profiles ORDER BY created_at ASC, id ASC LIMIT 1;
  IF _first IS NOT NULL THEN
    PERFORM public.grant_founder_cosmetics(_first);
  END IF;
END $$;