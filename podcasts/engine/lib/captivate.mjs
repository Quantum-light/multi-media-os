// Captivate (podcast host → Spotify, Apple and all podcast apps via RSS). Same auth as the old QLS media system.
import { need } from "./env.mjs";

const API = "https://api.captivate.fm";

export async function token() {
  const form = new FormData();
  form.append("username", need("CAPTIVATE_USER_ID"));
  form.append("token", need("CAPTIVATE_API_KEY"));
  const res = await fetch(`${API}/authenticate/token`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Captivate auth ${res.status}: ${await res.text()}`);
  const t = (await res.json())?.user?.token;
  if (!t) throw new Error("Captivate auth returned no token");
  return t;
}

export async function cap(path, init = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${await token()}`, ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`Captivate ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function showStatus(show) {
  const id = need(show?.config?.captivate?.show_id_env || "CAPTIVATE_SHOW_ID");
  const info = await cap(`/shows/${id}`);
  const eps = await cap(`/shows/${id}/episodes`);
  const s = info.show ?? info;
  return {
    title: s.title, author: s.author, spotify: s.spotify_uri || null, apple: s.itunes_url || s.apple_url || null,
    episodes: (eps.episodes ?? []).map((e) => ({ id: e.id, title: e.title, status: e.status, published: e.published_date, number: e.episode_number })),
  };
}
