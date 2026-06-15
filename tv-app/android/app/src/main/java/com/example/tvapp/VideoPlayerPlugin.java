package com.example.tvapp;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VideoPlayer")
public class VideoPlayerPlugin extends Plugin {

    private static final int REQUEST_CODE_PLAY = 9001;

    @PluginMethod
    public void play(PluginCall call) {
        String url = call.getString("url");
        String title = call.getString("title", "");

        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        String fallbackUrl = call.getString("fallbackUrl", "");
        long startPositionMs = call.getLong("startPositionMs", 0L);

        Intent intent = new Intent(getContext(), VideoActivity.class);
        intent.putExtra("disableAudio", false);
        intent.putExtra("url", url);
        intent.putExtra("title", title);
        intent.putExtra("fallbackUrl", fallbackUrl);
        intent.putExtra("startPositionMs", startPositionMs);

        call.save();
        startActivityForResult(call, intent, "handleVideoResult");
    }

    @ActivityCallback
    private void handleVideoResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        long positionMs = 0;
        if (result != null && result.getData() != null) {
            positionMs = result.getData().getLongExtra("position_ms", 0);
        }
        JSObject ret = new JSObject();
        ret.put("positionMs", positionMs);
        call.resolve(ret);
    }
}
