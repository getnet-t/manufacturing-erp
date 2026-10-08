BEGIN;

-- ============================================================
-- QUALITY INSPECTIONS
-- ============================================================

CREATE TABLE quality_inspections (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,

    inspection_number VARCHAR(100) NOT NULL,

    inspection_type VARCHAR(30) NOT NULL
        CHECK (
            inspection_type IN (
                'PURCHASE_RECEIPT',
                'PRODUCTION_OUTPUT',
                'SALES_RETURN',
                'STOCK'
            )
        ),

    supplier_id BIGINT,
    purchase_order_id BIGINT,
    goods_receipt_id BIGINT,

    production_order_id BIGINT,
    production_output_id BIGINT,

    product_id BIGINT NOT NULL,
    batch_id BIGINT,

    warehouse_id BIGINT,

    inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,

    quantity_inspected NUMERIC(18,6) NOT NULL
        CHECK (quantity_inspected > 0),

    quantity_accepted NUMERIC(18,6) NOT NULL DEFAULT 0
        CHECK (quantity_accepted >= 0),

    quantity_rejected NUMERIC(18,6) NOT NULL DEFAULT 0
        CHECK (quantity_rejected >= 0),

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'IN_PROGRESS',
                'PASSED',
                'FAILED',
                'PARTIALLY_PASSED',
                'CANCELLED'
            )
        ),

    inspection_result VARCHAR(20)
        CHECK (
            inspection_result IS NULL
            OR inspection_result IN (
                'PASS',
                'FAIL',
                'PARTIAL'
            )
        ),

    inspector_id BIGINT,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_quality_inspections_company_number
        UNIQUE (company_id, inspection_number),

    CONSTRAINT chk_quality_inspection_quantities
        CHECK (
            quantity_accepted + quantity_rejected
            <= quantity_inspected
        ),

    CONSTRAINT fk_quality_inspections_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_quality_inspections_supplier
        FOREIGN KEY (supplier_id)
        REFERENCES suppliers(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_quality_inspections_purchase_order
        FOREIGN KEY (purchase_order_id)
        REFERENCES purchase_orders(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_quality_inspections_goods_receipt
        FOREIGN KEY (goods_receipt_id)
        REFERENCES goods_receipts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_quality_inspections_production_order
        FOREIGN KEY (production_order_id)
        REFERENCES production_orders(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_quality_inspections_production_output
        FOREIGN KEY (production_output_id)
        REFERENCES production_outputs(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_quality_inspections_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_quality_inspections_batch
        FOREIGN KEY (batch_id)
        REFERENCES inventory_batches(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_quality_inspections_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_quality_inspections_inspector
        FOREIGN KEY (inspector_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_quality_inspections_company_date
    ON quality_inspections(company_id, inspection_date);

CREATE INDEX idx_quality_inspections_product
    ON quality_inspections(product_id);

CREATE INDEX idx_quality_inspections_batch
    ON quality_inspections(batch_id);

CREATE INDEX idx_quality_inspections_status
    ON quality_inspections(company_id, status);

CREATE INDEX idx_quality_inspections_supplier
    ON quality_inspections(supplier_id);

CREATE INDEX idx_quality_inspections_production_order
    ON quality_inspections(production_order_id);


-- ============================================================
-- QUALITY INSPECTION RESULTS
-- ============================================================

CREATE TABLE quality_inspection_results (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    quality_inspection_id BIGINT NOT NULL,

    parameter_name VARCHAR(150) NOT NULL,

    parameter_code VARCHAR(50),

    specification VARCHAR(255),

    target_value VARCHAR(100),

    actual_value VARCHAR(100),

    unit VARCHAR(50),

    result_status VARCHAR(20) NOT NULL
        CHECK (
            result_status IN (
                'PASS',
                'FAIL',
                'WARNING',
                'NOT_TESTED'
            )
        ),

    measured_numeric_value NUMERIC(18,6),

    lower_limit NUMERIC(18,6),

    upper_limit NUMERIC(18,6),

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_quality_numeric_limits
        CHECK (
            lower_limit IS NULL
            OR upper_limit IS NULL
            OR upper_limit >= lower_limit
        ),

    CONSTRAINT fk_quality_inspection_results_inspection
        FOREIGN KEY (quality_inspection_id)
        REFERENCES quality_inspections(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_quality_inspection_results_inspection
    ON quality_inspection_results(quality_inspection_id);

CREATE INDEX idx_quality_inspection_results_status
    ON quality_inspection_results(result_status);

CREATE INDEX idx_quality_inspection_results_parameter
    ON quality_inspection_results(parameter_code);


-- ============================================================
-- FINISHED
-- ============================================================

COMMIT;
