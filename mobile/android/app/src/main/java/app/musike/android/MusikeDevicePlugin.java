package app.musike.android;

import android.app.AlertDialog;
import android.app.UiModeManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.drawable.GradientDrawable;
import android.text.InputType;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.WebView;
import android.widget.EditText;
import android.widget.LinearLayout;
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
    public void promptSearch(PluginCall call) {
        String initial = call.getString("value", "");
        String placeholder = call.getString("placeholder", "Search music");
        String title = call.getString("title", "Search");
        getActivity().runOnUiThread(() -> {
            Context ctx = getActivity();
            float dp = ctx.getResources().getDisplayMetrics().density;

            LinearLayout container = new LinearLayout(ctx);
            container.setOrientation(LinearLayout.VERTICAL);
            int padH = Math.round(24 * dp);
            int padV = Math.round(16 * dp);
            container.setPadding(padH, padV, padH, Math.round(8 * dp));

            EditText input = new EditText(ctx);
            input.setText(initial != null ? initial : "");
            if (input.getText() != null) input.setSelection(input.getText().length());
            input.setHint(placeholder);
            input.setHintTextColor(0xFF9BA1AD);
            input.setTextColor(0xFFECEEF2);
            input.setTextSize(18f);
            input.setSingleLine(true);
            input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
            input.setImeOptions(EditorInfo.IME_ACTION_SEARCH | EditorInfo.IME_FLAG_NO_EXTRACT_UI);

            GradientDrawable bg = new GradientDrawable();
            bg.setColor(0xFF121318);
            bg.setCornerRadius(14 * dp);
            bg.setStroke(Math.round(2 * dp), 0xFFC3EC52);
            input.setBackground(bg);
            int inPadH = Math.round(16 * dp);
            int inPadV = Math.round(12 * dp);
            input.setPadding(inPadH, inPadV, inPadH, inPadV);
            container.addView(input);

            final boolean[] resolved = { false };

            AlertDialog dialog = new AlertDialog.Builder(ctx, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                .setTitle(title)
                .setView(container)
                .setPositiveButton(android.R.string.search_go, (d, w) -> {
                    if (resolved[0]) return;
                    resolved[0] = true;
                    JSObject res = new JSObject();
                    res.put("submitted", true);
                    res.put("value", input.getText() != null ? input.getText().toString() : "");
                    call.resolve(res);
                })
                .setNegativeButton(android.R.string.cancel, (d, w) -> {
                    if (resolved[0]) return;
                    resolved[0] = true;
                    JSObject res = new JSObject();
                    res.put("submitted", false);
                    call.resolve(res);
                })
                .create();

            dialog.setOnCancelListener((d) -> {
                if (resolved[0]) return;
                resolved[0] = true;
                JSObject res = new JSObject();
                res.put("submitted", false);
                call.resolve(res);
            });

            dialog.setOnDismissListener((d) -> {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null) {
                    webView.post(webView::requestFocus);
                }
            });

            input.setOnEditorActionListener((v, actionId, event) -> {
                if (
                    actionId == EditorInfo.IME_ACTION_SEARCH ||
                    actionId == EditorInfo.IME_ACTION_DONE ||
                    actionId == EditorInfo.IME_ACTION_GO ||
                    (event != null && event.getKeyCode() == KeyEvent.KEYCODE_ENTER && event.getAction() == KeyEvent.ACTION_DOWN)
                ) {
                    if (!resolved[0]) {
                        resolved[0] = true;
                        JSObject res = new JSObject();
                        res.put("submitted", true);
                        res.put("value", input.getText() != null ? input.getText().toString() : "");
                        call.resolve(res);
                    }
                    dialog.dismiss();
                    return true;
                }
                return false;
            });

            if (dialog.getWindow() != null) {
                dialog.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);
            }

            dialog.show();
            input.requestFocus();
            input.postDelayed(() -> {
                InputMethodManager imm = (InputMethodManager) ctx.getSystemService(Context.INPUT_METHOD_SERVICE);
                if (imm != null) imm.showSoftInput(input, InputMethodManager.SHOW_IMPLICIT);
            }, 80);
        });
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
