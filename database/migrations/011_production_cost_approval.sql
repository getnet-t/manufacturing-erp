BEGIN;

-- Add an auditable approval state to production cost entries.
ALTER TABLE production_cost_entries
    ADD COLUMN approval_status VARCHAR(20)
        NOT NULL DEFAULT 'PENDING'
        CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    ADD COLUMN approved_by BIGINT,
    ADD COLUMN approved_at TIMESTAMPTZ,
    ADD COLUMN approval_notes TEXT;

ALTER TABLE production_cost_entries
    ADD CONSTRAINT fk_production_cost_entries_approved_by
    FOREIGN KEY (approved_by)
    REFERENCES users(id)
    ON DELETE RESTRICT;

-- Add an auditable approval state to cost allocations.
ALTER TABLE production_cost_allocations
    ADD COLUMN approval_status VARCHAR(20)
        NOT NULL DEFAULT 'PENDING'
        CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    ADD COLUMN approved_by BIGINT,
    ADD COLUMN approved_at TIMESTAMPTZ,
    ADD COLUMN approval_notes TEXT;

ALTER TABLE production_cost_allocations
    ADD CONSTRAINT fk_production_cost_allocations_approved_by
    FOREIGN KEY (approved_by)
    REFERENCES users(id)
    ON DELETE RESTRICT;

CREATE INDEX idx_production_cost_entries_approval
    ON production_cost_entries(production_order_id, approval_status);

CREATE INDEX idx_production_cost_allocations_approval
    ON production_cost_allocations(production_order_id, approval_status);

COMMIT;