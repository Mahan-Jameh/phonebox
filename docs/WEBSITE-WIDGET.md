# Website widget

The Website widget displays an HTTPS page in its own Android `WebView`. It is useful for interactive pages which refuse
to load in an iframe, including `https://www.thetruetrade.io/fa/trade/BTCUSDT`. Make the widget large enough to show the
site controls and add it from **Settings › Pages**. The Windows Agent stores the URL and options and can preview pages
where the browser permits framing; the Android phone renders the site.

On the phone, use the page's own touch controls. The widget toolbar provides back, refresh, zoom and fullscreen; Android
Back exits fullscreen first, then follows the website's history. JavaScript, first-party cookies and persistent sign-in
sessions, pinch zoom and fullscreen video are supported. Cookies and JavaScript can be turned off in widget options.

The site runs in a separate WebView, not in the PhoneBox panel WebView. It receives no `Android` interface, PhoneBox
bridge key, agent proxy headers, `/agent` transport or widget messaging API. PhoneBox blocks non-HTTPS navigation,
mixed content, file/content access and third-party cookies. Website traffic goes directly from the phone to the configured
site and its services; read [Privacy](../PRIVACY.md) before signing in. First-party site cookies stay on the phone.

External pages can offer actions such as orders or transfers. PhoneBox forwards touch input to the displayed site; review
the site's own order details before confirming a transaction.
