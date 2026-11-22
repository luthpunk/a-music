package app.musike.android;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebView;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private boolean tvDevice = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(MusikePlaybackPlugin.class);
        registerPlugin(MusikeDevicePlugin.class);
        super.onCreate(savedInstanceState);
        tvDevice = MusikeDevicePlugin.isTvDevice(this);
        // Draw behind the status and navigation bars on every Android version; the page pads itself
        // (env(safe-area-inset-*)) and the SystemBars plugin keeps the icons readable for the theme.
        EdgeToEdge.enable(this, SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT));
        configureWebView();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (tvDevice) {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) webView.requestFocus();
        }
    }

    private void configureWebView() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.getSettings().setSupportZoom(false);
        webView.getSettings().setBuiltInZoomControls(false);
        if (tvDevice) {
            webView.setFocusable(true);
            webView.setFocusableInTouchMode(true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                webView.setDefaultFocusHighlightEnabled(false);
            }
            webView.requestFocus();
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        String mediaAction = mediaActionForKey(event.getKeyCode());
        if (mediaAction != null) {
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null) {
                    webView.evaluateJavascript("window.__amusicRemoteKey && window.__amusicRemoteKey('" + mediaAction + "')", null);
                }
            }
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    private static String mediaActionForKey(int keyCode) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                return "toggle";
            case KeyEvent.KEYCODE_MEDIA_PLAY:
                return "play";
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_STOP:
                return "pause";
            case KeyEvent.KEYCODE_MEDIA_NEXT:
                return "next";
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
                return "prev";
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                return "seekForward";
            case KeyEvent.KEYCODE_MEDIA_REWIND:
                return "seekBackward";
            default:
                return null;
        }
    }
}
