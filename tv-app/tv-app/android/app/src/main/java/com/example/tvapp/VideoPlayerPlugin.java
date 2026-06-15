package com.example.tvapp;

import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
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

    static volatile boolean isVideoActive = false;
    static volatile long videoEndedAtMs = 0;
    static final long POST_VIDEO_BLOCK_MS = 5000;
    private static final Handler sHandler = new Handler(Looper.getMainLooper());
    private static Runnable sClearActiveRunnable = null;

    @PluginMethod
    public void play(PluginCall call) {
        String url = call.getString("url");
        String title = call.getString("title", "");

        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        if (isVideoActive) {
            Log.d("VideoPlayerPlugin", "play() BLOCKED - video already active");
            call.resolve(new JSObject().put("positionMs", 0).put("blocked", true));
            return;
        }

        if (sClearActiveRunnable != null) {
            sHandler.removeCallbacks(sClearActiveRunnable);
            sClearActiveRunnable = null;
        }

        String fallbackUrl = call.getString("fallbackUrl", "");
        long startPositionMs = call.getLong("startPositionMs", 0L);
        String playlistJson = call.getString("playlistJson", "");
        int playlistIndex = call.getInt("playlistIndex", 0);
        Log.d("VideoPlayerPlugin", "play() called: url=" + url + " | startPositionMs=" + startPositionMs + " | raw=" + call.getData().opt("startPositionMs"));

        isVideoActive = true;
        videoEndedAtMs = 0;

        Intent intent = new Intent(getContext(), VideoActivity.class);
        intent.putExtra("disableAudio", false);
        intent.putExtra("url", url);
        intent.putExtra("title", title);
        intent.putExtra("fallbackUrl", fallbackUrl);
        intent.putExtra("startPositionMs", startPositionMs);
        intent.putExtra("playlistJson", playlistJson);
        intent.putExtra("playlistIndex", playlistIndex);

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

    @PluginMethod
    public void endPlay(PluginCall call) {
        videoEndedAtMs = SystemClock.uptimeMillis();
        Log.d("VideoPlayerPlugin", "endPlay() called — videoEndedAtMs stamped, isVideoActive will clear in 2s");
        if (sClearActiveRunnable != null) {
            sHandler.removeCallbacks(sClearActiveRunnable);
        }
        sClearActiveRunnable = () -> {
            isVideoActive = false;
            sClearActiveRunnable = null;
            Log.d("VideoPlayerPlugin", "endPlay: isVideoActive cleared (delayed)");
        };
        sHandler.postDelayed(sClearActiveRunnable, 2000);
        call.resolve();
    }
}
