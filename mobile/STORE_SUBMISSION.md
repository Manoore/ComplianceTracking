# CompliNow — App Store & Play Store Submission Guide

## Payments / Subscriptions

**No in-app purchase is required.** CompliNow qualifies for the B2B SaaS "reader app" exemption on both Apple and Google platforms (the same model used by Slack, Notion, Figma).

- Subscriptions are sold at **complinow.com** via Stripe or similar web payment processor
- The mobile app is a client that accesses the purchased service — no money changes hands in-app
- Apple explicitly allows this under App Store Review Guidelines §3.1.3(b) (enterprise services)
- The app description must mention this: ✅ already added ("Subscriptions are purchased at complinow.com")

---

## Apple App Store Checklist

### Code requirements (all done ✅)
- [x] Account deletion in-app (Profile → Delete Account) — §5.1.1(v)
- [x] In-app Privacy Policy screen
- [x] HTTPS-only (NSAllowsArbitraryLoads = false in Info.plist)
- [x] 15-minute session timeout
- [x] No PHI stored in iCloud (NSUbiquitousContainers not declared)
- [x] Permission usage strings in Info.plist (camera, photo library, location)
- [x] Healthcare disclaimer in app description ("not a medical device")
- [x] Subscription disclosure in app description

### App Store Connect — you must do these
- [ ] **Register bundle ID** `com.complinow.app` at developer.apple.com → Identifiers
- [ ] **Create app** in App Store Connect → Apps → +
- [ ] **Age rating** — answer the questionnaire; select **17+** (Medical/Treatment Information)
- [ ] **Privacy nutrition labels** — declare what data you collect:
  - Contact Info (email, name) — used for account
  - Identifiers (user ID) — used for app functionality
  - Usage Data (app activity) — used for analytics
  - No data sold to third parties
- [ ] **App Review notes** — CRITICAL: provide demo credentials:
  ```
  Email: demo@complinow.com
  Password: Demo2024!
  Role: Admin (full access to all screens)
  Note: Backend is live at https://compliancetracking.onrender.com
  ```
- [ ] **Screenshots** — required sizes: 6.9" (iPhone 16 Pro Max), 12.9" iPad (if iPad supported)
- [ ] **Privacy policy URL** — must be live: https://complinow.com/privacy
- [ ] **Support URL** — must be live: https://complinow.com/support (or support email)
- [ ] **Category** — Medical (primary), Business (secondary)

### Signing (GitHub Secrets needed)
| Secret | How to get |
|---|---|
| `APPLE_TEAM_ID` | developer.apple.com → Membership |
| `IOS_DISTRIBUTION_CERT_BASE64` | Keychain Access → export .p12 → `base64 -i cert.p12 \| pbcopy` |
| `IOS_DISTRIBUTION_CERT_PASSWORD` | Password set on the .p12 |
| `KEYCHAIN_PASSWORD` | Any password e.g. `MyCI2024!` |
| `IOS_PROVISIONING_PROFILE_BASE64` | Developer portal → Profiles → download → `base64 -i file.mobileprovision \| pbcopy` |
| `APP_STORE_CONNECT_KEY_ID` | App Store Connect → Users & Access → Integrations → API Key |
| `APP_STORE_CONNECT_ISSUER_ID` | Same page as above |
| `APP_STORE_CONNECT_API_KEY_BASE64` | Download .p8 → `base64 -i AuthKey_XXX.p8 \| pbcopy` |

---

## Google Play Store Checklist

### Code requirements (all done ✅)
- [x] Account deletion in-app — Play policy requirement
- [x] HTTPS-only (network_security_config.xml)
- [x] No cleartext traffic
- [x] Data extraction rules (no cloud backup of sensitive data)
- [x] ProGuard/R8 minification enabled
- [x] minSdkVersion 23 (Android 6.0+)
- [x] Healthcare disclaimer in changelog

### Play Console — you must do these
- [ ] **Organization account** — REQUIRED for health apps since Jan 2026. Verify your account as an Organization (needs D-U-N-S number). Go to Play Console → Account details → Account type
- [ ] **Health Apps Declaration Form** — Required since 2025. Go to Play Console → Policy → App content → Health apps declaration. Answer: this is NOT a medical device, it is a workflow/compliance management tool
- [ ] **Data Safety section** — declare:
  - Email address (collected, shared with service provider)
  - Name (collected, shared with service provider)
  - User IDs (collected, not shared)
  - App interactions (collected, not shared)
  - Data is encrypted in transit ✅
  - Users can request deletion ✅
- [ ] **App content rating** — complete the IARC questionnaire; expect **Everyone** or **Everyone 10+**
- [ ] **Privacy policy URL** — must match exactly: https://complinow.com/privacy (same in Play Console, in-app, and on website)
- [ ] **Screenshots** — phone screenshots required; tablet optional
- [ ] **Category** — Medical (primary)
- [ ] **Short description** — max 80 chars (add "not a medical device" signal)

### Signing (GitHub Secrets needed)
| Secret | How to get |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Generate keystore → `base64 -i complinow-release.jks \| pbcopy` |
| `ANDROID_KEYSTORE_PASSWORD` | Password used during keytool generation |
| `ANDROID_KEY_ALIAS` | Alias used during keytool generation (e.g. `complinow`) |
| `ANDROID_KEY_PASSWORD` | Key password (often same as keystore password) |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Play Console → Setup → API access → Service account JSON |

#### Generate keystore (one time only — save it forever):
```bash
keytool -genkey -v -keystore complinow-release.jks \
  -alias complinow -keyalg RSA -keysize 2048 -validity 10000
```

---

## App Icons (both platforms)

1. Design a 1024×1024 PNG master icon (no transparency, no rounded corners — stores add them)
2. Upload to https://appicon.co
3. Place exported files:
   - iOS: `ios/Runner/Assets.xcassets/AppIcon.appiconset/` (replace Contents.json too)
   - Android: `android/app/src/main/res/mipmap-*/ic_launcher.png`

---

## Demo Account (create before submitting)

Apple and Google reviewers must be able to log in and test all features. Create a demo admin account on your live backend before submitting:

```
Email: demo@complinow.com
Password: Demo2024!
Role: admin
Org: Demo Clinic (pre-populated with sample data)
```

Add these credentials in the App Review notes field in App Store Connect / Play Console.

---

## Common Rejection Reasons to Avoid

| Reason | Status |
|---|---|
| No account deletion | ✅ Fixed |
| No privacy policy link | ✅ In-app + URL in metadata |
| Crashes on launch | Test on real device before submitting |
| Backend not accessible during review | Keep Render service running |
| Missing demo credentials | Add to App Review notes |
| Misleading health claims | ✅ Disclaimer added |
| Missing healthcare declaration (Play) | Complete Health Apps Declaration form |
| Personal developer account for health app (Play) | Verify as Organization |
