package com.edgemarket.service;

import com.edgemarket.exception.SubscriptionCheckoutException;
import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.Event;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class SubscriptionService {

    private static final Logger log = LoggerFactory.getLogger(SubscriptionService.class);

    private final JdbcTemplate jdbcTemplate;
    private final String stripeSecretKey;
    private final String webhookSecret;
    private final String priceId;

    public SubscriptionService(JdbcTemplate jdbcTemplate,
                               @Value("${stripe.secret.key:}") String stripeSecretKey,
                               @Value("${stripe.webhook.secret:}") String webhookSecret,
                               @Value("${stripe.price.id:}") String priceId) {
        this.jdbcTemplate = jdbcTemplate;
        this.stripeSecretKey = stripeSecretKey;
        this.webhookSecret = webhookSecret;
        this.priceId = priceId;
    }

    /**
     * Returns true only when tier is "premium" AND expiresAt is in the future.
     */
    public static boolean computeIsPremium(String tier, Instant expiresAt) {
        return "premium".equals(tier)
                && expiresAt != null
                && expiresAt.isAfter(Instant.now());
    }

    public String createCheckoutSession(UUID userId, String email) {
        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            throw new SubscriptionCheckoutException("Stripe is not configured", null);
        }
        Stripe.apiKey = stripeSecretKey;

        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT stripe_customer_id FROM users WHERE id = ?::uuid",
                    userId.toString());

            if (rows.isEmpty()) {
                throw new SubscriptionCheckoutException("User not found", null);
            }

            String customerId = (String) rows.get(0).get("stripe_customer_id");

            if (customerId == null || customerId.isBlank()) {
                CustomerCreateParams customerParams = CustomerCreateParams.builder()
                        .setEmail(email)
                        .build();
                Customer customer = Customer.create(customerParams);
                customerId = customer.getId();

                jdbcTemplate.update(
                        "UPDATE users SET stripe_customer_id = ? WHERE id = ?::uuid",
                        customerId,
                        userId.toString());
            }

            SessionCreateParams sessionParams = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                    .setCustomer(customerId)
                    .addLineItem(SessionCreateParams.LineItem.builder()
                            .setPrice(priceId)
                            .setQuantity(1L)
                            .build())
                    .setSuccessUrl("edgemarket://subscription/success")
                    .setCancelUrl("edgemarket://subscription/cancel")
                    .build();

            Session session = Session.create(sessionParams);
            return session.getUrl();
        } catch (StripeException e) {
            log.warn("[Subscription] Stripe checkout failed for userId={}: {}", userId, e.getMessage());
            throw new SubscriptionCheckoutException("Failed to create checkout session", e);
        }
    }

    public void processWebhookEvent(byte[] rawBody, String sigHeader)
            throws SignatureVerificationException {
        String payload = new String(rawBody, java.nio.charset.StandardCharsets.UTF_8);
        Event event = Webhook.constructEvent(payload, sigHeader, webhookSecret);
        String type = event.getType();

        if (!type.startsWith("customer.subscription.")) {
            return;
        }

        Subscription subscription = (Subscription) event.getDataObjectDeserializer()
                .getObject()
                .orElse(null);

        if (subscription == null) {
            log.warn("[Subscription] Could not deserialize subscription from event type={}", type);
            return;
        }

        String customerId = subscription.getCustomer();
        String status = subscription.getStatus();

        List<Map<String, Object>> users = jdbcTemplate.queryForList(
                "SELECT id FROM users WHERE stripe_customer_id = ?",
                customerId);

        if (users.isEmpty()) {
            log.warn("[Subscription] No user found for stripe_customer_id={}", customerId);
            return;
        }

        UUID userId = (UUID) users.get(0).get("id");

        if ("customer.subscription.deleted".equals(type)
                || "canceled".equals(status)
                || "past_due".equals(status)) {
            jdbcTemplate.update(
                    "UPDATE users SET subscription_tier = 'basic', subscription_expires_at = NOW() " +
                    "WHERE id = ?::uuid",
                    userId.toString());
            log.info("[Subscription] Downgraded userId={} to basic (event={}, status={})", userId, type, status);
            return;
        }

        if ("active".equals(status) || "trialing".equals(status)) {
            Instant expiresAt = Instant.ofEpochSecond(subscription.getCurrentPeriodEnd());
            jdbcTemplate.update(
                    "UPDATE users SET subscription_tier = 'premium', stripe_subscription_id = ?, " +
                    "subscription_expires_at = ? WHERE id = ?::uuid",
                    subscription.getId(),
                    java.sql.Timestamp.from(expiresAt),
                    userId.toString());
            log.info("[Subscription] Upgraded userId={} to premium until {}", userId, expiresAt);
        }
    }
}
