package com.edgemarket.controller;

import com.edgemarket.exception.SubscriptionCheckoutException;
import com.edgemarket.service.EmailAuthService;
import com.edgemarket.service.SubscriptionService;
import com.stripe.exception.SignatureVerificationException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/subscription")
public class SubscriptionController {

    private final SubscriptionService subscriptionService;
    private final EmailAuthService emailAuthService;

    public SubscriptionController(SubscriptionService subscriptionService,
                                  EmailAuthService emailAuthService) {
        this.subscriptionService = subscriptionService;
        this.emailAuthService = emailAuthService;
    }

    @PostMapping("/checkout")
    public ResponseEntity<Map<String, String>> createCheckout(HttpServletRequest request) {
        String subject = (String) request.getAttribute("authenticatedAddress");
        if (subject == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthorized"));
        }

        try {
            UUID userId = UUID.fromString(subject);
            var user = emailAuthService.getUser(userId);
            String url = subscriptionService.createCheckoutSession(userId, user.email());
            return ResponseEntity.ok(Map.of("url", url));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthorized"));
        } catch (SubscriptionCheckoutException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Failed to create checkout session"));
        }
    }

    @PostMapping("/webhook")
    public ResponseEntity<Void> handleWebhook(HttpServletRequest request,
                                              @RequestHeader(value = "Stripe-Signature", required = false)
                                              String sigHeader) throws IOException {
        if (sigHeader == null || sigHeader.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        byte[] rawBody;
        try (InputStream is = request.getInputStream()) {
            rawBody = is.readAllBytes();
        }

        try {
            subscriptionService.processWebhookEvent(rawBody, sigHeader);
            return ResponseEntity.ok().build();
        } catch (SignatureVerificationException e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
