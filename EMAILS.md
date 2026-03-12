# Client Email Catalog & Lifecycle

This document lists all client-facing emails, when they are sent, and the content format.

## Purchase Lifecycle (Customer Journey)
1. Order created (paid or pending) -> Order confirmation email
2. If payment is pending -> Pay Now CTA included in confirmation email
3. Payment succeeds -> Payment success email
4. Payment fails/cancelled -> Payment reminder email with Pay Now CTA
5. Order cancelled by admin -> Order cancelled email
6. Delivered/completed + delay -> Feedback request email

## Client Email Formats (All)

### Account & Access
- Email verification OTP
  Subject: `Verify email from HealthyOneGram`
  Template: `server/utils/verifyEmailTemplate.js`
  Trigger: User registration and resend OTP
  Audience: All users who register or request OTP
  Fields: `name`, `otp`
  Format: Header with greeting, OTP highlight, 15-minute validity note, footer

- Password reset OTP
  Subject: `verify OTP for password reset`
  Template: `server/utils/verifyEmailTemplate.js`
  Trigger: Forgot password request
  Audience: Users who request password reset
  Fields: `name`, `otp`
  Format: Same as verification OTP template

### Orders (Purchase Lifecycle)
- Order confirmation
  Subject: `Order Confirmation - {order_number}`
  Template: `server/emails/orderConfirmation.html`
  Trigger: Order created or saved-for-later
  Audience: Users/guests with an email on the order
  Fields: `customer_name`, `order_number`, `order_date`, `order_status`, `payment_status`, `items_text`, `final_amount`, `payment_url`, `payment_cta_label`
  Format: Header, order snapshot, Pay Now CTA when pending, item list, totals, store/support footer
  Pay Now link: `{{payment_url}}` -> `/pay-order/{order_id}?key={token}`

- Payment success
  Subject: `Payment Received - {order_number}`
  Template: `server/emails/orderPaymentSuccess.html`
  Trigger: Payment status transitions to `paid` (Paytm/PhonePe webhook, reconciliation, or Pay Now link flow)
  Audience: Users/guests with an email on the order
  Fields: `customer_name`, `order_number`, `order_date`, `payment_status`, `final_amount`, `action_url`
  Format: Header, payment summary, order details, CTA to view order, footer
  Note: If a previously pending order is paid via Pay Now, the confirmation email is sent if not already sent

- Payment failed/cancelled reminder
  Subject: `Payment Reminder - {order_number}` or `Payment Cancelled - {order_number}`
  Template: `server/emails/orderPaymentReminder.html`
  Trigger: Payment webhook resolves to failed/cancelled and reminder not already sent
  Audience: Users/guests with an email on the order
  Fields: `customer_name`, `order_number`, `payment_provider`, `failure_kind`, `failure_message`, `final_amount`, `action_url`, `action_label`
  Format: Header, failure note, order snapshot, item list, Pay Now CTA, footer
  Pay Now link: `action_url` uses secure `/pay-order/{order_id}?key={token}` when eligible

- Order cancelled
  Subject: `Order Cancelled - {order_number}`
  Template: `server/emails/orderCancelled.html`
  Trigger: Admin changes order status to `cancelled`
  Audience: Users/guests with an email on the order
  Fields: `customer_name`, `order_number`, `order_date`, `items_text`
  Format: Header, cancellation note, items list, footer

- Order feedback request
  Subject: `How was your order? - {order_number}`
  Template: `server/emails/orderFeedbackRequest.html`
  Trigger: Scheduled job sends after delivery (`order_status` delivered/completed) and delay
  Audience: Users/guests with an email on the order
  Fields: `customer_name`, `order_number`, `order_date`, `feedback_url`, `delay_days`
  Format: Header, feedback request, CTA to review, footer
  Controls: `ORDER_FEEDBACK_EMAIL_ENABLED`, `ORDER_FEEDBACK_DELAY_DAYS`, `ORDER_FEEDBACK_POLL_INTERVAL_MS`, `ORDER_FEEDBACK_BATCH_LIMIT`
  Content: Hardcoded in template (not admin-editable yet)

### Promotions & Marketing
- Promotional email campaign
  Subject: `Special Offer from HealthyOneGram` (admin can edit copy inside template variables)
  Template: `server/emails/promotionalOffer.html`
  Trigger: Admin sends from Notifications page
  Audience: Users with email and `notificationSettings.promotionalEmails` enabled
  Fields: `customer_name`, `headline`, `message`, `offer_details`, `coupon_code`, `cta_label`, `cta_url`
  Format: Header, offer message, coupon highlight, CTA, footer
  Route: `POST /api/notifications/admin/send-promotional-email`

- Newsletter welcome
  Subject: `Welcome to HealthyOneGram`
  Template: `server/emails/newsletterConfirmation.html`
  Trigger: Newsletter subscription confirmation
  Audience: Newsletter subscribers
  Fields: `site_url`, `year`
  Format: Simple welcome note with store link

### Support
- Support ticket update
  Subject: `Support Update - Ticket {ticket_id}`
  Template: `server/emails/adminReply.html`
  Trigger: Admin updates a support ticket with a reply or status change
  Audience: Ticket submitter email
  Fields: `customer_name`, `ticket_id`, `status`, `updated_at`, `admin_reply`, `support_url`
  Format: Header, status update, admin reply block, CTA to support

---

## Pay Now Link Security
- Token signing: HMAC using `PAY_ORDER_TOKEN_SECRET` (or fallback `ACCESS_TOKEN_SECRET`)
- Token format: `{timestamp_base36}.{hmac}`
- TTL: `PAY_ORDER_TOKEN_TTL_DAYS` (default 7)
- Access validated by order id + email + timestamp

## Quick Reference by Trigger
- Order create: Confirmation (with Pay Now if pending)
- Payment paid: Payment success
- Payment failed/cancelled: Payment reminder
- Order cancelled: Cancellation
- Delivered + delay: Feedback request
- Admin marketing: Promotional email
- Newsletter subscribe: Newsletter welcome
- Support ticket update: Admin reply
