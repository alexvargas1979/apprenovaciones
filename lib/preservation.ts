/** HU-01 data backfill. Schema belongs exclusively to Drizzle migrations. */
type Database=Pick<D1Database,'prepare'|'batch'>;

export type PreservationSummary={capturedAt:string;balanceCount:number;openingTotal:number};

export async function preserveProperties(db:Database,uid:string,propertyId?:string){
  // Bounded per-user batches. A second request can safely resume/repeat the work.
  const rows=await db.prepare(`SELECT p.id FROM properties p
    WHERE p.user_id=? AND (? IS NULL OR p.id=?)
    AND NOT EXISTS(SELECT 1 FROM investment_projects i WHERE i.property_id=p.id)
    ORDER BY p.id LIMIT 20`).bind(uid,propertyId??null,propertyId??null).all<{id:string}>();
  for(const {id} of rows.results){
    const at=new Date().toISOString();
    await db.batch([
      db.prepare(`INSERT INTO property_baselines
        (property_id,user_id,original_payload,original_updated_at,captured_at)
        SELECT id,user_id,payload,updated_at,? FROM properties p
        WHERE id=? AND user_id=?
        AND NOT EXISTS(SELECT 1 FROM investment_projects i WHERE i.property_id=p.id)
        ON CONFLICT(property_id) DO NOTHING`).bind(at,id,uid),
      db.prepare(`INSERT INTO opening_balances(property_id,line_id,amount,source)
        SELECT b.property_id,j.key,CAST(json_extract(j.value,'$.actual') AS TEXT),'legacy_manual_total'
        FROM property_baselines b,json_each(b.original_payload,'$.lines') j
        WHERE b.property_id=? AND b.user_id=?
        AND json_type(j.value,'$.actual') IN ('integer','real')
        ON CONFLICT(property_id,line_id) DO NOTHING`).bind(id,uid),
      db.prepare(`INSERT INTO investment_projects(property_id,user_id,schema_version,origin,created_at)
        SELECT property_id,user_id,1,'legacy',captured_at FROM property_baselines
        WHERE property_id=? AND user_id=?
        ON CONFLICT(property_id) DO NOTHING`).bind(id,uid),
    ]);
  }
  const remaining=await db.prepare(`SELECT COUNT(*) AS count FROM properties p
    WHERE user_id=? AND (? IS NULL OR id=?)
    AND NOT EXISTS(SELECT 1 FROM investment_projects i WHERE i.property_id=p.id)`)
    .bind(uid,propertyId??null,propertyId??null).first<{count:number}>();
  return {processed:rows.results.length,remaining:remaining?.count??0};
}

export async function preservationSummary(db:Database,uid:string){
  const rows=await db.prepare(`SELECT b.property_id,b.captured_at,COUNT(o.line_id) AS balance_count,
    COALESCE(SUM(CAST(o.amount AS REAL)),0) AS opening_total
    FROM property_baselines b LEFT JOIN opening_balances o ON o.property_id=b.property_id
    INNER JOIN properties p ON p.id=b.property_id AND p.user_id=b.user_id
    WHERE b.user_id=? GROUP BY b.property_id,b.captured_at`).bind(uid)
    .all<{property_id:string;captured_at:string;balance_count:number;opening_total:number}>();
  return Object.fromEntries(rows.results.map(r=>[r.property_id,{
    capturedAt:r.captured_at,balanceCount:r.balance_count,openingTotal:r.opening_total,
  }])) as Record<string,PreservationSummary>;
}
