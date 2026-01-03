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
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.messaging.**
-dontwarn com.google.firebase.iid.**
-dontwarn com.google.firebase.**

# Keep Firebase Analytics (if used)
-keep class com.google.firebase.analytics.** { *; }
-dontwarn com.google.firebase.analytics.**

# Keep Firebase Instance ID classes (legacy but may still be used)
-keep class com.google.firebase.installations.** { *; }
-dontwarn com.google.firebase.installations.**

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

# Keep react-native-background-actions classes
-keep class com.asterinet.react.bgactions.** { *; }
-dontwarn com.asterinet.react.bgactions.**

# Keep background service classes
-keep class com.connect.app.KeepAliveService { *; }
-keep class com.connect.app.BackgroundTtsService { *; }
-keep class com.connect.app.BootReceiver { *; }

# Keep AsyncStorage for background service
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-dontwarn com.reactnativecommunity.asyncstorage.**

# Keep socket.io classes used in background service
-keep class io.socket.** { *; }
-dontwarn io.socket.**

# Keep all JavaScript interface methods for background tasks
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Prevent obfuscation of background task function names
-keepclassmembers class * {
    native <methods>;
}

# Keep react-native-reanimated classes to prevent NoSuchFieldException
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.worklets.** { *; }
-keepclassmembers class com.swmansion.worklets.** { *; }
-keepclassmembers class com.swmansion.reanimated.** { *; }
-dontwarn com.swmansion.reanimated.**
-dontwarn com.swmansion.worklets.**

# Keep React Native bridge classes used by reanimated
# Note: mIsFinished field may not exist in all React Native versions
# This is handled gracefully by reanimated library
-keep class com.facebook.react.bridge.queue.MessageQueueThreadImpl { *; }
-keepclassmembers class com.facebook.react.bridge.queue.MessageQueueThreadImpl {
    *;
    <fields>;
    <methods>;
}

# Suppress NoSuchFieldException for mIsFinished - this is a known compatibility issue
# between react-native-reanimated and different React Native versions
# The library handles this gracefully, so we suppress the warning
-dontwarn com.swmansion.worklets.WorkletsMessageQueueThreadBase

# Suppress camera extensions warnings (these are optional and not critical)
-dontwarn androidx.camera.extensions.impl.**
-dontwarn androidx.camera.extensions.**

# Keep VisionCamera classes (only if needed, but filtered in background process)
-keep class com.mrousavy.camera.react.** { *; }
-dontwarn com.mrousavy.camera.react.**
