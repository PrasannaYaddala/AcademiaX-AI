# AcademiaX backend

## Razorpay checkout setup

The payment page creates Razorpay orders on the backend, opens Razorpay
Checkout in the browser, and verifies the checkout signature and captured
payment with Razorpay before marking a database record as paid. Only the
Razorpay **key ID** is sent to the browser; the key secret stays on the server.

1. Create a Razorpay account and use **test-mode** API keys while validating
   checkout. Never put the key secret in the frontend or commit it to source
   control.
2. Apply the payment-table migrations to the PostgreSQL database, in order:

   ```powershell
   psql -h localhost -U postgres -d Academiax-AI -f src/main/resources/db/migration/V4__create_payments.sql
   psql -h localhost -U postgres -d Academiax-AI -f src/main/resources/db/migration/V5__add_razorpay_payment_references.sql
   ```

   Run these from the backend project directory. The project does not run SQL
   migrations automatically. V5 also marks old pending entries without a
   Razorpay order as cancelled; those were created before checkout was enabled.
3. Set the credentials in the same PowerShell session used to run Spring Boot:

   ```powershell
   $env:RAZORPAY_KEY_ID = "rzp_test_your_key_id"
   $env:RAZORPAY_KEY_SECRET = "your_test_key_secret"
   .\mvnw.cmd spring-boot:run
   ```

   The equivalent environment variables must be configured in the backend's
   hosting environment for deployment.
4. For reliable confirmation when a customer closes the browser after paying,
   configure a Razorpay webhook for `payment.captured` pointing to
   `https://<your-backend-host>/api/payments/webhook`, and set its secret as
   `RAZORPAY_WEBHOOK_SECRET` on the backend. Webhooks require a publicly
   reachable HTTPS backend; do not expose test or live secrets in frontend
   environment variables.
5. Test with Razorpay test-mode credentials and test payment methods first.
   Switch to live credentials only after the merchant account and payment
   configuration have been approved.

Students must enter the amount and description shown on their official fee
notice. This application does not provide an authoritative fee schedule.
