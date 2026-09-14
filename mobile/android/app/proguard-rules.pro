# Flutter wrapper
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-keep class io.flutter.embedding.** { *; }

# Keep our app entry point
-keep class com.complinow.compliance_track_mobile.** { *; }

# flutter_secure_storage
-keep class com.it_nomads.fluttersecurestorage.** { *; }

# geolocator
-keep class com.baseflow.geolocator.** { *; }

# image_picker
-keep class io.flutter.plugins.imagepicker.** { *; }

# url_launcher
-keep class io.flutter.plugins.urllauncher.** { *; }

# flutter_local_notifications
-keep class com.dexterous.** { *; }

# Kotlin serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

# Suppress warnings for missing classes we don't use
-dontwarn java.lang.reflect.**

# Flutter's embedding defensively references Play Core's deferred-component
# (dynamic feature delivery) classes even though this app doesn't use that
# feature and doesn't depend on com.google.android.play:core -- without this,
# R8 fails the release build with "Missing class" errors for all of them.
-dontwarn com.google.android.play.core.**
