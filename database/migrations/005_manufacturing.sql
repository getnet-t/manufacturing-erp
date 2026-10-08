BEGIN;

-- ============================================================
-- BOMs
-- ============================================================

CREATE TABLE boms (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,

    bom_code VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_boms_company_code
        UNIQUE (company_id, bom_code),

    CONSTRAINT fk_boms_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_boms_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_boms_product
    ON boms(product_id);

CREATE INDEX idx_boms_company
    ON boms(company_id);


-- ============================================================
-- BOM VERSIONS
-- ============================================================

CREATE TABLE bom_versions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    bom_id BIGINT NOT NULL,

    version_number INTEGER NOT NULL
        CHECK (version_number > 0),

    effective_from DATE NOT NULL,

    effective_to DATE,

    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (
            status IN (
                'DRAFT',
                'ACTIVE',
                'INACTIVE'
            )
        ),

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_bom_versions
        UNIQUE (bom_id, version_number),

    CONSTRAINT chk_bom_version_dates
        CHECK (
            effective_to IS NULL
            OR effective_to >= effective_from
        ),

    CONSTRAINT fk_bom_versions_bom
        FOREIGN KEY (bom_id)
        REFERENCES boms(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_bom_versions_bom
    ON bom_versions(bom_id);

CREATE INDEX idx_bom_versions_status
    ON bom_versions(status);


-- ============================================================
-- BOM COMPONENTS
-- ============================================================

CREATE TABLE bom_components (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    bom_version_id BIGINT NOT NULL,

    component_product_id BIGINT NOT NULL,

    quantity_required NUMERIC(18,6) NOT NULL
        CHECK (quantity_required > 0),

    scrap_percent NUMERIC(9,4) NOT NULL DEFAULT 0
        CHECK (
            scrap_percent >= 0
            AND scrap_percent <= 100
        ),

    issue_method VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
        CHECK (
            issue_method IN (
                'MANUAL',
                'BACKFLUSH'
            )
        ),

    sequence_no INTEGER NOT NULL DEFAULT 1
        CHECK (sequence_no > 0),

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_bom_component_sequence
        UNIQUE (bom_version_id, sequence_no),

    CONSTRAINT fk_bom_components_version
        FOREIGN KEY (bom_version_id)
        REFERENCES bom_versions(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_bom_components_product
        FOREIGN KEY (component_product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_bom_components_version
    ON bom_components(bom_version_id);

CREATE INDEX idx_bom_components_product
    ON bom_components(component_product_id);


-- ============================================================
-- WORK CENTERS
-- ============================================================

CREATE TABLE work_centers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,

    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,

    factory_id BIGINT,
    warehouse_id BIGINT,

    capacity_per_hour NUMERIC(18,6)
        CHECK (
            capacity_per_hour IS NULL
            OR capacity_per_hour > 0
        ),

    hourly_labor_rate NUMERIC(18,6) NOT NULL DEFAULT 0
        CHECK (hourly_labor_rate >= 0),

    hourly_overhead_rate NUMERIC(18,6) NOT NULL DEFAULT 0
        CHECK (hourly_overhead_rate >= 0),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_work_centers_company_code
        UNIQUE (company_id, code),

    CONSTRAINT fk_work_centers_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_work_centers_factory
        FOREIGN KEY (factory_id)
        REFERENCES factories(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_work_centers_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_work_centers_factory
    ON work_centers(factory_id);

CREATE INDEX idx_work_centers_warehouse
    ON work_centers(warehouse_id);


-- ============================================================
-- ROUTING OPERATIONS
-- ============================================================

CREATE TABLE routing_operations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    bom_version_id BIGINT NOT NULL,

    operation_no INTEGER NOT NULL
        CHECK (operation_no > 0),

    operation_name VARCHAR(150) NOT NULL,

    work_center_id BIGINT,

    setup_minutes NUMERIC(18,6) NOT NULL DEFAULT 0
        CHECK (setup_minutes >= 0),

    run_minutes_per_unit NUMERIC(18,6) NOT NULL DEFAULT 0
        CHECK (run_minutes_per_unit >= 0),

    labor_rate NUMERIC(18,6) NOT NULL DEFAULT 0
        CHECK (labor_rate >= 0),

    overhead_rate NUMERIC(18,6) NOT NULL DEFAULT 0
        CHECK (overhead_rate >= 0),

    sequence_no INTEGER NOT NULL
        CHECK (sequence_no > 0),

    instructions TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_routing_operation
        UNIQUE (bom_version_id, operation_no),

    CONSTRAINT uq_routing_sequence
        UNIQUE (bom_version_id, sequence_no),

    CONSTRAINT fk_routing_operations_bom_version
        FOREIGN KEY (bom_version_id)
        REFERENCES bom_versions(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_routing_operations_work_center
        FOREIGN KEY (work_center_id)
        REFERENCES work_centers(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_routing_operations_bom
    ON routing_operations(bom_version_id);

CREATE INDEX idx_routing_operations_work_center
    ON routing_operations(work_center_id);


-- ============================================================
-- PRODUCTION ORDERS
-- ============================================================

CREATE TABLE production_orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,

    factory_id BIGINT NOT NULL,
    warehouse_id BIGINT NOT NULL,

    product_id BIGINT NOT NULL,
    bom_version_id BIGINT NOT NULL,

    production_order_number VARCHAR(100) NOT NULL,

    order_type VARCHAR(20) NOT NULL
        CHECK (
            order_type IN (
                'MAKE_TO_STOCK',
                'MAKE_TO_ORDER'
            )
        ),

    status VARCHAR(30) NOT NULL DEFAULT 'PLANNED'
        CHECK (
            status IN (
                'PLANNED',
                'RELEASED',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED',
                'CLOSED'
            )
        ),

    planned_quantity NUMERIC(18,6) NOT NULL
        CHECK (planned_quantity > 0),

    produced_quantity NUMERIC(18,6) NOT NULL DEFAULT 0
        CHECK (produced_quantity >= 0),

    rejected_quantity NUMERIC(18,6) NOT NULL DEFAULT 0
        CHECK (rejected_quantity >= 0),

    planned_start_date DATE,
    planned_end_date DATE,

    actual_start_date DATE,
    actual_end_date DATE,

    sales_order_id BIGINT,
    sales_order_line_id BIGINT,

    notes TEXT,

    created_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_production_orders_company_number
        UNIQUE (company_id, production_order_number),

    CONSTRAINT chk_production_order_quantities
        CHECK (
            produced_quantity + rejected_quantity
            <= planned_quantity
        ),

    CONSTRAINT chk_production_order_dates
        CHECK (
            planned_end_date IS NULL
            OR planned_start_date IS NULL
            OR planned_end_date >= planned_start_date
        ),

    CONSTRAINT fk_production_orders_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_orders_factory
        FOREIGN KEY (factory_id)
        REFERENCES factories(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_orders_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_orders_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_orders_bom_version
        FOREIGN KEY (bom_version_id)
        REFERENCES bom_versions(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_orders_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_production_orders_product
    ON production_orders(product_id);

CREATE INDEX idx_production_orders_factory
    ON production_orders(factory_id);

CREATE INDEX idx_production_orders_warehouse
    ON production_orders(warehouse_id);

CREATE INDEX idx_production_orders_status
    ON production_orders(company_id, status);

CREATE INDEX idx_production_orders_dates
    ON production_orders(planned_start_date, planned_end_date);


-- ============================================================
-- PRODUCTION ORDER ALLOCATIONS
-- ============================================================

CREATE TABLE production_order_allocations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    production_order_id BIGINT NOT NULL,

    component_product_id BIGINT NOT NULL,

    warehouse_id BIGINT NOT NULL,

    batch_id BIGINT,

    required_quantity NUMERIC(18,6) NOT NULL
        CHECK (required_quantity > 0),

    reserved_quantity NUMERIC(18,6) NOT NULL DEFAULT 0
        CHECK (reserved_quantity >= 0),

    issued_quantity NUMERIC(18,6) NOT NULL DEFAULT 0
        CHECK (issued_quantity >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_production_allocation_reserved
        CHECK (reserved_quantity <= required_quantity),

    CONSTRAINT chk_production_allocation_issued
        CHECK (issued_quantity <= required_quantity),

    CONSTRAINT fk_production_allocations_order
        FOREIGN KEY (production_order_id)
        REFERENCES production_orders(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_allocations_product
        FOREIGN KEY (component_product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_allocations_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_allocations_batch
        FOREIGN KEY (batch_id)
        REFERENCES inventory_batches(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_production_allocations_order
    ON production_order_allocations(production_order_id);

CREATE INDEX idx_production_allocations_product
    ON production_order_allocations(component_product_id);

CREATE INDEX idx_production_allocations_batch
    ON production_order_allocations(batch_id);


-- ============================================================
-- MATERIAL ISSUES
-- ============================================================

CREATE TABLE material_issues (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,

    production_order_id BIGINT NOT NULL,

    warehouse_id BIGINT NOT NULL,

    issue_number VARCHAR(100) NOT NULL,

    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,

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

    created_by BIGINT,
    posted_by BIGINT,

    posted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_material_issues_company_number
        UNIQUE (company_id, issue_number),

    CONSTRAINT fk_material_issues_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_material_issues_production_order
        FOREIGN KEY (production_order_id)
        REFERENCES production_orders(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_material_issues_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_material_issues_inventory_transaction
        FOREIGN KEY (inventory_transaction_id)
        REFERENCES inventory_transactions(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_material_issues_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_material_issues_posted_by
        FOREIGN KEY (posted_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_material_issues_production_order
    ON material_issues(production_order_id);

CREATE INDEX idx_material_issues_warehouse
    ON material_issues(warehouse_id);


-- ============================================================
-- MATERIAL ISSUE LINES
-- ============================================================

CREATE TABLE material_issue_lines (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    material_issue_id BIGINT NOT NULL,

    component_product_id BIGINT NOT NULL,

    batch_id BIGINT,

    inventory_movement_line_id BIGINT,

    quantity NUMERIC(18,6) NOT NULL
        CHECK (quantity > 0),

    unit_cost NUMERIC(18,6) NOT NULL
        CHECK (unit_cost >= 0),

    total_cost NUMERIC(18,2) NOT NULL
        CHECK (total_cost >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_material_issue_lines_issue
        FOREIGN KEY (material_issue_id)
        REFERENCES material_issues(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_material_issue_lines_product
        FOREIGN KEY (component_product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_material_issue_lines_batch
        FOREIGN KEY (batch_id)
        REFERENCES inventory_batches(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_material_issue_lines_movement
        FOREIGN KEY (inventory_movement_line_id)
        REFERENCES inventory_movement_lines(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_material_issue_lines_issue
    ON material_issue_lines(material_issue_id);

CREATE INDEX idx_material_issue_lines_product
    ON material_issue_lines(component_product_id);

CREATE INDEX idx_material_issue_lines_batch
    ON material_issue_lines(batch_id);


-- ============================================================
-- PRODUCTION OUTPUTS
-- ============================================================

CREATE TABLE production_outputs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,

    production_order_id BIGINT NOT NULL,

    warehouse_id BIGINT NOT NULL,

    output_number VARCHAR(100) NOT NULL,

    output_date DATE NOT NULL DEFAULT CURRENT_DATE,

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

    created_by BIGINT,
    posted_by BIGINT,

    posted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_production_outputs_company_number
        UNIQUE (company_id, output_number),

    CONSTRAINT fk_production_outputs_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_outputs_production_order
        FOREIGN KEY (production_order_id)
        REFERENCES production_orders(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_outputs_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_outputs_inventory_transaction
        FOREIGN KEY (inventory_transaction_id)
        REFERENCES inventory_transactions(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_outputs_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_production_outputs_posted_by
        FOREIGN KEY (posted_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_production_outputs_order
    ON production_outputs(production_order_id);

CREATE INDEX idx_production_outputs_warehouse
    ON production_outputs(warehouse_id);


-- ============================================================
-- PRODUCTION OUTPUT LINES
-- ============================================================

CREATE TABLE production_output_lines (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    production_output_id BIGINT NOT NULL,

    product_id BIGINT NOT NULL,

    batch_id BIGINT,

    inventory_movement_line_id BIGINT,

    quantity NUMERIC(18,6) NOT NULL
        CHECK (quantity > 0),

    unit_cost NUMERIC(18,6) NOT NULL
        CHECK (unit_cost >= 0),

    total_cost NUMERIC(18,2) NOT NULL
        CHECK (total_cost >= 0),

    quality_status VARCHAR(20) NOT NULL DEFAULT 'ACCEPTED'
        CHECK (
            quality_status IN (
                'ACCEPTED',
                'REJECTED',
                'QUARANTINE'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_production_output_lines_output
        FOREIGN KEY (production_output_id)
        REFERENCES production_outputs(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_output_lines_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_output_lines_batch
        FOREIGN KEY (batch_id)
        REFERENCES inventory_batches(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_output_lines_movement
        FOREIGN KEY (inventory_movement_line_id)
        REFERENCES inventory_movement_lines(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_production_output_lines_output
    ON production_output_lines(production_output_id);

CREATE INDEX idx_production_output_lines_product
    ON production_output_lines(product_id);

CREATE INDEX idx_production_output_lines_batch
    ON production_output_lines(batch_id);


-- ============================================================
-- PRODUCTION TIME ENTRIES
-- ============================================================

CREATE TABLE production_time_entries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    production_order_id BIGINT NOT NULL,

    work_center_id BIGINT,

    employee_name VARCHAR(150),

    operation_name VARCHAR(150),

    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,

    hours_worked NUMERIC(18,6) NOT NULL
        CHECK (hours_worked >= 0),

    labor_rate NUMERIC(18,6) NOT NULL DEFAULT 0
        CHECK (labor_rate >= 0),

    labor_cost NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (labor_cost >= 0),

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_production_time_dates
        CHECK (
            end_time IS NULL
            OR start_time IS NULL
            OR end_time >= start_time
        ),

    CONSTRAINT fk_production_time_order
        FOREIGN KEY (production_order_id)
        REFERENCES production_orders(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_time_work_center
        FOREIGN KEY (work_center_id)
        REFERENCES work_centers(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_production_time_order
    ON production_time_entries(production_order_id);

CREATE INDEX idx_production_time_work_center
    ON production_time_entries(work_center_id);


-- ============================================================
-- PRODUCTION COST ENTRIES
-- ============================================================

CREATE TABLE production_cost_entries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    production_order_id BIGINT NOT NULL,

    cost_type VARCHAR(30) NOT NULL
        CHECK (
            cost_type IN (
                'MATERIAL',
                'LABOR',
                'OVERHEAD',
                'SUBCONTRACTING',
                'OTHER'
            )
        ),

    description VARCHAR(255),

    amount NUMERIC(18,2) NOT NULL
        CHECK (amount >= 0),

    source_document_type VARCHAR(100),
    source_document_id BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_production_cost_entries_order
        FOREIGN KEY (production_order_id)
        REFERENCES production_orders(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_production_cost_entries_order
    ON production_cost_entries(production_order_id);

CREATE INDEX idx_production_cost_entries_type
    ON production_cost_entries(cost_type);


-- ============================================================
-- PRODUCTION COST ALLOCATIONS
-- ============================================================

CREATE TABLE production_cost_allocations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    production_order_id BIGINT NOT NULL,

    production_output_id BIGINT,

    cost_type VARCHAR(30) NOT NULL
        CHECK (
            cost_type IN (
                'MATERIAL',
                'LABOR',
                'OVERHEAD',
                'SUBCONTRACTING',
                'OTHER',
                'VARIANCE'
            )
        ),

    allocated_amount NUMERIC(18,2) NOT NULL
        CHECK (allocated_amount >= 0),

    allocation_date DATE NOT NULL DEFAULT CURRENT_DATE,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_production_cost_allocations_order
        FOREIGN KEY (production_order_id)
        REFERENCES production_orders(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_cost_allocations_output
        FOREIGN KEY (production_output_id)
        REFERENCES production_outputs(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_production_cost_allocations_order
    ON production_cost_allocations(production_order_id);

CREATE INDEX idx_production_cost_allocations_output
    ON production_cost_allocations(production_output_id);

-- ============================================================
-- FINISHED
-- ============================================================

COMMIT;
