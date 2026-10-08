BEGIN;

-- ============================================================
-- CUSTOMERS
-- ============================================================

CREATE TABLE customers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,

    customer_code VARCHAR(50) NOT NULL,
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

    CONSTRAINT uq_customers_company_code
        UNIQUE (company_id, customer_code),

    CONSTRAINT fk_customers_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_customers_company
    ON customers(company_id);

CREATE INDEX idx_customers_name
    ON customers(company_id, name);


-- ============================================================
-- SALES ORDERS
-- ============================================================

CREATE TABLE sales_orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,
    customer_id BIGINT NOT NULL,

    order_number VARCHAR(100) NOT NULL,

    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,

    currency CHAR(3) NOT NULL DEFAULT 'ETB',

    order_type VARCHAR(20) NOT NULL DEFAULT 'STANDARD'
        CHECK (
            order_type IN (
                'STANDARD',
                'MAKE_TO_ORDER'
            )
        ),

    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
        CHECK (
            status IN (
                'DRAFT',
                'CONFIRMED',
                'PARTIALLY_DELIVERED',
                'DELIVERED',
                'CANCELLED',
                'CLOSED'
            )
        ),

    subtotal NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (subtotal >= 0),

    discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (discount_amount >= 0),

    tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (tax_amount >= 0),

    total_amount NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (total_amount >= 0),

    notes TEXT,

    created_by BIGINT,
    approved_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_sales_orders_company_number
        UNIQUE (company_id, order_number),

    CONSTRAINT chk_sales_orders_dates
        CHECK (
            expected_delivery_date IS NULL
            OR expected_delivery_date >= order_date
        ),

    CONSTRAINT fk_sales_orders_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_orders_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_orders_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_sales_orders_approved_by
        FOREIGN KEY (approved_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_sales_orders_customer
    ON sales_orders(customer_id);

CREATE INDEX idx_sales_orders_company_date
    ON sales_orders(company_id, order_date);

CREATE INDEX idx_sales_orders_status
    ON sales_orders(company_id, status);


-- ============================================================
-- SALES ORDER LINES
-- ============================================================

CREATE TABLE sales_order_lines (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    sales_order_id BIGINT NOT NULL,

    product_id BIGINT NOT NULL,

    ordered_qty NUMERIC(18,6) NOT NULL
        CHECK (ordered_qty > 0),

    delivered_qty NUMERIC(18,6) NOT NULL DEFAULT 0
        CHECK (delivered_qty >= 0),

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

    CONSTRAINT chk_sales_order_lines_delivered
        CHECK (delivered_qty <= ordered_qty),

    CONSTRAINT fk_sales_order_lines_order
        FOREIGN KEY (sales_order_id)
        REFERENCES sales_orders(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_order_lines_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_sales_order_lines_order
    ON sales_order_lines(sales_order_id);

CREATE INDEX idx_sales_order_lines_product
    ON sales_order_lines(product_id);


-- ============================================================
-- SALES DELIVERIES
-- ============================================================

CREATE TABLE sales_deliveries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,

    sales_order_id BIGINT,
    customer_id BIGINT NOT NULL,

    warehouse_id BIGINT NOT NULL,

    delivery_number VARCHAR(100) NOT NULL,

    delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,

    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (
            status IN (
                'DRAFT',
                'POSTED',
                'CANCELLED',
                'REVERSED'
            )
        ),

    inventory_transaction_id BIGINT,

    notes TEXT,

    delivered_by BIGINT,
    posted_by BIGINT,

    posted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_sales_deliveries_company_number
        UNIQUE (company_id, delivery_number),

    CONSTRAINT fk_sales_deliveries_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_deliveries_sales_order
        FOREIGN KEY (sales_order_id)
        REFERENCES sales_orders(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_deliveries_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_deliveries_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_deliveries_inventory_transaction
        FOREIGN KEY (inventory_transaction_id)
        REFERENCES inventory_transactions(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_deliveries_delivered_by
        FOREIGN KEY (delivered_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_sales_deliveries_posted_by
        FOREIGN KEY (posted_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_sales_deliveries_order
    ON sales_deliveries(sales_order_id);

CREATE INDEX idx_sales_deliveries_customer
    ON sales_deliveries(customer_id);

CREATE INDEX idx_sales_deliveries_warehouse
    ON sales_deliveries(warehouse_id);

CREATE INDEX idx_sales_deliveries_company_date
    ON sales_deliveries(company_id, delivery_date);


-- ============================================================
-- SALES DELIVERY LINES
-- ============================================================

CREATE TABLE sales_delivery_lines (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    sales_delivery_id BIGINT NOT NULL,

    sales_order_line_id BIGINT,

    product_id BIGINT NOT NULL,

    batch_id BIGINT,

    location_id BIGINT,

    inventory_movement_line_id BIGINT,

    delivered_qty NUMERIC(18,6) NOT NULL
        CHECK (delivered_qty > 0),

    unit_cost NUMERIC(18,6) NOT NULL
        CHECK (unit_cost >= 0),

    cost_amount NUMERIC(18,2) NOT NULL
        CHECK (cost_amount >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sales_delivery_lines_delivery
        FOREIGN KEY (sales_delivery_id)
        REFERENCES sales_deliveries(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_delivery_lines_order_line
        FOREIGN KEY (sales_order_line_id)
        REFERENCES sales_order_lines(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_delivery_lines_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_delivery_lines_batch
        FOREIGN KEY (batch_id)
        REFERENCES inventory_batches(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_delivery_lines_location
        FOREIGN KEY (location_id)
        REFERENCES warehouse_locations(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_delivery_lines_movement
        FOREIGN KEY (inventory_movement_line_id)
        REFERENCES inventory_movement_lines(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_sales_delivery_lines_delivery
    ON sales_delivery_lines(sales_delivery_id);

CREATE INDEX idx_sales_delivery_lines_product
    ON sales_delivery_lines(product_id);

CREATE INDEX idx_sales_delivery_lines_batch
    ON sales_delivery_lines(batch_id);


-- ============================================================
-- SALES INVOICES
-- ============================================================

CREATE TABLE sales_invoices (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,
    customer_id BIGINT NOT NULL,

    sales_order_id BIGINT,
    sales_delivery_id BIGINT,

    invoice_number VARCHAR(100) NOT NULL,
    customer_invoice_number VARCHAR(100),

    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,

    currency CHAR(3) NOT NULL DEFAULT 'ETB',

    invoice_type VARCHAR(20) NOT NULL DEFAULT 'SALE'
        CHECK (
            invoice_type IN (
                'SALE',
                'CREDIT_NOTE'
            )
        ),

    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
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

    discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (discount_amount >= 0),

    tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (tax_amount >= 0),

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

    CONSTRAINT uq_sales_invoices_company_number
        UNIQUE (company_id, invoice_number),

    CONSTRAINT chk_sales_invoice_dates
        CHECK (
            due_date IS NULL
            OR due_date >= invoice_date
        ),

    CONSTRAINT chk_sales_invoice_paid
        CHECK (paid_amount <= total_amount),

    CONSTRAINT fk_sales_invoices_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_invoices_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_invoices_sales_order
        FOREIGN KEY (sales_order_id)
        REFERENCES sales_orders(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_invoices_sales_delivery
        FOREIGN KEY (sales_delivery_id)
        REFERENCES sales_deliveries(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_invoices_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_sales_invoices_posted_by
        FOREIGN KEY (posted_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_sales_invoices_customer
    ON sales_invoices(customer_id);

CREATE INDEX idx_sales_invoices_company_date
    ON sales_invoices(company_id, invoice_date);

CREATE INDEX idx_sales_invoices_status
    ON sales_invoices(company_id, status);


-- ============================================================
-- SALES INVOICE LINES
-- ============================================================

CREATE TABLE sales_invoice_lines (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    sales_invoice_id BIGINT NOT NULL,

    product_id BIGINT,

    description VARCHAR(255) NOT NULL,

    quantity NUMERIC(18,6),

    unit_price NUMERIC(18,6),

    line_amount NUMERIC(18,2) NOT NULL
        CHECK (line_amount >= 0),

    tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (tax_amount >= 0),

    cost_amount NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (cost_amount >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sales_invoice_lines_invoice
        FOREIGN KEY (sales_invoice_id)
        REFERENCES sales_invoices(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_invoice_lines_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_sales_invoice_lines_invoice
    ON sales_invoice_lines(sales_invoice_id);

CREATE INDEX idx_sales_invoice_lines_product
    ON sales_invoice_lines(product_id);


-- ============================================================
-- CUSTOMER PAYMENTS
-- ============================================================

CREATE TABLE customer_payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,
    customer_id BIGINT NOT NULL,

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

    CONSTRAINT uq_customer_payments_company_number
        UNIQUE (company_id, payment_number),

    CONSTRAINT fk_customer_payments_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_customer_payments_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_customer_payments_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_customer_payments_customer
    ON customer_payments(customer_id);

CREATE INDEX idx_customer_payments_company_date
    ON customer_payments(company_id, payment_date);


-- ============================================================
-- CUSTOMER PAYMENT ALLOCATIONS
-- ============================================================

CREATE TABLE customer_payment_allocations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    customer_payment_id BIGINT NOT NULL,
    sales_invoice_id BIGINT NOT NULL,

    allocated_amount NUMERIC(18,2) NOT NULL
        CHECK (allocated_amount > 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_customer_payment_invoice
        UNIQUE (customer_payment_id, sales_invoice_id),

    CONSTRAINT fk_customer_payment_allocations_payment
        FOREIGN KEY (customer_payment_id)
        REFERENCES customer_payments(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_customer_payment_allocations_invoice
        FOREIGN KEY (sales_invoice_id)
        REFERENCES sales_invoices(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_customer_payment_allocations_invoice
    ON customer_payment_allocations(sales_invoice_id);


-- ============================================================
-- SALES RETURNS
-- ============================================================

CREATE TABLE sales_returns (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,
    customer_id BIGINT NOT NULL,

    sales_invoice_id BIGINT,
    sales_delivery_id BIGINT,

    warehouse_id BIGINT NOT NULL,

    return_number VARCHAR(100) NOT NULL,

    return_date DATE NOT NULL DEFAULT CURRENT_DATE,

    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (
            status IN (
                'DRAFT',
                'POSTED',
                'CANCELLED',
                'REVERSED'
            )
        ),

    reason VARCHAR(255),

    inventory_transaction_id BIGINT,

    notes TEXT,

    created_by BIGINT,
    posted_by BIGINT,

    posted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_sales_returns_company_number
        UNIQUE (company_id, return_number),

    CONSTRAINT fk_sales_returns_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_returns_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_returns_invoice
        FOREIGN KEY (sales_invoice_id)
        REFERENCES sales_invoices(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_returns_delivery
        FOREIGN KEY (sales_delivery_id)
        REFERENCES sales_deliveries(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_returns_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_returns_inventory_transaction
        FOREIGN KEY (inventory_transaction_id)
        REFERENCES inventory_transactions(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_returns_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_sales_returns_posted_by
        FOREIGN KEY (posted_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_sales_returns_customer
    ON sales_returns(customer_id);

CREATE INDEX idx_sales_returns_invoice
    ON sales_returns(sales_invoice_id);

CREATE INDEX idx_sales_returns_delivery
    ON sales_returns(sales_delivery_id);

CREATE INDEX idx_sales_returns_warehouse
    ON sales_returns(warehouse_id);

CREATE INDEX idx_sales_returns_company_date
    ON sales_returns(company_id, return_date);


-- ============================================================
-- SALES RETURN LINES
-- ============================================================

CREATE TABLE sales_return_lines (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    sales_return_id BIGINT NOT NULL,

    product_id BIGINT NOT NULL,

    batch_id BIGINT,

    location_id BIGINT,

    inventory_movement_line_id BIGINT,

    quantity NUMERIC(18,6) NOT NULL
        CHECK (quantity > 0),

    unit_price NUMERIC(18,6) NOT NULL
        CHECK (unit_price >= 0),

    unit_cost NUMERIC(18,6) NOT NULL DEFAULT 0
        CHECK (unit_cost >= 0),

    sales_amount NUMERIC(18,2) NOT NULL
        CHECK (sales_amount >= 0),

    cost_amount NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (cost_amount >= 0),

    reason VARCHAR(255),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sales_return_lines_return
        FOREIGN KEY (sales_return_id)
        REFERENCES sales_returns(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_return_lines_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_return_lines_batch
        FOREIGN KEY (batch_id)
        REFERENCES inventory_batches(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_return_lines_location
        FOREIGN KEY (location_id)
        REFERENCES warehouse_locations(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_return_lines_movement
        FOREIGN KEY (inventory_movement_line_id)
        REFERENCES inventory_movement_lines(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_sales_return_lines_return
    ON sales_return_lines(sales_return_id);

CREATE INDEX idx_sales_return_lines_product
    ON sales_return_lines(product_id);

CREATE INDEX idx_sales_return_lines_batch
    ON sales_return_lines(batch_id);


-- ============================================================
-- FINISHED
-- ============================================================

COMMIT;
