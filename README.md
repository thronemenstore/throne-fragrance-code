# THRONE FRAGRANCE — Website Coding Files (VS Code)

Luxury perfume store: **THRONE FRAGRANCE — RULE YOUR SCENT**.
Forest green, ivory and brass color palette with Playfair Display headings and DM Sans interface text.
The storefront has a featured product, searchable collection and a keyboard-accessible bag. Checkout preserves delivery details when shipping or payment changes. The admin dashboard works on mobile.

## Kya hai is project mein

```
throne-fragrance-code/
├── server.js              # Backend — Node.js + Express + SQLite
|-- admin.html            # Admin panel (served after sign-in)
├── package.json           # npm install / npm start
├── public/
│   ├── index.html         # Storefront (hero, collection, product pages, checkout, FAQ, Track Order, Contact, Policies)
│   ├── css/style.css      # Clean white professional design
│   ├── js/app.js          # Storefront logic: bag, search, filter, checkout, phone/province validation, track order
│   ├── js/admin.js        # Admin logic: edit price/stock, order status, manual orders
│   └── images/            # Premium product photos — WebP + JPG (glory, midnight-crown, velora)
└── data/                  # SQLite database (auto-created on first run)
    └── throne.db
```

## Products (seeded, real data)

| Product | Family | Price |
|---|---|---|
| GLORY | Woody | Rs. 2,199 |
| MIDNIGHT CROWN | Oriental | Rs. 1,799 |
| VELORA | Floral | Rs. 1,999 |

- Bundle Trio: Rs. 4,798 (was Rs. 5,997, Save 20%) — 2,199 + 1,799 + 1,999 = 5,997, 20% off = 4,798
- Promo code: **THRONE10** = 10% off
- WhatsApp: 03020682098 · Instagram: @thronefragrance2235
- JazzCash: Muhammad Saim · 0301-0746622
- Shipping: Standard Rs. 300 (free over Rs. 5,000, 3–5 days), Express Rs. 499 (1–2 days), Local Rs. 150 (free over Rs. 5,000, same/next day)
- Payment: Cash on Delivery, Bank Transfer, JazzCash / EasyPaisa

## New features (live website ke mutabiq)

- **Phone validation:** checkout aur Track Order mein phone bilkul 11 digits, 03 se shuru hona chahiye. Type karte hue number khud `03xx-xxxxxxx` format mein ban jata hai. Galat number par field ke neeche laal error aur order place nahi hota. Server par bhi yehi check hai (+92 wala number 03 mein normalise ho jata hai).
- **Province (required):** Punjab, Sindh, Khyber Pakhtunkhwa, Balochistan, Gilgit-Baltistan, Azad Jammu & Kashmir, Islamabad Capital Territory. Province select karo to us ke sheher City list mein upar aa jate hain; sheher select karo to province khud select ho jata hai. Province order ke saath save hota hai — confirmation, Admin → Orders aur WhatsApp message mein dikhta hai.
- **Cities:** Lahore, Karachi, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta, Hyderabad, Sialkot, Gujranwala, Bahawalpur, Sargodha, Other.
- **Track Order page (`#/track`):** TF- reference + phone daalo → status dikhta hai (New → Confirmed → Dispatched → Delivered), items, total, city/province. Galat phone par "Order not found".
- **FAQ page (`#/faq`):** delivery, COD, advance payment, returns, original/sealed, shipping charges — charges live settings se parhe jate hain, Admin mein badlo to FAQ bhi update.
- **Policies (footer links):** Return & Refund Policy (7-day returns), Privacy Policy, Terms & Conditions.
- **Contact page (`#/contact`):** WhatsApp + Instagram cards, message form WhatsApp par khulta hai.
- **Fast images:** product photos WebP mein (480/800/1200 jaisi sizes ka khayal), hero preload, neeche wali images lazy-load, har image par width/height — layout jump nahi karta.

## VS Code mein kaise chalaye (step by step)

1. Ye folder VS Code mein kholo: **File → Open Folder → `throne-fragrance-code`**
2. Terminal kholo: **Terminal → New Terminal** (ya `Ctrl + \``)
3. Dependencies install karo:
   ```
   Set-Location -LiteralPath 'E:\throne-fragrance-code'
   npm.cmd ci
   ```
4. Server start karo:
   ```
   $env:ADMIN_PASSWORD = 'yahan-apna-naya-password-likhein'
   npm.cmd start
   ```
5. Browser mein kholo:
   - Storefront: **http://localhost:3000**
   - Admin panel: **http://localhost:3000/admin**. Username `admin`, password `ADMIN_PASSWORD` se set karein. Live hosting par HTTPS use karein.
   - Track Order: **http://localhost:3000/#/track**
   - FAQ: **http://localhost:3000/#/faq**

Server band karne ke liye terminal mein `Ctrl + C` dabao.

## Admin management

- **Discounts & Offers** mein promo code, minimum subtotal aur trio discount set karein. Dono offers ke apne on/off controls hain.
- **Customers** mein website aur manual orders ki saved details phone number ke mutabiq group hoti hain. Latest address, order count aur delivered order value dikhte hain.
- **Reviews** mein delivered orders ki product reviews approve ya reject karein. Storefront par approved reviews dikhte hain.
- **PostEx** ke liye server start karne se pehle PowerShell mein `POSTEX_TOKEN` set karein. Orders tab mein **Confirm address & book** se delivery details verify karein. Admin shipment create karta hai, tracking save karta hai aur official airway bill PDF download karta hai. Agar merchant account ko pickup code chahiye, server start karne se pehle `POSTEX_PICKUP_ADDRESS_CODE` bhi set karein. **Get PostEx slip** saved tracking number se sirf PDF dobara mangwata hai.
- **Meta Pixel** ID Integrations mein save karein. Events tab send hote hain jab customer storefront footer mein marketing cookies enable karta hai.

## Live update kaise kaam karti hai

Storefront aur Admin **ek hi SQLite database** (`data/throne.db`) se chalte hain.
Admin mein price badlo → Save karo → storefront tab refresh karo → nayi price foran dikhegi. Koi export nahi.

Test karne ke liye:
1. Admin kholo → Products → Glory ki price `2199` se `2399` karo → Save
2. Storefront kholo → refresh karo → Glory Rs. 2,399 dikhega
3. Wapas `2199` kar do (asal price yehi hai)

## Order test kaise karein

1. Storefront par Glory ko **Add to Bag** karo → **Checkout**
2. Name, phone (11 digits, 03 se shuru), Province, City, address bharo → **Place Order**
3. Confirmation par **TF-XXXXXX** reference milega, "Deliver to: City, Province" dikhega
4. Admin → **Orders** mein wohi order dikhega, status change kar sakte ho (new → confirmed → dispatched → delivered)
5. **Track Order** par wohi TF- ref + phone daalo — order ka status dikhega. Galat phone par "not found" ayega.

## Product photos — included (WebP)

The premium-background product photos are already in `public/images/` — no need to add your own:

- `public/images/glory.webp` (~110 KB) + `glory.jpg`
- `public/images/midnight-crown.webp` (~110 KB) + `midnight-crown.jpg`
- `public/images/velora.webp` (~103 KB) + `velora.jpg`

Soft warm off-white studio background, same bottles and gift bags as the real products.
The storefront serves the **WebP** versions and falls back to the JPG of the same name if a browser cannot load WebP.
To replace a photo, keep the same filename (`glory` / `midnight-crown` / `velora`) — no code change needed.

## API (agar aap code parhna chahein)

- `GET /api/store` — live products, settings, shipping, payment accounts
- `GET /api/admin` — sab kuch + orders
- `POST /api/orders` — naya order (total server par calculate hota hai, live prices se; phone 11-digit + province required)
- `POST /api/track-order` — `{ref, phone}` → order status/items/total/city/province, ya `{found:false}`
- `GET /api/orders` — orders list
- `PATCH /api/orders/:id/status` · `PATCH /api/orders/:id/advance`
- `POST /api/admin/orders` — manual order (WhatsApp/phone/walk-in), same phone + province rules
- `PUT /api/admin/products/:id` — product edit (price/stock/live)
- `POST /api/admin/settings` · `POST /api/admin/shipping` · `POST /api/admin/accounts`

## Notes

- Database pehli baar run par banti hai aur seed hoti hai. Dobara run par purana data **overwrite nahi hota** — aapki prices/orders safe rehte hain.
- Database reset karni ho to server band karke `data/throne.db` delete kar do, phir `npm start` — seed data dobara ban jayega.
- Ye project local / learning / VS Code ke liye hai. Asal domain par live karne ke liye isay kisi host (Vercel/Render/VPS) par deploy karna hoga, ya Shopify use karein.
