import "server-only";
import { z } from "zod";
import "./zod-id";
import { db, many, one } from "./db";

// Pustaka skill (S15): instruksi yang bisa dipasang ke beberapa agent sekaligus.
// Di PC, isi skill ikut dikirim ke konektor bersama job desk agent (lihat device.ts > claim).
// Semua fungsi menerima officeId yang sudah dicek lewat requireMember().

export type SkillRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  body_md: string;
  updated_at: string;
};

export const SkillInput = z.object({
  name: z.string().trim().min(1, "Isi nama skill.").max(80, "Nama skill maksimal 80 karakter."),
  description: z.string().trim().max(500, "Deskripsi maksimal 500 karakter."),
  body_md: z.string().trim().min(1, "Tulis instruksi skill.").max(50000, "Instruksi terlalu panjang (maks 50.000 karakter)."),
});
export type SkillInput = z.infer<typeof SkillInput>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID.test(v);

/** "Hook 3 Detik!" -> "hook-3-detik". Slug jadi nama file skill di PC, jadi tidak berubah saat skill diganti nama. */
export function skillSlug(name: string) {
  const s = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56)
    .replace(/-+$/, "");
  return s.length >= 2 ? s : "skill";
}

export async function listSkills(officeId: string) {
  return many<SkillRow & { agents: number }>(
    await db(),
    `select s.id, s.slug, s.name, s.description, s.body_md, s.updated_at,
            (select count(*)::int from public.agent_skills x join public.agents a on a.id = x.agent_id
              where x.skill_id = s.id and a.archived_at is null) as agents
       from public.skills s where s.office_id = $1 order by lower(s.name)`,
    [officeId],
  );
}

export async function getSkill(officeId: string, id: string) {
  if (!isUuid(id)) return null;
  const d = await db();
  const skill = await one<SkillRow>(d, `select id, slug, name, description, body_md, updated_at from public.skills where office_id = $1 and id = $2`, [officeId, id]);
  if (!skill) return null;
  const agents = await many<{ id: string; name: string }>(
    d,
    `select a.id, a.name from public.agent_skills x join public.agents a on a.id = x.agent_id
      where x.office_id = $1 and x.skill_id = $2 and a.archived_at is null order by a.name`,
    [officeId, id],
  );
  return { ...skill, agents };
}

async function nameTaken(officeId: string, name: string, exceptId?: string) {
  const r = await one<{ id: string }>(
    await db(),
    `select id from public.skills where office_id = $1 and lower(name) = lower($2) and ($3::uuid is null or id <> $3::uuid)`,
    [officeId, name, exceptId ?? null],
  );
  return !!r;
}

export async function createSkill(officeId: string, input: SkillInput): Promise<{ id: string } | { error: string }> {
  if (await nameTaken(officeId, input.name)) return { error: "Sudah ada skill dengan nama ini." };
  const base = skillSlug(input.name);
  // Slug unik per kantor: "hook", "hook-2", "hook-3", ...
  const r = await one<{ id: string }>(
    await db(),
    `insert into public.skills (office_id, slug, name, description, body_md)
     select $1::uuid, candidate, $3::text, $4::text, $5::text
       from (select case when n = 1 then $2::text else $2::text || '-' || n::text end as candidate from generate_series(1, 50) n) c
      where not exists (select 1 from public.skills where office_id = $1 and slug = c.candidate)
      order by length(candidate), candidate limit 1
     returning id`,
    [officeId, base, input.name, input.description, input.body_md],
  );
  if (!r) return { error: "Terlalu banyak skill dengan nama mirip. Pakai nama lain." };
  return { id: r.id };
}

export async function updateSkill(officeId: string, id: string, input: SkillInput): Promise<{ id: string } | { error: string }> {
  if (await nameTaken(officeId, input.name, id)) return { error: "Sudah ada skill dengan nama ini." };
  const r = await one<{ id: string }>(
    await db(),
    `update public.skills set name = $3, description = $4, body_md = $5 where office_id = $1 and id = $2 returning id`,
    [officeId, id, input.name, input.description, input.body_md],
  );
  return r ? { id } : { error: "Skill tidak ditemukan." };
}

/** Hapus skill; pemasangannya di agent ikut terhapus (cascade). */
export async function deleteSkill(officeId: string, id: string) {
  if (!isUuid(id)) return;
  await (await db()).query(`delete from public.skills where office_id = $1 and id = $2`, [officeId, id]);
}

/** Skill yang dipasang di satu agent. */
export async function agentSkillIds(officeId: string, agentId: string) {
  const rows = await many<{ skill_id: string }>(
    await db(),
    `select skill_id from public.agent_skills where office_id = $1 and agent_id = $2`,
    [officeId, agentId],
  );
  return rows.map((r) => r.skill_id);
}

/** Ganti seluruh skill agent. Id yang bukan milik kantor ini diabaikan. */
export async function setAgentSkills(officeId: string, agentId: string, skillIds: string[]) {
  const ids = [...new Set(skillIds.filter(isUuid))];
  await (await db()).transaction(async (tx) => {
    await tx.query(`delete from public.agent_skills where office_id = $1 and agent_id = $2`, [officeId, agentId]);
    if (ids.length) {
      await tx.query(
        `insert into public.agent_skills (office_id, agent_id, skill_id)
         select $1, $2, s.id from public.skills s where s.office_id = $1 and s.id = any($3::uuid[])`,
        [officeId, agentId, ids],
      );
    }
  });
}
