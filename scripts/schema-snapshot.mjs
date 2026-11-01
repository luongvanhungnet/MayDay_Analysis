// Read-only snapshot; never runs DDL or changes the source database.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import "dotenv/config";
const url = new URL(process.env.DATABASE_URL);
const query = `SELECT json_agg(t ORDER BY name) FROM (
 SELECT c.relname AS name,
 (SELECT json_agg(x ORDER BY x.position) FROM (
 SELECT a.attname AS name, format_type(a.atttypid,a.atttypmod) AS type,
 a.attnum AS position, NOT a.attnotnull AS nullable,
 pg_get_expr(d.adbin,d.adrelid) AS "default", a.attidentity <> '' AS identity,
 a.attgenerated <> '' AS generated,
 EXISTS(SELECT 1 FROM pg_constraint p WHERE p.conrelid=c.oid AND p.contype='p' AND a.attnum=ANY(p.conkey)) AS pk
 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) x) AS columns,
 (SELECT coalesce(json_agg(json_build_object('name',p.conname,'definition',pg_get_constraintdef(p.oid))), '[]') FROM pg_constraint p WHERE p.conrelid=c.oid AND p.contype='c') AS checks,
 (SELECT coalesce(json_agg(json_build_object('columns',(SELECT json_agg(a.attname ORDER BY k.n) FROM unnest(p.conkey) WITH ORDINALITY k(id,n) JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.id),'table',r.relname,'references',(SELECT json_agg(a.attname ORDER BY k.n) FROM unnest(p.confkey) WITH ORDINALITY k(id,n) JOIN pg_attribute a ON a.attrelid=r.oid AND a.attnum=k.id))), '[]') FROM pg_constraint p JOIN pg_class r ON r.oid=p.confrelid WHERE p.conrelid=c.oid AND p.contype='f') AS relations
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'
) t`;
const result = spawnSync(
  "psql",
  [
    "-h",
    url.hostname,
    "-p",
    url.port || "5432",
    "-U",
    decodeURIComponent(url.username),
    "-d",
    url.pathname.slice(1),
    "-w",
    "-Atc",
    query,
  ],
  {
    encoding: "utf8",
    env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
  },
);
if (result.status !== 0) throw new Error(result.stderr);
writeFileSync(
  "apps/api/src/native/schema.json",
  JSON.stringify(JSON.parse(result.stdout), null, 2) + "\n",
);
