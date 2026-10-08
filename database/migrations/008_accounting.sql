BEGIN;

-- ============================================================
-- 008_accounting.sql
-- MANUFACTURING ERP - ACCOUNTING / GENERAL LEDGER
-- ============================================================

-- ============================================================
-- CHART OF ACCOUNTS
-- ============================================================

CREATE TABLE chart_of_accounts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL
        REFERENCES companies(id),

    account_code VARCHAR(30) NOT NULL,
    account_name VARCHAR(150) NOT NULL,

    account_type VARCHAR(20) NOT NULL
        CHECK (
            account_type IN (
                'ASSET',
                'LIABILITY',
                'EQUITY',
                'REVENUE',
                'EXPENSE'
            )
        ),

    normal_balance VARCHAR(10) NOT NULL
        CHECK (
            normal_balance IN ('DEBIT', 'CREDIT')
        ),

    parent_account_id BIGINT
        REFERENCES chart_of_accounts(id),

    is_control_account BOOLEAN NOT NULL DEFAULT FALSE,
    is_postable BOOLEAN NOT NULL DEFAULT TRUE,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN ('ACTIVE', 'INACTIVE')
        ),

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_chart_of_accounts_code
        UNIQUE (company_id, account_code)
);

CREATE INDEX idx_chart_of_accounts_company
    ON chart_of_accounts(company_id);

CREATE INDEX idx_chart_of_accounts_parent
    ON chart_of_accounts(parent_account_id);

CREATE INDEX idx_chart_of_accounts_type
    ON chart_of_accounts(company_id, account_type);


-- ============================================================
-- ACCOUNTING PERIODS
-- ============================================================

CREATE TABLE accounting_periods (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL
        REFERENCES companies(id),

    period_name VARCHAR(50) NOT NULL,

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
        CHECK (
            status IN ('OPEN', 'CLOSED', 'LOCKED')
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMPTZ,

    CONSTRAINT uq_accounting_period
        UNIQUE (company_id, period_name),

    CONSTRAINT chk_accounting_period_dates
        CHECK (end_date >= start_date)
);

CREATE INDEX idx_accounting_periods_company
    ON accounting_periods(company_id);

CREATE INDEX idx_accounting_periods_dates
    ON accounting_periods(company_id, start_date, end_date);

CREATE INDEX idx_accounting_periods_status
    ON accounting_periods(company_id, status);


-- ============================================================
-- COST CENTERS
-- ============================================================

CREATE TABLE cost_centers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL
        REFERENCES companies(id),

    code VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,

    parent_cost_center_id BIGINT
        REFERENCES cost_centers(id),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN ('ACTIVE', 'INACTIVE')
        ),

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_cost_center_code
        UNIQUE (company_id, code)
);

CREATE INDEX idx_cost_centers_company
    ON cost_centers(company_id);

CREATE INDEX idx_cost_centers_parent
    ON cost_centers(parent_cost_center_id);


-- ============================================================
-- JOURNAL ENTRIES
-- ============================================================

CREATE TABLE journal_entries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL
        REFERENCES companies(id),

    period_id BIGINT NOT NULL
        REFERENCES accounting_periods(id),

    journal_number VARCHAR(50) NOT NULL,

    entry_date DATE NOT NULL,

    source_module VARCHAR(50),
    source_document_type VARCHAR(50),
    source_document_id BIGINT,

    source_posting_key VARCHAR(150),

    description TEXT,

    total_debit NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_credit NUMERIC(18,2) NOT NULL DEFAULT 0,

    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (
            status IN (
                'DRAFT',
                'POSTED',
                'REVERSED'
            )
        ),

    reversal_of_journal_entry_id BIGINT
        REFERENCES journal_entries(id),

    created_by BIGINT
        REFERENCES users(id),

    posted_by BIGINT
        REFERENCES users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    posted_at TIMESTAMPTZ,

    CONSTRAINT uq_journal_number
        UNIQUE (company_id, journal_number),

    CONSTRAINT chk_journal_totals
        CHECK (
            total_debit >= 0
            AND total_credit >= 0
        )
);

CREATE UNIQUE INDEX uq_journal_source_posting_key
    ON journal_entries(company_id, source_posting_key)
    WHERE source_posting_key IS NOT NULL;

CREATE UNIQUE INDEX uq_journal_reversal
    ON journal_entries(reversal_of_journal_entry_id)
    WHERE reversal_of_journal_entry_id IS NOT NULL;

CREATE INDEX idx_journal_entries_company
    ON journal_entries(company_id);

CREATE INDEX idx_journal_entries_period
    ON journal_entries(period_id);

CREATE INDEX idx_journal_entries_date
    ON journal_entries(company_id, entry_date);

CREATE INDEX idx_journal_entries_source
    ON journal_entries(
        company_id,
        source_module,
        source_document_type,
        source_document_id
    );

CREATE INDEX idx_journal_entries_status
    ON journal_entries(company_id, status);


-- ============================================================
-- JOURNAL ENTRY LINES
-- ============================================================

CREATE TABLE journal_entry_lines (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    journal_entry_id BIGINT NOT NULL
        REFERENCES journal_entries(id)
        ON DELETE RESTRICT,

    line_number INTEGER NOT NULL,

    account_id BIGINT NOT NULL
        REFERENCES chart_of_accounts(id),

    cost_center_id BIGINT
        REFERENCES cost_centers(id),

    description TEXT,

    debit NUMERIC(18,2) NOT NULL DEFAULT 0,
    credit NUMERIC(18,2) NOT NULL DEFAULT 0,

    reference VARCHAR(150),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_journal_line_number
        UNIQUE (journal_entry_id, line_number),

    CONSTRAINT chk_journal_line_amounts
        CHECK (
            debit >= 0
            AND credit >= 0
            AND (
                (debit > 0 AND credit = 0)
                OR
                (credit > 0 AND debit = 0)
            )
        )
);

CREATE INDEX idx_journal_entry_lines_journal
    ON journal_entry_lines(journal_entry_id);

CREATE INDEX idx_journal_entry_lines_account
    ON journal_entry_lines(account_id);

CREATE INDEX idx_journal_entry_lines_cost_center
    ON journal_entry_lines(cost_center_id);


-- ============================================================
-- CASH ACCOUNTS
-- ============================================================

CREATE TABLE cash_accounts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL
        REFERENCES companies(id),

    account_code VARCHAR(30) NOT NULL,
    account_name VARCHAR(150) NOT NULL,

    account_type VARCHAR(20) NOT NULL
        CHECK (
            account_type IN (
                'CASH',
                'BANK',
                'PETTY_CASH'
            )
        ),

    currency CHAR(3) NOT NULL DEFAULT 'ETB',

    gl_account_id BIGINT NOT NULL
        REFERENCES chart_of_accounts(id),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN ('ACTIVE', 'INACTIVE')
        ),

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_cash_account_code
        UNIQUE (company_id, account_code)
);

CREATE INDEX idx_cash_accounts_company
    ON cash_accounts(company_id);

CREATE INDEX idx_cash_accounts_gl
    ON cash_accounts(gl_account_id);


-- ============================================================
-- CASH TRANSACTIONS
-- ============================================================

CREATE TABLE cash_transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL
        REFERENCES companies(id),

    cash_account_id BIGINT NOT NULL
        REFERENCES cash_accounts(id),

    journal_entry_id BIGINT
        REFERENCES journal_entries(id),

    transaction_number VARCHAR(50) NOT NULL,

    transaction_date DATE NOT NULL,

    transaction_type VARCHAR(20) NOT NULL
        CHECK (
            transaction_type IN (
                'RECEIPT',
                'PAYMENT',
                'TRANSFER_IN',
                'TRANSFER_OUT',
                'ADJUSTMENT'
            )
        ),

    amount NUMERIC(18,2) NOT NULL
        CHECK (amount > 0),

    reference VARCHAR(150),

    description TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'POSTED'
        CHECK (
            status IN (
                'DRAFT',
                'POSTED',
                'CANCELLED',
                'REVERSED'
            )
        ),

    created_by BIGINT
        REFERENCES users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_cash_transaction_number
        UNIQUE (company_id, transaction_number)
);

CREATE INDEX idx_cash_transactions_company
    ON cash_transactions(company_id);

CREATE INDEX idx_cash_transactions_account
    ON cash_transactions(cash_account_id);

CREATE INDEX idx_cash_transactions_date
    ON cash_transactions(company_id, transaction_date);

CREATE INDEX idx_cash_transactions_journal
    ON cash_transactions(journal_entry_id);

CREATE INDEX idx_cash_transactions_status
    ON cash_transactions(company_id, status);


-- ============================================================
-- EXPENSE CATEGORIES
-- ============================================================

CREATE TABLE expense_categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL
        REFERENCES companies(id),

    code VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,

    default_gl_account_id BIGINT
        REFERENCES chart_of_accounts(id),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN ('ACTIVE', 'INACTIVE')
        ),

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_expense_category_code
        UNIQUE (company_id, code)
);

CREATE INDEX idx_expense_categories_company
    ON expense_categories(company_id);

CREATE INDEX idx_expense_categories_gl
    ON expense_categories(default_gl_account_id);


-- ============================================================
-- EXPENSES
-- ============================================================

CREATE TABLE expenses (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL
        REFERENCES companies(id),

    expense_category_id BIGINT NOT NULL
        REFERENCES expense_categories(id),

    cash_account_id BIGINT
        REFERENCES cash_accounts(id),

    journal_entry_id BIGINT
        REFERENCES journal_entries(id),

    expense_number VARCHAR(50) NOT NULL,

    expense_date DATE NOT NULL,

    amount NUMERIC(18,2) NOT NULL
        CHECK (amount >= 0),

    tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (tax_amount >= 0),

    total_amount NUMERIC(18,2) NOT NULL
        CHECK (total_amount >= 0),

    payment_method VARCHAR(20)
        CHECK (
            payment_method IN (
                'CASH',
                'BANK_TRANSFER',
                'CHEQUE',
                'OTHER'
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

    description TEXT,

    created_by BIGINT
        REFERENCES users(id),

    posted_by BIGINT
        REFERENCES users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    posted_at TIMESTAMPTZ,

    CONSTRAINT uq_expense_number
        UNIQUE (company_id, expense_number),

    CONSTRAINT chk_expense_total
        CHECK (total_amount = amount + tax_amount)
);

CREATE INDEX idx_expenses_company
    ON expenses(company_id);

CREATE INDEX idx_expenses_category
    ON expenses(expense_category_id);

CREATE INDEX idx_expenses_date
    ON expenses(company_id, expense_date);

CREATE INDEX idx_expenses_status
    ON expenses(company_id, status);

CREATE INDEX idx_expenses_journal
    ON expenses(journal_entry_id);


-- ============================================================
-- TAX CODES
-- ============================================================

CREATE TABLE tax_codes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL
        REFERENCES companies(id),

    code VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,

    tax_type VARCHAR(20) NOT NULL
        CHECK (
            tax_type IN (
                'VAT',
                'WHT',
                'SALES_TAX',
                'OTHER'
            )
        ),

    rate NUMERIC(9,4) NOT NULL
        CHECK (
            rate >= 0
            AND rate <= 100
        ),

    input_tax_account_id BIGINT
        REFERENCES chart_of_accounts(id),

    output_tax_account_id BIGINT
        REFERENCES chart_of_accounts(id),

    payable_account_id BIGINT
        REFERENCES chart_of_accounts(id),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN ('ACTIVE', 'INACTIVE')
        ),

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_tax_code
        UNIQUE (company_id, code)
);

CREATE INDEX idx_tax_codes_company
    ON tax_codes(company_id);

CREATE INDEX idx_tax_codes_type
    ON tax_codes(company_id, tax_type);


-- ============================================================
-- DOCUMENT SEQUENCES
-- ============================================================

CREATE TABLE document_sequences (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL
        REFERENCES companies(id),

    document_type VARCHAR(50) NOT NULL,

    prefix VARCHAR(20),

    current_number BIGINT NOT NULL DEFAULT 0
        CHECK (current_number >= 0),

    padding_length INTEGER NOT NULL DEFAULT 6
        CHECK (
            padding_length BETWEEN 1 AND 20
        ),

    reset_period VARCHAR(20) NOT NULL DEFAULT 'NEVER'
        CHECK (
            reset_period IN (
                'NEVER',
                'YEARLY',
                'MONTHLY'
            )
        ),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN ('ACTIVE', 'INACTIVE')
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_document_sequence
        UNIQUE (company_id, document_type)
);

CREATE INDEX idx_document_sequences_company
    ON document_sequences(company_id);


-- ============================================================
-- BANK RECONCILIATIONS
-- ============================================================

CREATE TABLE bank_reconciliations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id BIGINT NOT NULL
        REFERENCES companies(id),

    cash_account_id BIGINT NOT NULL
        REFERENCES cash_accounts(id),

    statement_date DATE NOT NULL,

    opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
    closing_balance NUMERIC(18,2) NOT NULL DEFAULT 0,

    reconciled_balance NUMERIC(18,2) NOT NULL DEFAULT 0,

    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (
            status IN (
                'DRAFT',
                'RECONCILED',
                'CANCELLED'
            )
        ),

    notes TEXT,

    created_by BIGINT
        REFERENCES users(id),

    reconciled_by BIGINT
        REFERENCES users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reconciled_at TIMESTAMPTZ,

    CONSTRAINT chk_bank_reconciliation_balances
        CHECK (
            opening_balance >= 0
            AND closing_balance >= 0
            AND reconciled_balance >= 0
        ),

    CONSTRAINT uq_bank_reconciliation
        UNIQUE (cash_account_id, statement_date)
);

CREATE INDEX idx_bank_reconciliations_company
    ON bank_reconciliations(company_id);

CREATE INDEX idx_bank_reconciliations_account
    ON bank_reconciliations(cash_account_id);

CREATE INDEX idx_bank_reconciliations_date
    ON bank_reconciliations(
        company_id,
        statement_date
    );

CREATE INDEX idx_bank_reconciliations_status
    ON bank_reconciliations(
        company_id,
        status
    );


-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE chart_of_accounts IS
    'Company-specific general ledger chart of accounts.';

COMMENT ON TABLE accounting_periods IS
    'Open, closed and locked accounting periods.';

COMMENT ON TABLE journal_entries IS
    'General ledger journal headers. Posted journals are immutable and must be reversed rather than edited.';

COMMENT ON TABLE journal_entry_lines IS
    'Debit and credit lines belonging to journal entries.';

COMMENT ON TABLE cash_accounts IS
    'Cash, bank and petty-cash accounts linked to GL accounts.';

COMMENT ON TABLE cash_transactions IS
    'Operational cash and bank movements linked to accounting journals.';

COMMENT ON TABLE expenses IS
    'Business expenses and their accounting references.';

COMMENT ON TABLE tax_codes IS
    'Company tax definitions and related GL accounts.';

COMMENT ON TABLE document_sequences IS
    'Concurrency-safe document numbering configuration.';

COMMENT ON TABLE bank_reconciliations IS
    'Bank and cash reconciliation headers.';


-- ============================================================
-- COMMIT
-- ============================================================

COMMIT;