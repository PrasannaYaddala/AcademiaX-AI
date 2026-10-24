package com.academiax;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class RazorpayPaymentService {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE =
            new ParameterizedTypeReference<>() {};

    private final RestClient client;
    private final String keyId;
    private final String keySecret;
    private final String webhookSecret;

    public RazorpayPaymentService(
            @Value("${razorpay.key-id:}") String keyId,
            @Value("${razorpay.key-secret:}") String keySecret,
            @Value("${razorpay.webhook-secret:}") String webhookSecret) {
        this.keyId = keyId;
        this.keySecret = keySecret;
        this.webhookSecret = webhookSecret;
        this.client = RestClient.builder()
                .baseUrl("https://api.razorpay.com/v1")
                .defaultHeaders(headers -> headers.setBasicAuth(keyId, keySecret))
                .build();
    }

    public boolean isConfigured() {
        return !keyId.isBlank() && !keySecret.isBlank();
    }

    public boolean isWebhookConfigured() {
        return !webhookSecret.isBlank();
    }

    public String getKeyId() {
        return keyId;
    }

    public Map<String, Object> createOrder(long amountPaise, String receipt) {
        return client.post()
                .uri("/orders")
                .body(Map.of(
                        "amount", amountPaise,
                        "currency", "INR",
                        "receipt", receipt))
                .retrieve()
                .body(MAP_TYPE);
    }

    public Map<String, Object> fetchPayment(String paymentId) {
        return client.get()
                .uri("/payments/{paymentId}", paymentId)
                .retrieve()
                .body(MAP_TYPE);
    }

    public boolean isValidPaymentSignature(
            String orderId, String paymentId, String signature) {
        return matchesHmac(
                keySecret, orderId + "|" + paymentId, signature);
    }

    public boolean isValidWebhookSignature(String payload, String signature) {
        return matchesHmac(webhookSecret, payload, signature);
    }

    static boolean matchesHmac(String secret, String message, String signature) {
        if (secret == null || secret.isBlank() || message == null
                || signature == null || signature.length() != 64) {
            return false;
        }

        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(
                    secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            String expected = HexFormat.of().formatHex(
                    mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
            return MessageDigest.isEqual(
                    expected.getBytes(StandardCharsets.US_ASCII),
                    signature.toLowerCase(Locale.ROOT)
                            .getBytes(StandardCharsets.US_ASCII));
        } catch (Exception exception) {
            throw new IllegalStateException(
                    "Could not verify the payment signature.", exception);
        }
    }
}
