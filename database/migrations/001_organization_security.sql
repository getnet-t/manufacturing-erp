-- ============================================================
-- MANUFACTURING ERP
-- Migration 001
-- Organization + Security Foundation
-- PostgreSQL
-- ============================================================

BEGIN;

-- ============================================================
-- COMPANIES
-- ============================================================

CREATE TABLE companies (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,

    base_currency CHAR(3) NOT NULL DEFAULT 'ETB',

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_companies_code
        UNIQUE (code)
);

-- ============================================================
-- FACTORIES
-- ============================================================

CREATE TABLE factories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,

    address TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_factories_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_factories_company_code
        UNIQUE (company_id, code)
);

CREATE INDEX idx_factories_company
    ON factories(company_id);

-- ============================================================
-- WAREHOUSES
-- ============================================================

CREATE TABLE warehouses (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    factory_id BIGINT NOT NULL,

    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,

    warehouse_type VARCHAR(30) NOT NULL
        CHECK (
            warehouse_type IN (
                'RAW_MATERIAL',
                'WIP',
                'FINISHED_GOODS',
                'GENERAL',
                'QUARANTINE',
                'SCRAP'
            )
        ),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_warehouses_factory
        FOREIGN KEY (factory_id)
        REFERENCES factories(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_warehouses_factory_code
        UNIQUE (factory_id, code)
);

CREATE INDEX idx_warehouses_factory
    ON warehouses(factory_id);

-- ============================================================
-- WAREHOUSE LOCATIONS
-- ============================================================

CREATE TABLE warehouse_locations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    warehouse_id BIGINT NOT NULL,

    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_locations_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_locations_warehouse_code
        UNIQUE (warehouse_id, code)
);

CREATE INDEX idx_locations_warehouse
    ON warehouse_locations(warehouse_id);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,

    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'LOCKED'
            )
        ),

    last_login_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_users_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_users_company_email
    ON users(company_id, LOWER(email));

CREATE INDEX idx_users_company
    ON users(company_id);

-- ============================================================
-- ROLES
-- ============================================================

CREATE TABLE roles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,

    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_roles_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_roles_company_code
        UNIQUE (company_id, code)
);

-- ============================================================
-- PERMISSIONS
-- ============================================================

CREATE TABLE permissions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    code VARCHAR(100) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,

    CONSTRAINT uq_permissions_code
        UNIQUE (code)
);

-- ============================================================
-- USER ROLES
-- ============================================================

CREATE TABLE user_roles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,

    PRIMARY KEY (user_id, role_id),

    CONSTRAINT fk_user_roles_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_roles_role
        FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_user_roles_role
    ON user_roles(role_id);

-- ============================================================
-- ROLE PERMISSIONS
-- ============================================================

CREATE TABLE role_permissions (
    role_id BIGINT NOT NULL,
    permission_id BIGINT NOT NULL,

    PRIMARY KEY (role_id, permission_id),

    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id)
        REFERENCES permissions(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_role_permissions_permission
    ON role_permissions(permission_id);

-- ============================================================
-- USER WAREHOUSE ACCESS
-- ============================================================

CREATE TABLE user_warehouse_access (
    user_id BIGINT NOT NULL,
    warehouse_id BIGINT NOT NULL,

    PRIMARY KEY (user_id, warehouse_id),

    CONSTRAINT fk_user_warehouse_access_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_warehouse_access_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_user_warehouse_access_warehouse
    ON user_warehouse_access(warehouse_id);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL,
    user_id BIGINT,

    action VARCHAR(50) NOT NULL,

    entity_type VARCHAR(100) NOT NULL,
    entity_id BIGINT,

    old_values JSONB,
    new_values JSONB,

    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_logs_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_audit_logs_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_company_created
    ON audit_logs(company_id, created_at);

CREATE INDEX idx_audit_logs_entity
    ON audit_logs(entity_type, entity_id);

CREATE INDEX idx_audit_logs_user_created
    ON audit_logs(user_id, created_at);

-- ============================================================
-- FINISHED
-- ============================================================

COMMIT;
