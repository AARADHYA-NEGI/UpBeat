package com.aaradhya.upbeat;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    public static MainActivity sInstance = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        sInstance = this;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this,
                    new String[] { Manifest.permission.POST_NOTIFICATIONS },
                    1001
                );
            }
        }

        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView wv = this.bridge.getWebView();
            wv.getSettings().setMediaPlaybackRequiresUserGesture(false);
            wv.addJavascriptInterface(new UpBeatJsBridge(), "UpBeatNative");
        }

        handleCarIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleCarIntent(intent);
    }

    private void handleCarIntent(Intent intent) {
        if (intent != null && intent.hasExtra("car_action")) {
            String action = intent.getStringExtra("car_action");
            String payload = intent.getStringExtra("car_payload");
            dispatchCarAction(action, payload != null ? payload : "");
        }
    }

    public void dispatchCarAction(final String action, final String payload) {
        if (action == null) return;
        if (this.bridge != null && this.bridge.getWebView() != null) {
            final WebView wv = this.bridge.getWebView();
            wv.post(() -> {
                String safeAction = action.replace("'", "\\'");
                String safePayload = payload != null ? payload.replace("'", "\\'") : "";
                String js = "window.onUpBeatCarAction && window.onUpBeatCarAction('" + safeAction + "', '" + safePayload + "');";
                wv.evaluateJavascript(js, null);
            });
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().onResume();
            this.bridge.getWebView().resumeTimers();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (sInstance == this) {
            sInstance = null;
        }
    }

    public class UpBeatJsBridge {
        @JavascriptInterface
        public void updatePlayback(boolean isPlaying, String title, String artist) {
            updatePlayback(isPlaying, title, artist, "", 0, 0);
        }

        @JavascriptInterface
        public void updatePlayback(boolean isPlaying, String title, String artist, String artUrl, long durationSec, long positionSec) {
            UpBeatMediaService.updatePlayback(
                MainActivity.this,
                isPlaying,
                title,
                artist,
                artUrl,
                durationSec,
                positionSec
            );
        }

        @JavascriptInterface
        public void syncQueue(String queueJson) {
            UpBeatMediaService.saveQueue(MainActivity.this, queueJson);
        }

        @JavascriptInterface
        public void syncFavorites(String favoritesJson) {
            UpBeatMediaService.saveFavorites(MainActivity.this, favoritesJson);
        }
    }
}
