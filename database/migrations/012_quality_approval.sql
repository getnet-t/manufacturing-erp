BEGIN;

ALTER TABLE quality_inspections
    ADD COLUMN approved_by BIGINT,
    ADD COLUMN approved_at TIMESTAMPTZ,
    ADD COLUMN approval_notes TEXT;

ALTER TABLE quality_inspections
    ADD CONSTRAINT fk_quality_inspections_approved_by
    FOREIGN KEY (approved_by)
    REFERENCES users(id)
    ON DELETE SET NULL;

CREATE INDEX idx_quality_inspections_approved_by
    ON quality_inspections(approved_by);


COMMIT;