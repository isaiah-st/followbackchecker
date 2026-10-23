# Follow Back Checker

See who doesn't follow you back on Instagram, who follows you that you don't follow, and your mutuals.

Everything runs in your browser. Your export is read on your device and never uploaded or saved.

## Use it

1. Get your export from Instagram: **Settings → Accounts Centre → Your information and permissions → Download your information**. Choose **Some of your information**, tick only **Followers and following**, pick **Download to device**, format **JSON**, date range **All time**.
2. Open `index.html` in a browser.
3. Drop the `.zip` Instagram emails you onto the page (no need to unzip it)

## What you get

- **Don't follow back**: you follow them, they don't follow you.
- **Fans**: they follow you, you don't follow them.
- **Mutuals**: you follow each other.

Each list has a count, search, sorting by name or by when the follow happened, links to each profile and a button to copy the usernames.

## Files

- `index.html`, `style.css`: the page.
- `parse.js`: reads the export (including the `.zip`, using the browser's built-in decompression) and compares the lists.
- `app.js`: the lists, search, sort and copy.
