
const pool = require("../config/database");

const BOM_STATUSES = ["ACTIVE", "INACTIVE"];
const VERSION_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE"];
const ISSUE_METHODS = ["MANUAL", "BACKFLUSH"];

function parsePositiveId(value, fieldName = "ID") {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return id;
}

async function listBoms(companyId) {
  const result = await pool.query(
    `SELECT
       b.id,
       b.company_id,
       b.product_id,
       p.sku AS product_sku,
       p.name AS product_name,
       b.bom_code,
       b.name,
       b.status,
       b.description,
       b.created_at,
       b.updated_at,
       COUNT(DISTINCT bv.id)::integer AS version_count
     FROM boms b
     JOIN products p
       ON p.id = b.product_id
      AND p.company_id = b.company_id
     LEFT JOIN bom_versions bv
       ON bv.bom_id = b.id
     WHERE b.company_id = $1
     GROUP BY b.id, p.id
     ORDER BY b.id DESC`,
    [companyId]
  );

  return result.rows;
}

async function getBom(bomId, companyId) {
  bomId = parsePositiveId(bomId, "BOM ID");

  const result = await pool.query(
    `SELECT
       b.id,
       b.company_id,
       b.product_id,
       p.sku AS product_sku,
       p.name AS product_name,
       b.bom_code,
       b.name,
       b.status,
       b.description,
       b.created_at,
       b.updated_at
     FROM boms b
     JOIN products p
       ON p.id = b.product_id
      AND p.company_id = b.company_id
     WHERE b.id = $1
       AND b.company_id = $2`,
    [bomId, companyId]
  );

  if (result.rows.length === 0) {
    throw new Error("BOM not found");
  }

  const bom = result.rows[0];

  const versionsResult = await pool.query(
    `SELECT
       bv.id,
       bv.bom_id,
       bv.version_number,
       bv.effective_from,
       bv.effective_to,
       bv.status,
       bv.notes,
       bv.created_at
     FROM bom_versions bv
     JOIN boms b ON b.id = bv.bom_id
     WHERE bv.bom_id = $1
       AND b.company_id = $2
     ORDER BY bv.version_number DESC`,
    [bomId, companyId]
  );

  const versions = [];

  for (const version of versionsResult.rows) {
    const componentsResult = await pool.query(
      `SELECT
         bc.id,
         bc.bom_version_id,
         bc.component_product_id,
         p.sku AS component_sku,
         p.name AS component_name,
         p.product_type AS component_product_type,
         bc.quantity_required,
         bc.scrap_percent,
         bc.issue_method,
         bc.sequence_no,
         bc.notes
       FROM bom_components bc
       JOIN bom_versions bv ON bv.id = bc.bom_version_id
       JOIN boms b ON b.id = bv.bom_id
       JOIN products p
         ON p.id = bc.component_product_id
        AND p.company_id = b.company_id
       WHERE bc.bom_version_id = $1
         AND b.company_id = $2
       ORDER BY bc.sequence_no`,
      [version.id, companyId]
    );

    versions.push({
      ...version,
      components: componentsResult.rows,
    });
  }

  return { ...bom, versions };
}

async function createBom({
  companyId,
  productId,
  bomCode,
  name,
  description = null,
  effectiveFrom,
  notes = null,
}) {
  productId = parsePositiveId(productId, "product ID");

  if (typeof bomCode !== "string" || !bomCode.trim()) {
    throw new Error("BOM code is required");
  }

  if (typeof name !== "string" || !name.trim()) {
    throw new Error("BOM name is required");
  }

  if (
    typeof effectiveFrom !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) ||
    Number.isNaN(Date.parse(`${effectiveFrom}T00:00:00Z`)) ||
    new Date(`${effectiveFrom}T00:00:00Z`)
      .toISOString()
      .slice(0, 10) !== effectiveFrom
  ) {
    throw new Error("A valid effectiveFrom date in YYYY-MM-DD format is required");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const productResult = await client.query(
      `SELECT id, product_type, status
       FROM products
       WHERE id = $1 AND company_id = $2
       FOR UPDATE`,
      [productId, companyId]
    );

    if (productResult.rows.length === 0) {
      throw new Error("Product not found for this company");
    }

    if (productResult.rows[0].status !== "ACTIVE") {
      throw new Error("BOM product must be active");
    }

    const bomResult = await client.query(
      `INSERT INTO boms (
         company_id,
         product_id,
         bom_code,
         name,
         status,
         description,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5, NOW(), NOW())
       RETURNING *`,
      [
        companyId,
        productId,
        bomCode.trim(),
        name.trim(),
        description,
      ]
    );

    const bom = bomResult.rows[0];

    const versionResult = await client.query(
      `INSERT INTO bom_versions (
         bom_id,
         version_number,
         effective_from,
         status,
         notes,
         created_at
       )
       VALUES ($1, 1, $2, 'DRAFT', $3, NOW())
       RETURNING *`,
      [bom.id, effectiveFrom, notes]
    );

    await client.query("COMMIT");

    return {
      ...bom,
      versions: [versionResult.rows[0]],
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw new Error("BOM code already exists for this company");
    }

    throw error;
  } finally {
    client.release();
  }
}

async function createBomVersion({
  bomId,
  companyId,
  effectiveFrom,
  notes = null,
}) {
  bomId = parsePositiveId(bomId, "BOM ID");

  if (
    typeof effectiveFrom !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) ||
    Number.isNaN(Date.parse(`${effectiveFrom}T00:00:00Z`)) ||
    new Date(`${effectiveFrom}T00:00:00Z`)
      .toISOString()
      .slice(0, 10) !== effectiveFrom
  ) {
    throw new Error("A valid effectiveFrom date in YYYY-MM-DD format is required");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const bomResult = await client.query(
      `SELECT id, status
       FROM boms
       WHERE id = $1 AND company_id = $2
       FOR UPDATE`,
      [bomId, companyId]
    );

    if (bomResult.rows.length === 0) {
      throw new Error("BOM not found");
    }

    if (bomResult.rows[0].status !== "ACTIVE") {
      throw new Error("Cannot create a version for an inactive BOM");
    }

    const numberResult = await client.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
       FROM bom_versions
       WHERE bom_id = $1`,
      [bomId]
    );

    const versionNumber = Number(numberResult.rows[0].next_version);

    const result = await client.query(
      `INSERT INTO bom_versions (
         bom_id,
         version_number,
         effective_from,
         status,
         notes,
         created_at
       )
       VALUES ($1, $2, $3, 'DRAFT', $4, NOW())
       RETURNING *`,
      [bomId, versionNumber, effectiveFrom, notes]
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function addBomComponent({
  bomVersionId,
  companyId,
  componentProductId,
  quantityRequired,
  scrapPercent = 0,
  issueMethod = "MANUAL",
  sequenceNo,
  notes = null,
}) {
  bomVersionId = parsePositiveId(bomVersionId, "BOM version ID");
  componentProductId = parsePositiveId(
    componentProductId,
    "component product ID"
  );

  const quantity = Number(quantityRequired);
  const scrap = Number(scrapPercent);
  const sequence = Number(sequenceNo);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("quantityRequired must be greater than zero");
  }

  if (!Number.isFinite(scrap) || scrap < 0 || scrap > 100) {
    throw new Error("scrapPercent must be between 0 and 100");
  }

  if (!Number.isSafeInteger(sequence) || sequence <= 0) {
    throw new Error("sequenceNo must be a positive integer");
  }

  if (!ISSUE_METHODS.includes(issueMethod)) {
    throw new Error("issueMethod must be MANUAL or BACKFLUSH");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const versionResult = await client.query(
      `SELECT bv.id, bv.status, b.product_id
       FROM bom_versions bv
       JOIN boms b ON b.id = bv.bom_id
       WHERE bv.id = $1
         AND b.company_id = $2
       FOR UPDATE OF bv`,
      [bomVersionId, companyId]
    );

    if (versionResult.rows.length === 0) {
      throw new Error("BOM version not found for this company");
    }

    if (versionResult.rows[0].status !== "DRAFT") {
      throw new Error("Components can only be added to a DRAFT BOM version");
    }

    if (
      Number(versionResult.rows[0].product_id) === componentProductId
    ) {
      throw new Error("A BOM product cannot be its own component");
    }

    const productResult = await client.query(
      `SELECT id, status
       FROM products
       WHERE id = $1 AND company_id = $2`,
      [componentProductId, companyId]
    );

    if (productResult.rows.length === 0) {
      throw new Error("Component product not found for this company");
    }

    if (productResult.rows[0].status !== "ACTIVE") {
      throw new Error("Component product must be active");
    }

    const result = await client.query(
      `INSERT INTO bom_components (
         bom_version_id,
         component_product_id,
         quantity_required,
         scrap_percent,
         issue_method,
         sequence_no,
         notes,
         created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [
        bomVersionId,
        componentProductId,
        quantity,
        scrap,
        issueMethod,
        sequence,
        notes,
      ]
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw new Error("This sequence number already exists in the BOM version");
    }

    throw error;
  } finally {
    client.release();
  }
}

async function changeBomStatus(bomId, companyId, status) {
  bomId = parsePositiveId(bomId, "BOM ID");

  if (!BOM_STATUSES.includes(status)) {
    throw new Error("Status must be ACTIVE or INACTIVE");
  }

  const result = await pool.query(
    `UPDATE boms
     SET status = $1, updated_at = NOW()
     WHERE id = $2 AND company_id = $3
     RETURNING *`,
    [status, bomId, companyId]
  );

  if (result.rows.length === 0) {
    throw new Error("BOM not found");
  }

  return result.rows[0];
}

async function activateBomVersion({ bomVersionId, companyId }) {
  bomVersionId = parsePositiveId(
    bomVersionId,
    "BOM version ID"
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const versionResult = await client.query(
      `SELECT
         bv.id,
         bv.bom_id,
         bv.status,
         b.status AS bom_status
       FROM bom_versions bv
       JOIN boms b ON b.id = bv.bom_id
       WHERE bv.id = $1
         AND b.company_id = $2
       FOR UPDATE OF bv, b`,
      [bomVersionId, companyId]
    );

    if (versionResult.rows.length === 0) {
      throw new Error("BOM version not found");
    }

    const version = versionResult.rows[0];

    if (version.bom_status !== "ACTIVE") {
      throw new Error("Cannot activate a version of an inactive BOM");
    }

    if (version.status !== "DRAFT" && version.status !== "ACTIVE") {
      throw new Error("Only a draft BOM version can be activated");
    }

    const componentResult = await client.query(
      `SELECT COUNT(*)::integer AS component_count
       FROM bom_components
       WHERE bom_version_id = $1`,
      [bomVersionId]
    );

    if (componentResult.rows[0].component_count < 1) {
      throw new Error("Add at least one component before activating the BOM version");
    }

    const dateResult = await client.query(
      `SELECT effective_from
       FROM bom_versions
       WHERE id = $1`,
      [bomVersionId]
    );

    if (
      new Date(dateResult.rows[0].effective_from).getTime() >
      new Date().setHours(0, 0, 0, 0)
    ) {
      throw new Error("Cannot activate a BOM version before its effective date");
    }

    // Deactivate the previous active version of this BOM.
    await client.query(
      `UPDATE bom_versions
       SET status = 'INACTIVE',
           effective_to = CURRENT_DATE - 1
       WHERE bom_id = $1
         AND id <> $2
         AND status = 'ACTIVE'`,
      [version.bom_id, bomVersionId]
    );

    const result = await client.query(
      `UPDATE bom_versions
       SET status = 'ACTIVE',
           effective_to = NULL
       WHERE id = $1
       RETURNING *`,
      [bomVersionId]
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listBoms,
  getBom,
  createBom,
  createBomVersion,
  addBomComponent,
  changeBomStatus,
  activateBomVersion,
};
