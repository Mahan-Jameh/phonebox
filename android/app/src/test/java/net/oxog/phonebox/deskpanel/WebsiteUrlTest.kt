package net.oxog.phonebox.deskpanel

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WebsiteUrlTest {
    @Test
    fun acceptsArbitraryHttpsUrlsAndKeepsTheirPathAndQuery() {
        val url = "https://www.thetruetrade.io/fa/trade/BTCUSDT?view=full"
        assertEquals(url, WebsiteUrl.normalize(url))
    }

    @Test
    fun blocksInsecureSchemesCredentialsAndMalformedHosts() {
        listOf("http://example.com", "file:///etc/passwd", "javascript:alert(1)", "https://user:pass@example.com", "https:///missing-host")
            .forEach { assertNull(it, WebsiteUrl.normalize(it)) }
    }

    @Test
    fun boundsInputLengthAndRejectsWhitespace() {
        assertNull(WebsiteUrl.normalize("https://example.com/has space"))
        assertNull(WebsiteUrl.normalize("https://example.com/" + "a".repeat(4096)))
    }
}
