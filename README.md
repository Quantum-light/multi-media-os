# multi-media-os

One content system for podcasts and video shows, across many brands. Connect your raw recordings and your style; the system cuts, writes, designs and schedules, and you approve once.

Start with `CLAUDE.md` for the map and the rules.

```
npm ci --include=dev
npm run dev      # Studio on http://localhost:3200
npm run check    # size, layers, types, tests
```

## Signing in
The Studio uses one-time email links (no passwords). In Supabase, under Authentication → URL Configuration, the redirect list must include `http://localhost:3200/auth/callback` and the deployed Studio's `/auth/callback`. People join a workspace by invite (`public.invites`); their membership is created the first time they sign in.
