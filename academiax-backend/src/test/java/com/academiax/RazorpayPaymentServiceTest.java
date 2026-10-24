package com.academiax;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class RazorpayPaymentServiceTest {

    @Test
    void verifiesHmacSha256AndRejectsInvalidSignatures() {
        String signature =
                "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8";

        assertTrue(RazorpayPaymentService.matchesHmac(
                "key", "The quick brown fox jumps over the lazy dog", signature));
        assertFalse(RazorpayPaymentService.matchesHmac(
                "key", "The quick brown fox jumps over the lazy dog", "invalid"));
        assertFalse(RazorpayPaymentService.matchesHmac(
                "", "The quick brown fox jumps over the lazy dog", signature));
    }
}
