BEGIN;

-- ============================================================
-- SUPPLIERS
-- ============================================================

CREATE TABLE suppliers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,

    supplier_code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,

    contact_person VARCHAR(150),
    phone VARCHAR(50),
    email VARCHAR(150),
    address TEXT,
    tax_number VARCHAR(100),

    payment_terms_days INTEGER NOT NULL DEFAULT 0
        CHECK (payment_terms_days >= 0),

    credit_limit NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (credit_limit >= 0),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_suppliers_company_code
        UNIQUE (company_id, supplier_code),

    CONSTRAINT fk_suppliers_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_suppliers_company
    ON suppliers(company_id);

CREATE INDEX idx_suppliers_name
    ON suppliers(company_id, name);


-- ============================================================
-- PURCHASE ORDERS
-- ============================================================

CREATE TABLE purchase_orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,
    supplier_id BIGINT NOT NULL,

    po_number VARCHAR(100) NOT NULL,

    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date DATE,

    currency CHAR(3) NOT NULL DEFAULT 'ETB',

    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
        CHECK (
            status IN (
                'DRAFT',
                'APPROVED',
                'PARTIALLY_RECEIVED',
                'RECEIVED',
                'CANCELLED',
                'CLOSED'
            )
        ),

    subtotal NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (subtotal >= 0),

    tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (tax_amount >= 0),

    discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (discount_amount >= 0),

    total_amount NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (total_amount >= 0),

    notes TEXT,

    created_by BIGINT,
    approved_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_purchase_orders_company_number
        UNIQUE (company_id, po_number),

    CONSTRAINT chk_purchase_orders_dates
        CHECK (
            expected_date IS NULL
            OR expected_date >= order_date
        ),

    CONSTRAINT fk_purchase_orders_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_purchase_orders_supplier
        FOREIGN KEY (supplier_id)
        REFERENCES suppliers(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_purchase_orders_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_purchase_orders_approved_by
        FOREIGN KEY (approved_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_purchase_orders_supplier
    ON purchase_orders(supplier_id);

CREATE INDEX idx_purchase_orders_company_date
    ON purchase_orders(company_id, order_date);

CREATE INDEX idx_purchase_orders_status
    ON purchase_orders(company_id, status);


-- ============================================================
-- PURCHASE ORDER LINES
-- ============================================================

CREATE TABLE purchase_order_lines (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    purchase_order_id BIGINT NOT NULL,

    product_id BIGINT NOT NULL,

    ordered_qty NUMERIC(18,6) NOT NULL
        CHECK (ordered_qty > 0),

    received_qty NUMERIC(18,6) NOT NULL DEFAULT 0
        CHECK (received_qty >= 0),

    unit_price NUMERIC(18,6) NOT NULL
        CHECK (unit_price >= 0),

    discount_percent NUMERIC(9,4) NOT NULL DEFAULT 0
        CHECK (
            discount_percent >= 0
            AND discount_percent <= 100
        ),

    tax_percent NUMERIC(9,4) NOT NULL DEFAULT 0
        CHECK (
            tax_percent >= 0
            AND tax_percent <= 100
        ),

    line_total NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (line_total >= 0),

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_purchase_order_lines_received
        CHECK (received_qty <= ordered_qty),

    CONSTRAINT fk_purchase_order_lines_order
        FOREIGN KEY (purchase_order_id)
        REFERENCES purchase_orders(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_purchase_order_lines_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_purchase_order_lines_order
    ON purchase_order_lines(purchase_order_id);

CREATE INDEX idx_purchase_order_lines_product
    ON purchase_order_lines(product_id);


-- ============================================================
-- GOODS RECEIPTS
-- ============================================================

CREATE TABLE goods_receipts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,

    purchase_order_id BIGINT,
    warehouse_id BIGINT NOT NULL,

    receipt_number VARCHAR(100) NOT NULL,

    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,

    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (
            status IN (
                'DRAFT',
                'POSTED',
                'CANCELLED',
                'REVERSED'
            )
        ),

    notes TEXT,

    received_by BIGINT,

    posted_at TIMESTAMPTZ,
    posted_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_goods_receipts_company_number
        UNIQUE (company_id, receipt_number),

    CONSTRAINT fk_goods_receipts_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_goods_receipts_purchase_order
        FOREIGN KEY (purchase_order_id)
        REFERENCES purchase_orders(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_goods_receipts_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_goods_receipts_received_by
        FOREIGN KEY (received_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_goods_receipts_posted_by
        FOREIGN KEY (posted_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_goods_receipts_company_date
    ON goods_receipts(company_id, receipt_date);

CREATE INDEX idx_goods_receipts_purchase_order
    ON goods_receipts(purchase_order_id);

CREATE INDEX idx_goods_receipts_warehouse
    ON goods_receipts(warehouse_id);


-- ============================================================
-- GOODS RECEIPT LINES
-- ============================================================

CREATE TABLE goods_receipt_lines (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    goods_receipt_id BIGINT NOT NULL,

    purchase_order_line_id BIGINT,

    product_id BIGINT NOT NULL,

    batch_id BIGINT,

    location_id BIGINT,

    received_qty NUMERIC(18,6) NOT NULL
        CHECK (received_qty > 0),

    unit_cost NUMERIC(18,6) NOT NULL
        CHECK (unit_cost >= 0),

    line_value NUMERIC(18,2) NOT NULL
        CHECK (line_value >= 0),

    expiry_date DATE,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_goods_receipt_lines_receipt
        FOREIGN KEY (goods_receipt_id)
        REFERENCES goods_receipts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_goods_receipt_lines_po_line
        FOREIGN KEY (purchase_order_line_id)
        REFERENCES purchase_order_lines(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_goods_receipt_lines_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_goods_receipt_lines_batch
        FOREIGN KEY (batch_id)
        REFERENCES inventory_batches(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_goods_receipt_lines_location
        FOREIGN KEY (location_id)
        REFERENCES warehouse_locations(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_goods_receipt_lines_receipt
    ON goods_receipt_lines(goods_receipt_id);

CREATE INDEX idx_goods_receipt_lines_product
    ON goods_receipt_lines(product_id);

CREATE INDEX idx_goods_receipt_lines_batch
    ON goods_receipt_lines(batch_id);


-- ============================================================
-- SUPPLIER INVOICES
-- ============================================================

CREATE TABLE supplier_invoices (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,
    supplier_id BIGINT NOT NULL,

    purchase_order_id BIGINT,

    invoice_number VARCHAR(100) NOT NULL,
    supplier_invoice_number VARCHAR(100),

    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,

    currency CHAR(3) NOT NULL DEFAULT 'ETB',

    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (
            status IN (
                'DRAFT',
                'POSTED',
                'PARTIALLY_PAID',
                'PAID',
                'CANCELLED',
                'REVERSED'
            )
        ),

    subtotal NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (subtotal >= 0),

    tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (tax_amount >= 0),

    discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (discount_amount >= 0),

    total_amount NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (total_amount >= 0),

    paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (paid_amount >= 0),

    balance_amount NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (balance_amount >= 0),

    notes TEXT,

    created_by BIGINT,
    posted_by BIGINT,

    posted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_supplier_invoices_company_number
        UNIQUE (company_id, invoice_number),

    CONSTRAINT chk_supplier_invoice_dates
        CHECK (
            due_date IS NULL
            OR due_date >= invoice_date
        ),

    CONSTRAINT chk_supplier_invoice_paid
        CHECK (paid_amount <= total_amount),

    CONSTRAINT fk_supplier_invoices_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_supplier_invoices_supplier
        FOREIGN KEY (supplier_id)
        REFERENCES suppliers(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_supplier_invoices_purchase_order
        FOREIGN KEY (purchase_order_id)
        REFERENCES purchase_orders(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_supplier_invoices_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_supplier_invoices_posted_by
        FOREIGN KEY (posted_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_supplier_invoices_supplier
    ON supplier_invoices(supplier_id);

CREATE INDEX idx_supplier_invoices_company_date
    ON supplier_invoices(company_id, invoice_date);

CREATE INDEX idx_supplier_invoices_status
    ON supplier_invoices(company_id, status);


-- ============================================================
-- SUPPLIER INVOICE LINES
-- ============================================================

CREATE TABLE supplier_invoice_lines (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    supplier_invoice_id BIGINT NOT NULL,

    product_id BIGINT,

    description VARCHAR(255) NOT NULL,

    quantity NUMERIC(18,6),
    unit_price NUMERIC(18,6),

    line_amount NUMERIC(18,2) NOT NULL
        CHECK (line_amount >= 0),

    tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (tax_amount >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_supplier_invoice_lines_invoice
        FOREIGN KEY (supplier_invoice_id)
        REFERENCES supplier_invoices(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_supplier_invoice_lines_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_supplier_invoice_lines_invoice
    ON supplier_invoice_lines(supplier_invoice_id);

CREATE INDEX idx_supplier_invoice_lines_product
    ON supplier_invoice_lines(product_id);


-- ============================================================
-- SUPPLIER PAYMENTS
-- ============================================================

CREATE TABLE supplier_payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,
    supplier_id BIGINT NOT NULL,

    payment_number VARCHAR(100) NOT NULL,

    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,

    amount NUMERIC(18,2) NOT NULL
        CHECK (amount > 0),

    currency CHAR(3) NOT NULL DEFAULT 'ETB',

    payment_method VARCHAR(30) NOT NULL
        CHECK (
            payment_method IN (
                'CASH',
                'BANK_TRANSFER',
                'CHEQUE',
                'OTHER'
            )
        ),

    reference_number VARCHAR(100),

    status VARCHAR(20) NOT NULL DEFAULT 'POSTED'
        CHECK (
            status IN (
                'DRAFT',
                'POSTED',
                'CANCELLED',
                'REVERSED'
            )
        ),

    notes TEXT,

    created_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_supplier_payments_company_number
        UNIQUE (company_id, payment_number),

    CONSTRAINT fk_supplier_payments_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_supplier_payments_supplier
        FOREIGN KEY (supplier_id)
        REFERENCES suppliers(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_supplier_payments_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_supplier_payments_supplier
    ON supplier_payments(supplier_id);

CREATE INDEX idx_supplier_payments_company_date
    ON supplier_payments(company_id, payment_date);


-- ============================================================
-- SUPPLIER PAYMENT ALLOCATIONS
-- ============================================================

CREATE TABLE supplier_payment_allocations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    supplier_payment_id BIGINT NOT NULL,
    supplier_invoice_id BIGINT NOT NULL,

    allocated_amount NUMERIC(18,2) NOT NULL
        CHECK (allocated_amount > 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_supplier_payment_invoice
        UNIQUE (supplier_payment_id, supplier_invoice_id),

    CONSTRAINT fk_supplier_payment_allocations_payment
        FOREIGN KEY (supplier_payment_id)
        REFERENCES supplier_payments(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_supplier_payment_allocations_invoice
        FOREIGN KEY (supplier_invoice_id)
        REFERENCES supplier_invoices(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_supplier_payment_allocations_invoice
    ON supplier_payment_allocations(supplier_invoice_id);


-- ============================================================
-- FINISHED
-- ============================================================

COMMIT;