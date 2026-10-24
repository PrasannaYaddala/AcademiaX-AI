ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(64);

ALTER TABLE payments
    DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE payments
    ADD CONSTRAINT payments_status_check
        CHECK (status IN ('PENDING', 'PAID', 'CANCELLED'));

UPDATE payments
SET status = 'CANCELLED'
WHERE status = 'PENDING'
  AND razorpay_order_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_razorpay_order
    ON payments(razorpay_order_id)
    WHERE razorpay_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_razorpay_payment
    ON payments(razorpay_payment_id)
    WHERE razorpay_payment_id IS NOT NULL;
