package app.musike.android;

import android.app.UiModeManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.os.SystemClock;
import android.view.MotionEvent;
import android.view.inputmethod.InputMethodManager;
import android.webkit.WebView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** What kind of device the app runs on (web/src/native/android.ts): the same APK serves phones and Android TV. */
@CapacitorPlugin(name = "MusikeDevice")
public class MusikeDevicePlugin extends Plugin {

    static boolean isTvDevice(Context context) {
        UiModeManager uiMode = (UiModeManager) context.getSystemService(Context.UI_MODE_SERVICE);
        PackageManager pm = context.getPackageManager();
        return (
            (uiMode != null && uiMode.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION) ||
            pm.hasSystemFeature(PackageManager.FEATURE_LEANBACK) ||
            !pm.hasSystemFeature(PackageManager.FEATURE_TOUCHSCREEN)
        );
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject result = new JSObject();
        result.put("tv", isTvDevice(getContext()));
        call.resolve(result);
    }

    /**
     * Dispatches a genuine native tap at the input's coordinates inside the WebView so Chromium
     * opens the Android TV soft keyboard reliably right onto the original HTML <input>.
     */
    @PluginMethod
    public void tapToType(PluginCall call) {
        Double x = call.getDouble("x");
        Double y = call.getDouble("y");
        Double vw = call.getDouble("vw");
        Double vh = call.getDouble("vh");
        getActivity().runOnUiThread(() -> {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null && x != null && y != null && vw != null && vh != null && vw > 0 && vh > 0) {
                webView.requestFocus();
                float px = (float) (x * webView.getWidth() / vw);
                float py = (float) (y * webView.getHeight() / vh);
                long now = SystemClock.uptimeMillis();
                MotionEvent down = MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, px, py, 0);
                MotionEvent up = MotionEvent.obtain(now, now + 25, MotionEvent.ACTION_UP, px, py, 0);
                webView.dispatchTouchEvent(down);
                webView.dispatchTouchEvent(up);
                down.recycle();
                up.recycle();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void hideKeyboard(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                InputMethodManager imm = (InputMethodManager) getContext().getSystemService(Context.INPUT_METHOD_SERVICE);
                if (imm != null) imm.hideSoftInputFromWindow(webView.getWindowToken(), 0);
            }
            call.resolve();
        });
    }
}
