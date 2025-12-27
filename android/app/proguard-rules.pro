# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Keep Firebase Cloud Messaging classes for production builds
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.firebase.iid.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.messaging.**
-dontwarn com.google.firebase.iid.**

# Keep React Native Firebase Messaging classes
-keep class io.invertase.firebase.messaging.** { *; }
-keep class com.facebook.react.bridge.** { *; }

# Keep Notifee classes
-keep class app.notifee.** { *; }
-dontwarn app.notifee.**

# Keep background message handler function
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep all native methods for FCM
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep React Native modules
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
