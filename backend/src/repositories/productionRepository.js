
const pool = require("../config/database");

async function listProductionOrders(companyId) {
  const result = await pool.query(
    `SELECT
       po.id,
       po.company_id,
       po.factory_id,
       po.warehouse_id,
       po.product_id,
       po.bom_version_id,
       po.production_order_number,
       po.order_type,
       po.status,
       po.planned_quantity,
       po.produced_quantity,
       po.rejected_quantity,
       po.planned_start_date,
       po.planned_end_date,
       po.actual_start_date,
       po.actual_end_date,
       po.notes,
       po.created_at,
       p.sku AS product_sku,
       p.name AS product_name
     FROM production_orders po
     JOIN products p
       ON p.id = po.product_id
      AND p.company_id = po.company_id
     WHERE po.company_id = $1
     ORDER BY po.created_at DESC, po.id DESC`,
    [companyId]
  );

  return result.rows;
}

async function getProductionOrderById(orderId, companyId) {
  const result = await pool.query(
    `SELECT
       po.*,
       p.sku AS product_sku,
       p.name AS product_name
     FROM production_orders po
     JOIN products p
       ON p.id = po.product_id
      AND p.company_id = po.company_id
     WHERE po.id = $1
       AND po.company_id = $2`,
    [orderId, companyId]
  );

  return result.rows[0] || null;
}

async function createProductionOrder({
  companyId,
  factoryId,
  warehouseId,
  productId,
  bomVersionId,
  productionOrderNumber,
  orderType,
  plannedQuantity,
  plannedStartDate,
  plannedEndDate,
  notes,
  createdBy,
}) {
  const result = await pool.query(
    `INSERT INTO production_orders (
       company_id,
       factory_id,
       warehouse_id,
       product_id,
       bom_version_id,
       production_order_number,
       order_type,
       planned_quantity,
       planned_start_date,
       planned_end_date,
       notes,
       created_by
     )
     SELECT
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
     WHERE EXISTS (
       SELECT 1
       FROM factories f
       JOIN warehouses w
         ON w.factory_id = f.id
       JOIN products p
         ON p.id = $4
        AND p.company_id = f.company_id
       JOIN bom_versions bv
         ON bv.id = $5
        AND bv.status = 'ACTIVE'
       JOIN boms b
         ON b.id = bv.bom_id
        AND b.company_id = f.company_id
        AND b.product_id = p.id
        AND b.status = 'ACTIVE'
       WHERE f.id = $2
         AND f.company_id = $1
         AND f.status = 'ACTIVE'
         AND w.id = $3
         AND w.status = 'ACTIVE'
     )
     RETURNING *`,
    [
      companyId,
      factoryId,
      warehouseId,
      productId,
      bomVersionId,
      productionOrderNumber,
      orderType,
      plannedQuantity,
      plannedStartDate || null,
      plannedEndDate || null,
      notes || null,
      createdBy || null,
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  listProductionOrders,
  getProductionOrderById,
  createProductionOrder,
};
