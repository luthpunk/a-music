package app.musike.android;

import android.app.UiModeManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
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

    @PluginMethod
    public void showKeyboard(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                webView.requestFocus();
                InputMethodManager imm = (InputMethodManager) getContext().getSystemService(Context.INPUT_METHOD_SERVICE);
                if (imm != null) imm.showSoftInput(webView, InputMethodManager.SHOW_IMPLICIT);
            }
            call.resolve();
        });
    }
}
