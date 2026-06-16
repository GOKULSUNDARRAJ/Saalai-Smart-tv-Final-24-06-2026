package com.example.tvapp;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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
    static volatile boolean isVideoActivityRunning = false;
    static volatile long videoEndedAtMs = 0;
    static volatile long videoActivityClosedAtMs = 0;
    static volatile long lastVideoPositionMs = 0;
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
            if (isVideoActivityRunning) {
                Log.d("VideoPlayerPlugin", "play() BLOCKED - VideoActivity still running");
                call.resolve(new JSObject().put("positionMs", 0).put("blocked", true));
                return;
            }
            if (sClearActiveRunnable != null) {
                sHandler.removeCallbacks(sClearActiveRunnable);
                sClearActiveRunnable = null;
            }
            Log.d("VideoPlayerPlugin", "play() called during cooldown — cancelling cooldown, allowing new play");
        }

        if (sClearActiveRunnable != null) {
            sHandler.removeCallbacks(sClearActiveRunnable);
            sClearActiveRunnable = null;
        }

        String fallbackUrl = call.getString("fallbackUrl", "");
        long startPositionMs = call.getLong("startPositionMs", 0L);
        if (startPositionMs == 0) startPositionMs = call.getInt("startPositionMs", 0);
        long movieId = call.getLong("movieId", 0L);
        if (movieId == 0) movieId = call.getInt("movieId", 0);
        boolean forceFromBeginning = Boolean.TRUE.equals(call.getBoolean("forceFromBeginning", false));
        boolean isLive = Boolean.TRUE.equals(call.getBoolean("isLive", false));
        boolean disableResumeSave = Boolean.TRUE.equals(call.getBoolean("disableResumeSave", false));
        String playlistJson = call.getString("playlistJson", "");
        int playlistIndex = call.getInt("playlistIndex", 0);
        String relatedJson = call.getString("relatedJson", "");
        Log.d("VideoPlayerPlugin", "play() called: url=" + url + " | startPositionMs=" + startPositionMs + " | movieId=" + movieId + " | forceFromBeginning=" + forceFromBeginning + " | disableResumeSave=" + disableResumeSave);

        isVideoActive = true;
        isVideoActivityRunning = true;
        videoEndedAtMs = 0;

        Intent intent = new Intent(getContext(), VideoActivity.class);
        intent.putExtra("disableAudio", false);
        intent.putExtra("url", url);
        intent.putExtra("title", title);
        intent.putExtra("fallbackUrl", fallbackUrl);
        intent.putExtra("startPositionMs", startPositionMs);
        intent.putExtra("movieId", movieId);
        intent.putExtra("forceFromBeginning", forceFromBeginning);
        intent.putExtra("isLive", isLive);
        intent.putExtra("disableResumeSave", disableResumeSave);
        intent.putExtra("playlistJson", playlistJson);
        intent.putExtra("playlistIndex", playlistIndex);
        intent.putExtra("relatedJson", relatedJson);

        call.save();
        startActivityForResult(call, intent, "handleVideoResult");
    }

    @ActivityCallback
    private void handleVideoResult(PluginCall call, ActivityResult result) {
        isVideoActivityRunning = false;
        videoActivityClosedAtMs = SystemClock.uptimeMillis();
        if (call == null) return;
        long positionMs = lastVideoPositionMs;
        lastVideoPositionMs = 0;
        long navigateToMovieId = 0;
        if (result != null && result.getData() != null) {
            if (positionMs == 0) positionMs = result.getData().getLongExtra("position_ms", 0);
            navigateToMovieId = result.getData().getLongExtra("navigate_to_movie_id", 0);
        }
        Log.d("VideoPlayerPlugin", "handleVideoResult: positionMs=" + positionMs + " navigateToMovieId=" + navigateToMovieId);
        JSObject ret = new JSObject();
        ret.put("positionMs", positionMs);
        ret.put("navigateToMovieId", navigateToMovieId);
        call.resolve(ret);
    }

    @PluginMethod
    public void getResumePosition(PluginCall call) {
        long movieId = call.getLong("movieId", 0L);
        if (movieId == 0) movieId = call.getInt("movieId", 0);
        SharedPreferences prefs = getContext().getSharedPreferences("SaalaiTVResume", Context.MODE_PRIVATE);
        long positionMs = prefs.getLong("pos_" + movieId, 0);
        long durationMs = prefs.getLong("dur_" + movieId, 0);
        Log.d("VideoPlayerPlugin", "getResumePosition: movieId=" + movieId + " positionMs=" + positionMs + " durationMs=" + durationMs);
        JSObject ret = new JSObject();
        ret.put("positionMs", positionMs);
        ret.put("durationMs", durationMs);
        call.resolve(ret);
    }

    @PluginMethod
    public void getResumePositionByTitle(PluginCall call) {
        String title = call.getString("title", "");
        SharedPreferences prefs = getContext().getSharedPreferences("SaalaiTVResume", Context.MODE_PRIVATE);
        long positionMs = prefs.getLong("pos_title_" + title, 0);
        Log.d("VideoPlayerPlugin", "getResumePositionByTitle: title=" + title + " positionMs=" + positionMs);
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
