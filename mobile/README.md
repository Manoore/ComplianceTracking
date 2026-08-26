# ComplianceTrack Mobile

Flutter app for iOS and Android. Uses the same backend as the web app.

## Setup

1. Install Flutter: https://docs.flutter.dev/get-started/install
2. Set the backend URL in `lib/services/api_service.dart` → `kBaseUrl`
3. Run the app:

```bash
cd mobile
flutter pub get
flutter run
```

## Build for release

```bash
# Android APK
flutter build apk --release

# Android App Bundle (Play Store)
flutter build appbundle --release

# iOS (requires Mac + Xcode)
flutter build ios --release
```

## Screens
- Login
- Dashboard
- Inspections (list, new with GPS, detail with checklist + camera)
- Audits (list, detail with approve/reject)
- Certifications (courses, take quiz, completions)
- Corrective Actions (list, filter, resolve)
- Announcements (list, create)
- Notifications
- Admin: Users, Clinics, Reports
