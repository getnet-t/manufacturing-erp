-- ============================================================
-- MANUFACTURING ERP
-- Migration 003
-- Inventory Engine
-- ============================================================

BEGIN;

-- ============================================================
-- INVENTORY TRANSACTIONS
-- ============================================================

CREATE TABLE inventory_transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,

    document_no VARCHAR(100) NOT NULL,

    transaction_type VARCHAR(40) NOT NULL
        CHECK (
            transaction_type IN (
                'PURCHASE_RECEIPT',
                'SALES_ISSUE',
                'SALES_RETURN',
                'PRODUCTION_ISSUE',
                'PRODUCTION_OUTPUT',
                'WAREHOUSE_TRANSFER',
                'STOCK_ADJUSTMENT',
                'SCRAP',
                'REWORK',
                'OPENING_BALANCE'
            )
        ),

    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (
            status IN (
                'DRAFT',
                'POSTED',
                'CANCELLED',
                'REVERSED'
            )
        ),

    source_document_type VARCHAR(100),
    source_document_id BIGINT,

    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,

    posted_at TIMESTAMPTZ,
    posted_by BIGINT,

    idempotency_key VARCHAR(150),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_inventory_transactions_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_transactions_posted_by
        FOREIGN KEY (posted_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT uq_inventory_transaction_document
        UNIQUE (company_id, document_no)
);

CREATE UNIQUE INDEX uq_inventory_transaction_idempotency
    ON inventory_transactions(company_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX idx_inventory_transactions_company_date
    ON inventory_transactions(company_id, transaction_date);

CREATE INDEX idx_inventory_transactions_type_status
    ON inventory_transactions(transaction_type, status);

CREATE INDEX idx_inventory_transactions_source
    ON inventory_transactions(source_document_type, source_document_id);


-- ============================================================
-- INVENTORY MOVEMENT LINES
-- ============================================================

CREATE TABLE inventory_movement_lines (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    inventory_transaction_id BIGINT NOT NULL,

    product_id BIGINT NOT NULL,

    warehouse_id BIGINT NOT NULL,
    location_id BIGINT,

    quantity_delta NUMERIC(18,6) NOT NULL,

    unit_cost NUMERIC(18,6) NOT NULL DEFAULT 0,

    value_delta NUMERIC(18,2) NOT NULL DEFAULT 0,

    movement_direction VARCHAR(10) NOT NULL
        CHECK (
            movement_direction IN (
                'IN',
                'OUT'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_inventory_movement_transaction
        FOREIGN KEY (inventory_transaction_id)
        REFERENCES inventory_transactions(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_movement_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_movement_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_movement_location
        FOREIGN KEY (location_id)
        REFERENCES warehouse_locations(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_inventory_movement_quantity
        CHECK (quantity_delta <> 0),

    CONSTRAINT chk_inventory_movement_unit_cost
        CHECK (unit_cost >= 0),

    CONSTRAINT chk_inventory_movement_value
        CHECK (value_delta >= 0),

    CONSTRAINT chk_inventory_movement_direction
        CHECK (
            (
                movement_direction = 'IN'
                AND quantity_delta > 0
            )
            OR
            (
                movement_direction = 'OUT'
                AND quantity_delta < 0
            )
        )
);

CREATE INDEX idx_inventory_movement_product_warehouse
    ON inventory_movement_lines(product_id, warehouse_id);

CREATE INDEX idx_inventory_movement_warehouse_product
    ON inventory_movement_lines(warehouse_id, product_id);

CREATE INDEX idx_inventory_movement_transaction
    ON inventory_movement_lines(inventory_transaction_id);

CREATE INDEX idx_inventory_movement_product
    ON inventory_movement_lines(product_id);

CREATE INDEX idx_inventory_movement_location
    ON inventory_movement_lines(location_id);


-- ============================================================
-- INVENTORY BATCHES / LOTS
-- ============================================================

CREATE TABLE inventory_batches (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,

    product_id BIGINT NOT NULL,

    batch_no VARCHAR(100) NOT NULL,

    supplier_batch_no VARCHAR(100),

    manufactured_at DATE,

    expires_at DATE,

    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
        CHECK (
            status IN (
                'AVAILABLE',
                'QUARANTINE',
                'BLOCKED',
                'EXPIRED',
                'CONSUMED'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_inventory_batches_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_batches_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_inventory_batch
        UNIQUE (company_id, product_id, batch_no),

    CONSTRAINT chk_inventory_batch_dates
        CHECK (
            expires_at IS NULL
            OR manufactured_at IS NULL
            OR expires_at >= manufactured_at
        )
);

CREATE INDEX idx_inventory_batches_product_status
    ON inventory_batches(product_id, status);

CREATE INDEX idx_inventory_batches_expiry
    ON inventory_batches(product_id, expires_at);

CREATE INDEX idx_inventory_batches_company
    ON inventory_batches(company_id);


-- ============================================================
-- INVENTORY BATCH MOVEMENTS
-- ============================================================

CREATE TABLE inventory_batch_movements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    movement_line_id BIGINT NOT NULL,

    batch_id BIGINT NOT NULL,

    quantity NUMERIC(18,6) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_batch_movements_movement_line
        FOREIGN KEY (movement_line_id)
        REFERENCES inventory_movement_lines(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_batch_movements_batch
        FOREIGN KEY (batch_id)
        REFERENCES inventory_batches(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_batch_movement_quantity
        CHECK (quantity > 0),

    CONSTRAINT uq_batch_movement_line_batch
        UNIQUE (movement_line_id, batch_id)
);

CREATE INDEX idx_batch_movements_batch
    ON inventory_batch_movements(batch_id);

CREATE INDEX idx_batch_movements_line
    ON inventory_batch_movements(movement_line_id);


-- ============================================================
-- WAREHOUSE INVENTORY BALANCES
-- ============================================================

CREATE TABLE inventory_balances (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,

    product_id BIGINT NOT NULL,

    warehouse_id BIGINT NOT NULL,

    on_hand_qty NUMERIC(18,6) NOT NULL DEFAULT 0,

    reserved_qty NUMERIC(18,6) NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_inventory_balances_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_balances_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_balances_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_inventory_balance_on_hand
        CHECK (on_hand_qty >= 0),

    CONSTRAINT chk_inventory_balance_reserved
        CHECK (reserved_qty >= 0),

    CONSTRAINT chk_inventory_balance_reserved_not_above_stock
        CHECK (reserved_qty <= on_hand_qty),

    CONSTRAINT uq_inventory_balance
        UNIQUE (company_id, product_id, warehouse_id)
);

CREATE INDEX idx_inventory_balances_product_warehouse
    ON inventory_balances(product_id, warehouse_id);

CREATE INDEX idx_inventory_balances_warehouse_product
    ON inventory_balances(warehouse_id, product_id);


-- ============================================================
-- COMPANY-WIDE INVENTORY VALUATION
-- ============================================================

CREATE TABLE inventory_valuation_balances (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,

    product_id BIGINT NOT NULL,

    on_hand_qty NUMERIC(18,6) NOT NULL DEFAULT 0,

    inventory_value NUMERIC(18,2) NOT NULL DEFAULT 0,

    average_cost NUMERIC(18,6) NOT NULL DEFAULT 0,

    last_valuation_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_inventory_valuation_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_valuation_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_inventory_valuation_quantity
        CHECK (on_hand_qty >= 0),

    CONSTRAINT chk_inventory_valuation_value
        CHECK (inventory_value >= 0),

    CONSTRAINT chk_inventory_valuation_average_cost
        CHECK (average_cost >= 0),

    CONSTRAINT uq_inventory_valuation
        UNIQUE (company_id, product_id)
);

CREATE INDEX idx_inventory_valuation_product
    ON inventory_valuation_balances(product_id);


-- ============================================================
-- INVENTORY RESERVATIONS
-- ============================================================

CREATE TABLE inventory_reservations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,

    product_id BIGINT NOT NULL,

    warehouse_id BIGINT NOT NULL,

    batch_id BIGINT,

    source_document_type VARCHAR(100) NOT NULL,

    source_document_id BIGINT NOT NULL,

    quantity NUMERIC(18,6) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'RESERVED'
        CHECK (
            status IN (
                'RESERVED',
                'RELEASED',
                'CONSUMED',
                'CANCELLED'
            )
        ),

    reserved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    released_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_inventory_reservations_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_reservations_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_reservations_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_reservations_batch
        FOREIGN KEY (batch_id)
        REFERENCES inventory_batches(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_inventory_reservation_quantity
        CHECK (quantity > 0)
);

CREATE INDEX idx_inventory_reservations_product_warehouse_status
    ON inventory_reservations(product_id, warehouse_id, status);

CREATE INDEX idx_inventory_reservations_source
    ON inventory_reservations(source_document_type, source_document_id);

CREATE INDEX idx_inventory_reservations_batch
    ON inventory_reservations(batch_id);


-- ============================================================
-- FINISHED
-- ============================================================

COMMIT;

