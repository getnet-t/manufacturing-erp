BEGIN;

-- ============================================================
-- 010_audit_supporting.sql
-- MANUFACTURING ERP - AUDIT / SUPPORTING STRUCTURES
-- ============================================================


-- ============================================================
-- AUDIT LOGS
-- ============================================================
-- audit_logs was already created in 001_organization_security.sql.
-- This migration extends it with useful supporting information.

ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS company_id BIGINT
    REFERENCES companies(id);

ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS user_id BIGINT
    REFERENCES users(id);

ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS action VARCHAR(50);

ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS entity_type VARCHAR(100);

ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS entity_id BIGINT;

ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS old_values JSONB;

ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS new_values JSONB;

ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS ip_address INET;

ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS user_agent TEXT;

ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);

ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
    NOT NULL DEFAULT CURRENT_TIMESTAMP;


CREATE INDEX IF NOT EXISTS idx_audit_logs_company
    ON audit_logs(company_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
    ON audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
    ON audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_request
    ON audit_logs(request_id);


-- ============================================================
-- SYSTEM NOTES
-- ============================================================

CREATE TABLE system_notes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL
        REFERENCES companies(id),

    user_id BIGINT
        REFERENCES users(id),

    entity_type VARCHAR(100) NOT NULL,

    entity_id BIGINT NOT NULL,

    note_type VARCHAR(30) NOT NULL DEFAULT 'GENERAL'
        CHECK (
            note_type IN (
                'GENERAL',
                'INTERNAL',
                'WARNING',
                'FOLLOW_UP',
                'APPROVAL',
                'REJECTION'
            )
        ),

    note TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_system_notes_company
    ON system_notes(company_id);

CREATE INDEX idx_system_notes_entity
    ON system_notes(entity_type, entity_id);

CREATE INDEX idx_system_notes_user
    ON system_notes(user_id);

CREATE INDEX idx_system_notes_created_at
    ON system_notes(created_at);


-- ============================================================
-- FILE ATTACHMENTS
-- ============================================================
-- Stores metadata only.
-- Actual files can later be stored in local storage or object
-- storage, while this table keeps their ERP reference.

CREATE TABLE file_attachments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL
        REFERENCES companies(id),

    uploaded_by BIGINT
        REFERENCES users(id),

    entity_type VARCHAR(100) NOT NULL,

    entity_id BIGINT NOT NULL,

    file_name VARCHAR(255) NOT NULL,

    original_file_name VARCHAR(255),

    file_path TEXT,

    storage_key VARCHAR(255),

    mime_type VARCHAR(100),

    file_size_bytes BIGINT
        CHECK (
            file_size_bytes IS NULL
            OR file_size_bytes >= 0
        ),

    file_hash VARCHAR(128),

    description TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'ARCHIVED',
                'DELETED'
            )
        ),

    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_file_attachments_company
    ON file_attachments(company_id);

CREATE INDEX idx_file_attachments_entity
    ON file_attachments(entity_type, entity_id);

CREATE INDEX idx_file_attachments_uploaded_by
    ON file_attachments(uploaded_by);

CREATE INDEX idx_file_attachments_status
    ON file_attachments(status);


-- ============================================================
-- APPROVAL REQUESTS
-- ============================================================

CREATE TABLE approval_requests (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL
        REFERENCES companies(id),

    entity_type VARCHAR(100) NOT NULL,

    entity_id BIGINT NOT NULL,

    requested_by BIGINT
        REFERENCES users(id),

    assigned_to BIGINT
        REFERENCES users(id),

    approval_type VARCHAR(50) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED',
                'CANCELLED'
            )
        ),

    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    responded_at TIMESTAMPTZ,

    response_comment TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_approval_response
        CHECK (
            (
                status IN ('PENDING', 'CANCELLED')
                AND responded_at IS NULL
            )
            OR
            (
                status IN ('APPROVED', 'REJECTED')
                AND responded_at IS NOT NULL
            )
        )
);

CREATE INDEX idx_approval_requests_company
    ON approval_requests(company_id);

CREATE INDEX idx_approval_requests_entity
    ON approval_requests(entity_type, entity_id);

CREATE INDEX idx_approval_requests_requested_by
    ON approval_requests(requested_by);

CREATE INDEX idx_approval_requests_assigned_to
    ON approval_requests(assigned_to);

CREATE INDEX idx_approval_requests_status
    ON approval_requests(company_id, status);


-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL
        REFERENCES companies(id),

    user_id BIGINT NOT NULL
        REFERENCES users(id),

    notification_type VARCHAR(50) NOT NULL,

    title VARCHAR(200) NOT NULL,

    message TEXT NOT NULL,

    entity_type VARCHAR(100),

    entity_id BIGINT,

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_notification_read
        CHECK (
            (
                is_read = FALSE
                AND read_at IS NULL
            )
            OR
            (
                is_read = TRUE
                AND read_at IS NOT NULL
            )
        )
);

CREATE INDEX idx_notifications_user
    ON notifications(user_id);

CREATE INDEX idx_notifications_unread
    ON notifications(user_id, is_read);

CREATE INDEX idx_notifications_entity
    ON notifications(entity_type, entity_id);

CREATE INDEX idx_notifications_created_at
    ON notifications(created_at);


-- ============================================================
-- SYSTEM SETTINGS
-- ============================================================

CREATE TABLE system_settings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL
        REFERENCES companies(id),

    setting_key VARCHAR(100) NOT NULL,

    setting_value TEXT,

    value_type VARCHAR(20) NOT NULL DEFAULT 'STRING'
        CHECK (
            value_type IN (
                'STRING',
                'INTEGER',
                'DECIMAL',
                'BOOLEAN',
                'JSON'
            )
        ),

    description TEXT,

    is_editable BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_system_setting
        UNIQUE (company_id, setting_key)
);

CREATE INDEX idx_system_settings_company
    ON system_settings(company_id);

CREATE INDEX idx_system_settings_key
    ON system_settings(company_id, setting_key);


-- ============================================================
-- API IDEMPOTENCY KEYS
-- ============================================================
-- Prevents duplicate processing when a client retries a request.

CREATE TABLE api_idempotency_keys (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL
        REFERENCES companies(id),

    idempotency_key VARCHAR(150) NOT NULL,

    request_method VARCHAR(10) NOT NULL,

    request_path VARCHAR(255) NOT NULL,

    request_hash VARCHAR(128),

    response_status INTEGER,

    response_body JSONB,

    created_by BIGINT
        REFERENCES users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    expires_at TIMESTAMPTZ,

    CONSTRAINT uq_api_idempotency_key
        UNIQUE (company_id, idempotency_key)
);

CREATE INDEX idx_api_idempotency_company
    ON api_idempotency_keys(company_id);

CREATE INDEX idx_api_idempotency_created
    ON api_idempotency_keys(created_at);

CREATE INDEX idx_api_idempotency_expires
    ON api_idempotency_keys(expires_at);


-- ============================================================
-- IMPORT JOBS
-- ============================================================
-- Supports future bulk import of products, customers,
-- suppliers, opening balances, etc.

CREATE TABLE import_jobs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL
        REFERENCES companies(id),

    imported_by BIGINT
        REFERENCES users(id),

    import_type VARCHAR(50) NOT NULL,

    file_name VARCHAR(255),

    total_rows INTEGER NOT NULL DEFAULT 0
        CHECK (total_rows >= 0),

    successful_rows INTEGER NOT NULL DEFAULT 0
        CHECK (successful_rows >= 0),

    failed_rows INTEGER NOT NULL DEFAULT 0
        CHECK (failed_rows >= 0),

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'PROCESSING',
                'COMPLETED',
                'PARTIALLY_COMPLETED',
                'FAILED',
                'CANCELLED'
            )
        ),

    error_summary JSONB,

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_import_row_counts
        CHECK (
            successful_rows + failed_rows <= total_rows
        )
);

CREATE INDEX idx_import_jobs_company
    ON import_jobs(company_id);

CREATE INDEX idx_import_jobs_status
    ON import_jobs(company_id, status);

CREATE INDEX idx_import_jobs_imported_by
    ON import_jobs(imported_by);

CREATE INDEX idx_import_jobs_created_at
    ON import_jobs(created_at);


-- ============================================================
-- PERIODIC JOB EXECUTION LOG
-- ============================================================
-- Useful for depreciation, monthly valuation, reports,
-- notifications and other scheduled ERP tasks.

CREATE TABLE scheduled_job_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT
        REFERENCES companies(id),

    job_name VARCHAR(100) NOT NULL,

    execution_key VARCHAR(150),

    status VARCHAR(20) NOT NULL
        CHECK (
            status IN (
                'RUNNING',
                'SUCCESS',
                'FAILED',
                'CANCELLED'
            )
        ),

    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    finished_at TIMESTAMPTZ,

    records_processed INTEGER NOT NULL DEFAULT 0
        CHECK (records_processed >= 0),

    error_message TEXT,

    metadata JSONB,

    CONSTRAINT uq_scheduled_job_execution
        UNIQUE (company_id, job_name, execution_key)
);

CREATE INDEX idx_scheduled_job_logs_company
    ON scheduled_job_logs(company_id);

CREATE INDEX idx_scheduled_job_logs_job
    ON scheduled_job_logs(job_name);

CREATE INDEX idx_scheduled_job_logs_status
    ON scheduled_job_logs(status);

CREATE INDEX idx_scheduled_job_logs_started
    ON scheduled_job_logs(started_at);


-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE audit_logs IS
    'Immutable-style application audit trail for important ERP actions.';

COMMENT ON TABLE system_notes IS
    'Internal notes attached to ERP business records.';

COMMENT ON TABLE file_attachments IS
    'Metadata and references for files attached to ERP records.';

COMMENT ON TABLE approval_requests IS
    'Generic approval workflow for business documents and actions.';

COMMENT ON TABLE notifications IS
    'User notifications generated by ERP business events.';

COMMENT ON TABLE system_settings IS
    'Company-specific configurable ERP settings.';

COMMENT ON TABLE api_idempotency_keys IS
    'Prevents duplicate processing of retried API requests.';

COMMENT ON TABLE import_jobs IS
    'Tracks bulk data import operations.';

COMMENT ON TABLE scheduled_job_logs IS
    'Tracks scheduled/background ERP jobs and their execution results.';


-- ============================================================
-- COMMIT
-- ============================================================

COMMIT;