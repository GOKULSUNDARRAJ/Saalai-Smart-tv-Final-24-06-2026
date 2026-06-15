package com.example.tvapp;

import android.os.SystemClock;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    public class AndroidNativeBridge {
        @JavascriptInterface
        public void exit() {
            runOnUiThread(() -> finishAffinity());
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VideoPlayerPlugin.class);
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        settings.setLoadsImagesAutomatically(true);
        settings.setBlockNetworkLoads(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setDomStorageEnabled(true);
        settings.setJavaScriptEnabled(true);
        webView.addJavascriptInterface(new AndroidNativeBridge(), "AndroidNative");
    }

    @Override
    public void onRestart() {
        super.onRestart();
        if (!VideoPlayerPlugin.isVideoActive) {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.post(() -> webView.reload());
            }
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int keyCode = event.getKeyCode();

        if (keyCode == KeyEvent.KEYCODE_BACK || keyCode == KeyEvent.KEYCODE_HOME) {
            if (VideoPlayerPlugin.isVideoActivityRunning) {
                return super.dispatchKeyEvent(event);
            }
            if (keyCode == KeyEvent.KEYCODE_BACK &&
                    VideoPlayerPlugin.videoActivityClosedAtMs > 0 &&
                    SystemClock.uptimeMillis() - VideoPlayerPlugin.videoActivityClosedAtMs < 600) {
                return true;
            }
            if (event.getAction() == KeyEvent.ACTION_DOWN) {
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    if (keyCode == KeyEvent.KEYCODE_BACK) {
                        webView.evaluateJavascript(
                            "window.dispatchEvent(new KeyboardEvent('keydown',{keyCode:4,which:4,key:'GoBack',bubbles:true,cancelable:true}))",
                            null
                        );
                    } else {
                        webView.evaluateJavascript(
                            "window.dispatchEvent(new KeyboardEvent('keydown',{keyCode:36,which:36,key:'Home',bubbles:true,cancelable:true}))",
                            null
                        );
                    }
                }
            }
            return true;
        }

        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_UP:
            case KeyEvent.KEYCODE_DPAD_DOWN:
            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_DPAD_RIGHT:
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_PLAY:
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_REWIND:
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                if (VideoPlayerPlugin.isVideoActivityRunning) {
                    return super.dispatchKeyEvent(event);
                }
                if (VideoPlayerPlugin.videoEndedAtMs > 0 &&
                        SystemClock.uptimeMillis() - VideoPlayerPlugin.videoEndedAtMs < VideoPlayerPlugin.POST_VIDEO_BLOCK_MS) {
                    return super.dispatchKeyEvent(event);
                }
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    webView.requestFocus();
                    return webView.dispatchKeyEvent(event);
                }
                break;
        }

        return super.dispatchKeyEvent(event);
    }
}
