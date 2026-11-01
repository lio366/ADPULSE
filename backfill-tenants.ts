import "dotenv/config";
import mysql from "mysql2/promise";

const TABLES = ["business_settings","customers","business_tasks","finance_entries","inventory_items","estimates","media_assets","agent_runs","business_audit","customer_portal_accounts","business_records","business_automation_rules"] as const;
const CUSTOMER_LINKED = ["estimates","media_assets","customer_portal_accounts","business_records"] as const;
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const backupConfirmed = args.has("--confirm-backup");
const promoteAdmins = args.has("--promote-platform-admins");
if (apply && !backupConfirmed) throw new Error("Bloqueado: --apply requiere --confirm-backup tras comprobar un backup restaurable.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL requerido.");
const db = await mysql.createConnection(process.env.DATABASE_URL);
const slug = (ownerId: number) => `legacy-${ownerId}`;
try {
  const requiredTables = ["users","tenants","tenant_memberships","platform_admins",...TABLES];
  const [tableRows] = await db.query<any[]>("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
  const existingTables = new Set(tableRows.map((r) => String(r.TABLE_NAME)));
  const missingTables = requiredTables.filter((t) => !existingTables.has(t));
  if (missingTables.length) throw new Error(`Preflight: faltan tablas: ${missingTables.join(", ")}`);
  const [columnRows] = await db.query<any[]>("SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()");
  const columns = new Set(columnRows.map((r) => `${r.TABLE_NAME}.${r.COLUMN_NAME}`));
  const missingColumns = TABLES.flatMap((t) => ["tenantId","ownerId"].filter((c) => !columns.has(`${t}.${c}`)).map((c) => `${t}.${c}`));
  if (missingColumns.length) throw new Error(`Preflight: faltan columnas: ${missingColumns.join(", ")}`);
  const [ownersRows] = await db.query<any[]>(`SELECT DISTINCT x.ownerId FROM (${TABLES.map(t => `SELECT ownerId FROM \`${t}\` WHERE ownerId IS NOT NULL`).join(" UNION ")}) x ORDER BY x.ownerId`);
  const owners = ownersRows.map(r => Number(r.ownerId));
  const [badOwners] = await db.query<any[]>(`SELECT COUNT(*) AS n FROM (${TABLES.map(t => `SELECT ownerId FROM \`${t}\` WHERE tenantId IS NULL AND ownerId IS NULL`).join(" UNION ALL ")}) x`);
  if (Number(badOwners[0].n) > 0) throw new Error(`Hay ${badOwners[0].n} filas sin tenantId ni ownerId; requiere resolución manual.`);
  const plan = [];
  for (const ownerId of owners) {
    const [u] = await db.query<any[]>("SELECT id FROM users WHERE id = ?", [ownerId]);
    if (!u.length) throw new Error(`ownerId ${ownerId} no existe en users.`);
    const [tn] = await db.query<any[]>("SELECT id FROM tenants WHERE slug = ?", [slug(ownerId)]);
    plan.push({ ownerId, tenantId: tn.length ? Number(tn[0].id) : null });
  }
  const crossIssues = [];
  for (const t of CUSTOMER_LINKED) {
    const [r] = await db.query<any[]>(`SELECT COUNT(*) AS n FROM \`${t}\` x JOIN customers c ON c.id=x.customerId WHERE x.customerId IS NOT NULL AND x.ownerId <> c.ownerId`);
    if (Number(r[0].n)) crossIssues.push(`${t}: ${r[0].n} referencias cruzadas de propietario`);
    const [orphans] = await db.query<any[]>(`SELECT COUNT(*) AS n FROM \`${t}\` x LEFT JOIN customers c ON c.id=x.customerId WHERE x.customerId IS NOT NULL AND c.id IS NULL`);
    if (Number(orphans[0].n)) crossIssues.push(`${t}: ${orphans[0].n} customerId huérfanos`);
  }
  if (crossIssues.length) throw new Error(`Backfill bloqueado: ${crossIssues.join("; ")}`);
  const report = { mode: apply ? "apply" : "dry-run", owners: plan.length, tenantsAlreadyPresent: plan.filter(x=>x.tenantId!==null).length, tenantsToCreate: plan.filter(x=>x.tenantId===null).length, platformAdminPromotion: promoteAdmins ? "explicit opt-in" : "disabled", checks: "passed" };
  console.log(JSON.stringify(report,null,2));
  if (!apply) { console.log("DRY-RUN: no se modificó la base de datos."); process.exitCode=0; }
  else {
    const lockName = "adpulse_v12_tenant_backfill";
    const [lock] = await db.query<any[]>("SELECT GET_LOCK(?,0) AS acquired",[lockName]);
    if (Number(lock[0].acquired)!==1) throw new Error("Otro backfill está en ejecución.");
    try {
      await db.beginTransaction();
      const ids = new Map<number,number>();
      for (const item of plan) {
        let tenantId = item.tenantId;
        if (!tenantId) {
          const [res] = await db.query<any>("INSERT INTO tenants (slug,name,status,createdByUserId) VALUES (?,?,'active',?)",[slug(item.ownerId),`Empresa ${item.ownerId}`,item.ownerId]);
          tenantId = Number(res.insertId);
        }
        ids.set(item.ownerId,tenantId);
        await db.query("INSERT INTO tenant_memberships (tenantId,userId,role,status) VALUES (?,?,'owner','active') ON DUPLICATE KEY UPDATE id=id",[tenantId,item.ownerId]);
      }
      const before = new Map<string,number>();
      for (const t of TABLES) { const [r] = await db.query<any[]>(`SELECT COUNT(*) AS n FROM \`${t}\``); before.set(t,Number(r[0].n)); }
      for (const t of TABLES) await db.query(`UPDATE \`${t}\` x JOIN tenants tn ON tn.createdByUserId=x.ownerId AND tn.slug LIKE 'legacy-%' SET x.tenantId=tn.id WHERE x.tenantId IS NULL AND x.ownerId IS NOT NULL`);
      if (promoteAdmins) await db.query("INSERT INTO platform_admins (userId) SELECT id FROM users WHERE role='admin' ON DUPLICATE KEY UPDATE userId=userId");
      for (const t of TABLES) {
        const [r] = await db.query<any[]>(`SELECT COUNT(*) AS n FROM \`${t}\``);
        if (Number(r[0].n)!==before.get(t)) throw new Error(`${t}: cambió el número total de filas.`);
        const [nulls] = await db.query<any[]>(`SELECT COUNT(*) AS n FROM \`${t}\` WHERE tenantId IS NULL`);
        if (Number(nulls[0].n)) throw new Error(`${t}: ${nulls[0].n} filas sin tenantId.`);
      }
      await db.commit();
      console.log("BACKFILL COMMITTED: conteos preservados y cero tenantId NULL.");
    } catch (e) { await db.rollback(); throw e; }
    finally { await db.query("SELECT RELEASE_LOCK(?)",[lockName]); }
  }
} finally { await db.end(); }
