
BEGIN;

-- Link a reversal to the original inventory transaction.
ALTER TABLE inventory_transactions
ADD COLUMN reversal_of_transaction_id BIGINT;

ALTER TABLE inventory_transactions
ADD CONSTRAINT fk_inventory_transactions_reversal
FOREIGN KEY (reversal_of_transaction_id)
REFERENCES inventory_transactions(id)
ON DELETE RESTRICT;

-- Only one reversal may reference a given original transaction.
CREATE UNIQUE INDEX uq_inventory_transaction_reversal
ON inventory_transactions(reversal_of_transaction_id)
WHERE reversal_of_transaction_id IS NOT NULL;

-- A reversal must reference a different transaction.
ALTER TABLE inventory_transactions
ADD CONSTRAINT chk_inventory_transaction_not_self_reversal
CHECK (
    reversal_of_transaction_id IS NULL
    OR reversal_of_transaction_id <> id
);

COMMIT;
