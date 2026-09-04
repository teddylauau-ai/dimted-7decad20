INSERT INTO public.cosmetics (slug, name, slot, rarity, description, price_sparks, required_level, featured, pool)
VALUES
  ('tag-owner-godray', 'Godray', 'nametag', 'mythic', 'Light breaks through your name like sun through cathedral glass.', 0, 999, false, 'owner'),
  ('tag-owner-liquidgold', 'Liquid Gold', 'nametag', 'mythic', 'Molten gold, still moving. Poured once, for one account.', 0, 999, false, 'owner'),
  ('tag-owner-aether', 'Aether', 'nametag', 'mythic', 'A name written in the air itself, shimmering as it drifts.', 0, 999, false, 'owner'),
  ('badge-owner-sigilprime', 'Prime Sigil', 'badge', 'mythic', 'The mark of the one who made the place.', 0, 999, false, 'owner'),
  ('frame-owner-goldstorm', 'Goldstorm', 'frame', 'mythic', 'A ring of turning gold weather around your avatar.', 0, 999, false, 'owner'),
  ('frame-owner-eventhorizon', 'Event Horizon', 'frame', 'mythic', 'Everything falls inward. Nothing gets back out.', 0, 999, false, 'owner'),
  ('banner-owner-goldenhour', 'Golden Hour', 'banner', 'mythic', 'Endless late-afternoon light over a dark skyline.', 0, 999, false, 'owner'),
  ('fx-owner-coronation', 'Coronation', 'effect', 'mythic', 'Your messages arrive crowned in light.', 0, 999, false, 'owner'),
  ('tag-admin-cipher', 'Cipher', 'nametag', 'mythic', 'Staff-issue. Reads like a signal only the crew can decode.', 0, 999, false, 'admin'),
  ('tag-admin-tidecall', 'Tidecall', 'nametag', 'mythic', 'Deep teal light moving under the letters.', 0, 999, false, 'admin'),
  ('badge-admin-shield', 'Warden Shield', 'badge', 'mythic', 'Carried by those who keep Lazu tidy.', 0, 999, false, 'admin'),
  ('frame-admin-scanline', 'Scanline', 'frame', 'mythic', 'A watchful ring that sweeps your avatar.', 0, 999, false, 'admin'),
  ('banner-admin-controlroom', 'Control Room', 'banner', 'mythic', 'The view from behind the glass.', 0, 999, false, 'admin'),
  ('fx-admin-dispatch', 'Dispatch', 'effect', 'mythic', 'Staff messages land like an official transmission.', 0, 999, false, 'admin')
ON CONFLICT (slug) DO NOTHING;