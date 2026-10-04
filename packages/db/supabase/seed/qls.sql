-- Seed: the Quantum Light Science workspace as it was set up on 4 Oct 2026.
-- Safe to run twice (every insert skips rows that already exist).
-- Fixed ids keep references stable between the live project and branches.

insert into public.workspaces (id, name, slug, plan) values
  ('ad4cb8a0-bea4-4fd6-9101-dd88739d1032', 'Quantum Light Science', 'qls', 'founder')
on conflict do nothing;

insert into public.brands (id, workspace_id, name, slug, brand_kit) values
  ('89f99456-83f8-48a9-8d3b-d02e1d6cfaf6', 'ad4cb8a0-bea4-4fd6-9101-dd88739d1032', 'Quantum Light Science', 'qls',
   '{"version":1,"story":"Science for everyday people, with a regal feel.","motion":"thread",
     "fonts":{"base":{"family":"Satoshi","source":"upload","licenceConfirmed":true},"display":{"family":"Cinzel","source":"google","licenceConfirmed":false}},
     "colours":{"ink":"#FAF6EC","extra":[],"accent":"#C9A24A","ground":"#1A1030"},
     "neverDo":["no pure black grounds","no glitter or bokeh sparkle","no text inside generated images","no stock-cosmos cliches"],
     "personas":[],"styleWords":["regal but everyday","calm","luminous","never sci-fi"]}')
on conflict do nothing;

insert into public.shows (id, workspace_id, brand_id, name, slug, kind, theme, slots, approval_mode, compass) values
  ('104454df-256c-4d6b-a111-6db53d3b25f6', 'ad4cb8a0-bea4-4fd6-9101-dd88739d1032', '89f99456-83f8-48a9-8d3b-d02e1d6cfaf6',
   'Journeys with Time', 'journeys-with-time', 'podcast',
   '{"ink":"#FAF6EC","extra":["#2D1B4E","#C9A94F"],"accent":"#A8842E","ground":"#1A1030"}', '[]', 'review_all', null),
  ('1a245803-f6ed-4f8c-89ad-c4060a70d88e', 'ad4cb8a0-bea4-4fd6-9101-dd88739d1032', '89f99456-83f8-48a9-8d3b-d02e1d6cfaf6',
   'Human Time with GG', 'human-time-with-gg', 'video',
   '{"ink":"#F2E6C8","extra":[],"accent":"#CD9936","ground":"#2A1D16"}',
   '[{"tz":"Asia/Makassar","day":"tue","time":"09:00"},{"tz":"Asia/Makassar","day":"fri","time":"09:00"}]', 'review_all',
   '{"isDraft":true,
     "whatItIs":"The human, behind-the-scenes side of Quantum Light Science, on YouTube.",
     "mission":"Help everyday people understand time, and use it to live fuller lives.",
     "pillars":["Personal growth and time","Quantum science and spirituality","Business and entrepreneurship","Relationships and family"],
     "howYouSeeIt":"Everyday science, but regal enough. Human first.",
     "vision":"The show people turn to when they want time explained, and a doorway into the book, the podcast and the documentary.",
     "mainGoal":{"statement":"Become a trusted twice-weekly show for curious, time-hungry people","by":"2027-10-01","objectives":[
       {"title":"Show up consistently","kpis":[{"name":"Episodes a month","unit":"","target":8,"current":1,"evidenceSource":"calendar.published_episodes"}]},
       {"title":"Earn trust","kpis":[{"name":"Returning viewers","unit":"%","target":45,"current":34,"evidenceSource":"youtube_analytics.returning_viewers"}]},
       {"title":"Reach the people you are for","kpis":[{"name":"Curious-seeker match","unit":"%","target":80,"current":72,"evidenceSource":"audience_fit.persona.curious_seeker"}]}]}}')
on conflict do nothing;

insert into public.channels (id, workspace_id, platform, handle, status, zernio_account_id) values
  ('30ad53ad-f51c-4e90-8053-406b8a0b9447', 'ad4cb8a0-bea4-4fd6-9101-dd88739d1032', 'youtube', '@HumanTimewithGG', 'connected', '6a79e02fd0fe733d1ad238a0'),
  ('81193ece-6266-48b9-982c-dd36864711df', 'ad4cb8a0-bea4-4fd6-9101-dd88739d1032', 'instagram', '@humantimewithgg', 'connected', '6a79e009d0fe733d1ad22a28'),
  ('625a130c-82ba-45f5-98ae-1b14155d7d58', 'ad4cb8a0-bea4-4fd6-9101-dd88739d1032', 'threads', '@humantimewithgg', 'connected', null)
on conflict do nothing;

insert into public.show_channels (workspace_id, show_id, channel_id, carries) values
  ('ad4cb8a0-bea4-4fd6-9101-dd88739d1032', '1a245803-f6ed-4f8c-89ad-c4060a70d88e', '30ad53ad-f51c-4e90-8053-406b8a0b9447', '{episodes,shorts}'),
  ('ad4cb8a0-bea4-4fd6-9101-dd88739d1032', '1a245803-f6ed-4f8c-89ad-c4060a70d88e', '81193ece-6266-48b9-982c-dd36864711df', '{reels,carousels}'),
  ('ad4cb8a0-bea4-4fd6-9101-dd88739d1032', '1a245803-f6ed-4f8c-89ad-c4060a70d88e', '625a130c-82ba-45f5-98ae-1b14155d7d58', '{posts}')
on conflict do nothing;

insert into public.time_anchors (id, workspace_id, name, date, recurrence, scope) values
  ('9b25fd6f-2d06-4ffc-a4d1-1a1c8ed12419', null, 'UK clocks go back', '2026-10-25', 'none', 'global'),
  ('ca54ba2c-553c-4184-97db-433c7264383a', null, 'Winter solstice', '2026-12-21', 'yearly', 'global'),
  ('409a705e-b774-4140-9bc9-4adc2b71fc20', null, 'New Year''s Eve', '2026-12-31', 'yearly', 'global'),
  ('a556ed65-e79f-444a-80ba-fa204f1285ed', null, 'Spring equinox', '2027-03-20', 'yearly', 'global'),
  ('8c49caec-f19a-499b-a7d9-baf5a98bd019', null, 'UK clocks go forward', '2027-03-28', 'none', 'global')
on conflict do nothing;
