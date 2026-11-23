# Security policy

Please report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/ersinkoc/phonebox/security/advisories/new).
Include the affected version, operating system, connection mode (USB or paired Wi-Fi), reproduction steps and impact.
Do not include access tokens, pairing keys, calendar URLs or personal session transcripts.

Security fixes target the latest release. Install the latest agent and Android app together when a fix changes both sides.

PhoneBox can run shortcuts and control local applications. Keep the agent on loopback, its key-checked USB tunnel or its
authenticated, pinned-TLS Wi-Fi connection. Custom HTML widgets are sandboxed; they must use the documented widget messaging interface.
The Android Website widget uses a separate native WebView with no PhoneBox JavaScript bridge, agent proxy, or panel headers.
The optional TrueTrade on Windows widget uses a different path. A user-started Chrome extension shares an
explicitly selected TrueTrade market tab with the Agent on loopback. A short-lived, one-use code authorizes one
paired viewer. It does not expose a general DevTools endpoint. The bridge accepts only taps, vertical scroll and
limited keyboard input and stops when the tab changes. Only the latest frame and one pending input are kept in memory.
It accepts HTTPS destinations only, disables file and content access, blocks mixed content and third-party cookies, and
keeps first-party cookies on-device for persistent sessions when cookies are enabled. Website JavaScript is enabled by
default for interactive sites, but remains isolated from PhoneBox APIs. The Windows Agent only stores and edits the widget
configuration; the Android phone loads the configured site directly.
