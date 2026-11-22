package net.oxog.phonebox.deskpanel

import java.net.URI
import android.webkit.WebView

/** Geometry is reported in the panel WebView's CSS pixels and converted for the native overlay. */
internal data class WebsiteRect(val left: Float, val top: Float, val width: Float, val height: Float) {
    companion object {
        fun sanitized(left: Float, top: Float, width: Float, height: Float): WebsiteRect = WebsiteRect(
            if (left.isFinite()) left.coerceIn(-100_000f, 100_000f) else -100_000f,
            if (top.isFinite()) top.coerceIn(-100_000f, 100_000f) else -100_000f,
            if (width.isFinite()) width.coerceIn(0f, 100_000f) else 0f,
            if (height.isFinite()) height.coerceIn(0f, 100_000f) else 0f,
        )
    }
}

internal data class WebsiteView(
    val id: String,
    val webView: WebView,
    var url: String,
    var javascript: Boolean,
    var cookies: Boolean,
    var zoom: Boolean,
    var rect: WebsiteRect = WebsiteRect(0f, 0f, 0f, 0f),
)

/** Accept only HTTPS top-level destinations; webpage scripts and redirects cannot escape to app or file schemes. */
internal object WebsiteUrl {
    fun normalize(value: String): String? {
        if (value.length !in 1..4096 || value.any { it.isWhitespace() || it.code < 0x20 }) return null
        return try {
            val uri = URI(value)
            if (!uri.scheme.equals("https", ignoreCase = true) || uri.host.isNullOrBlank() || uri.rawUserInfo != null ||
                (uri.port != -1 && uri.port !in 1..65535)) null
            else uri.toASCIIString()
        } catch (_: Exception) { null }
    }
}
