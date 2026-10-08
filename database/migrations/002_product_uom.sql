-- ============================================================
-- MANUFACTURING ERP
-- Migration 002
-- Products + Categories + Units of Measure
-- ============================================================

BEGIN;

-- ============================================================
-- UNITS OF MEASURE
-- ============================================================

CREATE TABLE units_of_measure (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,

    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,

    dimension VARCHAR(30) NOT NULL
        CHECK (
            dimension IN (
                'COUNT',
                'WEIGHT',
                'LENGTH',
                'AREA',
                'VOLUME',
                'TIME'
            )
        ),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_uom_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_uom_company_code
        UNIQUE (company_id, code)
);

CREATE INDEX idx_uom_company
    ON units_of_measure(company_id);


-- ============================================================
-- PRODUCT CATEGORIES
-- ============================================================

CREATE TABLE product_categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,

    parent_id BIGINT,

    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_product_categories_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_product_categories_parent
        FOREIGN KEY (parent_id)
        REFERENCES product_categories(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_product_categories_company_code
        UNIQUE (company_id, code)
);

CREATE INDEX idx_product_categories_company
    ON product_categories(company_id);

CREATE INDEX idx_product_categories_parent
    ON product_categories(parent_id);


-- ============================================================
-- PRODUCTS
-- ============================================================

CREATE TABLE products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,

    sku VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,

    product_category_id BIGINT,

    product_type VARCHAR(30) NOT NULL
        CHECK (
            product_type IN (
                'RAW_MATERIAL',
                'SEMI_FINISHED',
                'FINISHED_GOOD',
                'CONSUMABLE',
                'PACKAGING',
                'SPARE_PART'
            )
        ),

    base_uom_id BIGINT NOT NULL,

    purchase_uom_id BIGINT,
    sales_uom_id BIGINT,

    is_purchased BOOLEAN NOT NULL DEFAULT TRUE,
    is_manufactured BOOLEAN NOT NULL DEFAULT FALSE,

    track_batch BOOLEAN NOT NULL DEFAULT TRUE,
    track_expiry BOOLEAN NOT NULL DEFAULT FALSE,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_products_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_products_category
        FOREIGN KEY (product_category_id)
        REFERENCES product_categories(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_products_base_uom
        FOREIGN KEY (base_uom_id)
        REFERENCES units_of_measure(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_products_purchase_uom
        FOREIGN KEY (purchase_uom_id)
        REFERENCES units_of_measure(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_products_sales_uom
        FOREIGN KEY (sales_uom_id)
        REFERENCES units_of_measure(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_products_company_sku
        UNIQUE (company_id, sku),

    CONSTRAINT chk_products_purchasing_or_manufacturing
        CHECK (
            is_purchased = TRUE
            OR is_manufactured = TRUE
        ),

    CONSTRAINT chk_products_expiry_requires_batch
        CHECK (
            track_expiry = FALSE
            OR track_batch = TRUE
        )
);

CREATE INDEX idx_products_company
    ON products(company_id);

CREATE INDEX idx_products_category
    ON products(product_category_id);

CREATE INDEX idx_products_type
    ON products(company_id, product_type);

CREATE INDEX idx_products_status
    ON products(company_id, status);

CREATE INDEX idx_products_name
    ON products(company_id, name);


-- ============================================================
-- PRODUCT UOM CONVERSIONS
-- ============================================================

CREATE TABLE product_uom_conversions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    product_id BIGINT NOT NULL,

    from_uom_id BIGINT NOT NULL,
    to_uom_id BIGINT NOT NULL,

    factor NUMERIC(18,6) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_product_uom_conversions_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_product_uom_conversions_from_uom
        FOREIGN KEY (from_uom_id)
        REFERENCES units_of_measure(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_product_uom_conversions_to_uom
        FOREIGN KEY (to_uom_id)
        REFERENCES units_of_measure(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_product_uom_conversion_factor
        CHECK (factor > 0),

    CONSTRAINT chk_product_uom_conversion_different_uom
        CHECK (from_uom_id <> to_uom_id),

    CONSTRAINT uq_product_uom_conversion
        UNIQUE (product_id, from_uom_id, to_uom_id)
);

CREATE INDEX idx_product_uom_conversions_product
    ON product_uom_conversions(product_id);


-- ============================================================
-- PRODUCT WAREHOUSE SETTINGS
-- ============================================================

CREATE TABLE product_warehouse_settings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    product_id BIGINT NOT NULL,
    warehouse_id BIGINT NOT NULL,

    reorder_level NUMERIC(18,6) NOT NULL DEFAULT 0,
    minimum_stock NUMERIC(18,6) NOT NULL DEFAULT 0,
    maximum_stock NUMERIC(18,6),

    preferred_location_id BIGINT,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_product_warehouse_settings_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_product_warehouse_settings_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_product_warehouse_settings_location
        FOREIGN KEY (preferred_location_id)
        REFERENCES warehouse_locations(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_product_warehouse_reorder_level
        CHECK (reorder_level >= 0),

    CONSTRAINT chk_product_warehouse_minimum_stock
        CHECK (minimum_stock >= 0),

    CONSTRAINT chk_product_warehouse_maximum_stock
        CHECK (
            maximum_stock IS NULL
            OR maximum_stock >= minimum_stock
        ),

    CONSTRAINT uq_product_warehouse
        UNIQUE (product_id, warehouse_id)
);

CREATE INDEX idx_product_warehouse_settings_product
    ON product_warehouse_settings(product_id);

CREATE INDEX idx_product_warehouse_settings_warehouse
    ON product_warehouse_settings(warehouse_id);


COMMIT;
