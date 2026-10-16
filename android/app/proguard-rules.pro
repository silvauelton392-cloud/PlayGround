# Mantém métodos chamados via WebView (ponte AndroidDL.download)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
