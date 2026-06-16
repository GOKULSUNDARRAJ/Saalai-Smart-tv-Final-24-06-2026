package com.example.tvapp;

import android.animation.ValueAnimator;
import android.app.Activity;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.RectF;
import android.graphics.drawable.ClipDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;

public class VideoActivity extends Activity {

    private static final String TAG           = "SaalaiPlayer";
    private static final int    HIDE_DELAY_MS = 5000;
    private static final int    SEEK_STEP_MS  = 10000;

    private enum Focus { BACK, SEEKBAR, REWIND, PLAY_PAUSE, FORWARD, MORE }

    private ExoPlayer  exoPlayer;
    private PlayerView playerView;
    private boolean    usedFallback      = false;
    private boolean    usedAudioDisabled = false;
    private boolean    finishCalled         = false;
    private boolean    videoEndedNaturally  = false;
    private boolean    disableResumeSave    = false;
    private String     currentUrl;
    private String     fallbackUrl;
    private long       startPositionMs   = 0;
    private long       movieId           = 0;
    private String     videoTitle        = "";
    private int        seekAttempts      = 0;

    private static final long SEEK_TOLERANCE_MS = 5000L;
    private static final int  MAX_SEEK_ATTEMPTS = 5;

    private View                controlsOverlay;
    private View                bufferingContainer;
    private CircularBufferView  circularBufferView;
    private ImageButton backBtn;
    private ImageButton rewindBtn;
    private ImageButton playPauseBtn;
    private ImageButton forwardBtn;
    private ImageButton moreBtn;
    private SeekBar     seekBar;
    private TextView    currentTimeView;
    private TextView    totalTimeView;
    private boolean     controlsVisible = true;
    private boolean     isLive          = false;
    private LinearLayout seekRow;
    private LinearLayout btnRow;
    private View        btnDivider;

    private int         seekDirection   = 0;
    private long        seekAccumMs     = 0;
    private FrameLayout seekDisplayOverlay;
    private TextView    seekArrowView;
    private TextView    seekDeltaView;

    private String[]    playlistUrls;
    private String[]    playlistTitles;
    private int         playlistCurrentIndex = 0;
    private FrameLayout nextUpOverlay;
    private TextView    nextUpCountdownView;
    private TextView    nextUpTitleView;
    private boolean     nextUpShowing = false;
    private int         nextUpSecondsLeft = 10;

    private long[]       mltMovieIds;
    private String[]     mltMovieNames;
    private String[]     mltMovieLogos;
    private int                      mltFocusIdx  = 0;
    private boolean                  mltShowing   = false;
    private LinearLayout             mltCardRow;
    private View[]                   mltCardViews;
    private android.widget.ScrollView mltScrollView;
    private FrameLayout  mltOverlay;

    private final Runnable nextUpCountdownRunnable = new Runnable() {
        @Override
        public void run() {
            nextUpSecondsLeft--;
            if (nextUpCountdownView != null) {
                nextUpCountdownView.setText("Next Up in " + nextUpSecondsLeft + "s");
            }
            if (nextUpSecondsLeft <= 0) {
                playNextItem();
            } else {
                uiHandler.postDelayed(this, 1000);
            }
        }
    };

    private Focus currentFocus = Focus.PLAY_PAUSE;

    private final Handler uiHandler = new Handler(Looper.getMainLooper());

    private final Runnable hideControlsRunnable = () -> {
        Log.d(TAG, "hideControlsRunnable: auto-hiding controls");
        controlsVisible = false;
        controlsOverlay.animate().alpha(0f).setDuration(300).start();
    };

    private final Runnable resetSeekDisplayRunnable = () -> {
        seekDirection = 0;
        seekAccumMs   = 0;
        if (seekDisplayOverlay != null) seekDisplayOverlay.setVisibility(View.GONE);
    };

    private final Runnable progressUpdater = new Runnable() {
        @Override
        public void run() {
            updateProgress();
            uiHandler.postDelayed(this, 500);
        }
    };

    private final Player.Listener playerListener = new Player.Listener() {
        @Override
        public void onPlaybackStateChanged(int state) {
            String stateName = state == Player.STATE_IDLE ? "IDLE"
                    : state == Player.STATE_BUFFERING ? "BUFFERING"
                    : state == Player.STATE_READY ? "READY"
                    : state == Player.STATE_ENDED ? "ENDED" : "UNKNOWN(" + state + ")";
            long currentPos = exoPlayer != null ? exoPlayer.getCurrentPosition() : -1;
            Log.d(TAG, "onPlaybackStateChanged: " + stateName
                    + " | pos=" + currentPos + "ms"
                    + " | seekAttempts=" + seekAttempts
                    + " | startPositionMs=" + startPositionMs);

            if (state == Player.STATE_READY) {
                if (startPositionMs > 0 && seekAttempts < MAX_SEEK_ATTEMPTS) {
                    long diff = Math.abs(currentPos - startPositionMs);
                    if (diff > SEEK_TOLERANCE_MS) {
                        seekAttempts++;
                        Log.d(TAG, "STATE_READY: pos=" + currentPos + " differs from target=" + startPositionMs
                                + " by " + diff + "ms — seek attempt #" + seekAttempts);
                        exoPlayer.seekTo(startPositionMs);
                        return;
                    }
                    Log.d(TAG, "STATE_READY: pos=" + currentPos + " within tolerance of target=" + startPositionMs + " — accepted");
                    startPositionMs = 0;
                }
                Log.d(TAG, "STATE_READY (final): showing playerView at pos=" + currentPos + "ms");
                playerView.setAlpha(1f);
                hideBuffering();
                if (playPauseBtn != null) {
                    playPauseBtn.setImageResource(exoPlayer.isPlaying() ? R.drawable.ic_pause : R.drawable.ic_play);
                }
                scheduleHideControls();
            } else if (state == Player.STATE_BUFFERING) {
                Log.d(TAG, "onPlaybackStateChanged: BUFFERING - showing buffering indicator");
                showBuffering();
            } else if (state == Player.STATE_ENDED) {
                Log.d(TAG, "onPlaybackStateChanged: ENDED - video finished");
                videoEndedNaturally = true;
                if (playlistUrls != null && playlistCurrentIndex < playlistUrls.length - 1) {
                    Log.d(TAG, "onPlaybackStateChanged: ENDED - auto-playing next index=" + (playlistCurrentIndex + 1));
                    clearResumePosition();
                    videoEndedNaturally = false;
                    playNextItem();
                } else {
                    Log.d(TAG, "onPlaybackStateChanged: ENDED - clearing resume and finishing");
                    clearResumePosition();
                    finish();
                }
            }
        }

        @Override
        public void onIsPlayingChanged(boolean isPlaying) {
            Log.d(TAG, "onIsPlayingChanged: isPlaying=" + isPlaying
                    + " | pos=" + (exoPlayer != null ? exoPlayer.getCurrentPosition() : -1) + "ms");
            if (playPauseBtn != null) {
                playPauseBtn.setImageResource(isPlaying ? R.drawable.ic_pause : R.drawable.ic_play);
            }
        }

        @Override
        public void onPlayerError(@NonNull PlaybackException error) {
            Log.e(TAG, "onPlayerError: " + error.getMessage()
                    + " | usedAudioDisabled=" + usedAudioDisabled
                    + " | pos=" + (exoPlayer != null ? exoPlayer.getCurrentPosition() : -1) + "ms");
            error.printStackTrace();
            if (!usedAudioDisabled) {
                usedAudioDisabled = true;
                Log.d(TAG, "onPlayerError: trying with audio disabled");
                buildAndBindPlayer(true);
                playUrl(currentUrl);
            } else {
                Log.d(TAG, "onPlayerError: audio already disabled, trying fallback or finish");
                tryFallbackOrFinish();
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d(TAG, "========== onCreate START ==========");
        Log.d(TAG, "Intent extras: url=" + getIntent().getStringExtra("url"));
        Log.d(TAG, "Intent extras: fallbackUrl=" + getIntent().getStringExtra("fallbackUrl"));
        Log.d(TAG, "Intent extras: startPositionMs=" + getIntent().getLongExtra("startPositionMs", 0L));
        Log.d(TAG, "Intent extras: title=" + getIntent().getStringExtra("title"));
        Log.d(TAG, "Intent extras: disableAudio=" + getIntent().getBooleanExtra("disableAudio", false));

        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN |
                        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );

        currentUrl        = getIntent().getStringExtra("url");
        fallbackUrl       = getIntent().getStringExtra("fallbackUrl");
        usedAudioDisabled = getIntent().getBooleanExtra("disableAudio", false);
        startPositionMs   = getIntent().getLongExtra("startPositionMs", 0L);
        movieId           = getIntent().getLongExtra("movieId", 0L);
        boolean forceFromBeginning = getIntent().getBooleanExtra("forceFromBeginning", false);
        isLive = getIntent().getBooleanExtra("isLive", false);
        disableResumeSave = getIntent().getBooleanExtra("disableResumeSave", false);
        String title = getIntent().getStringExtra("title");
        if (title == null) title = "";
        videoTitle = title;
        playlistCurrentIndex = getIntent().getIntExtra("playlistIndex", 0);
        String playlistJson = getIntent().getStringExtra("playlistJson");
        if (playlistJson != null && !playlistJson.isEmpty()) {
            try {
                JSONArray arr = new JSONArray(playlistJson);
                playlistUrls = new String[arr.length()];
                playlistTitles = new String[arr.length()];
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject obj = arr.getJSONObject(i);
                    playlistUrls[i] = obj.optString("url", "");
                    playlistTitles[i] = obj.optString("title", "");
                }
                Log.d(TAG, "onCreate: parsed playlist length=" + arr.length() + " currentIndex=" + playlistCurrentIndex);
            } catch (Exception e) {
                Log.e(TAG, "onCreate: failed to parse playlistJson: " + e.getMessage());
            }
        }

        String relatedJson = getIntent().getStringExtra("relatedJson");
        if (relatedJson != null && !relatedJson.isEmpty()) {
            try {
                JSONArray arr = new JSONArray(relatedJson);
                int count = arr.length();
                mltMovieIds   = new long[count];
                mltMovieNames = new String[count];
                mltMovieLogos = new String[count];
                for (int i = 0; i < count; i++) {
                    JSONObject obj = arr.getJSONObject(i);
                    mltMovieIds[i]   = obj.optLong("id", 0);
                    mltMovieNames[i] = obj.optString("name", "");
                    mltMovieLogos[i] = obj.optString("logo", "");
                }
                Log.d(TAG, "onCreate: parsed relatedJson count=" + count);
            } catch (Exception e) {
                Log.e(TAG, "onCreate: failed to parse relatedJson: " + e.getMessage());
            }
        }

        if (!forceFromBeginning && !disableResumeSave && startPositionMs == 0) {
            android.content.SharedPreferences prefs = getSharedPreferences("SaalaiTVResume", android.content.Context.MODE_PRIVATE);
            if (movieId > 0) {
                long savedMs = prefs.getLong("pos_" + movieId, 0);
                if (savedMs > 0) {
                    startPositionMs = savedMs;
                    Log.d(TAG, "onCreate: resume by movieId=" + movieId + " pos=" + startPositionMs);
                }
            }
            if (startPositionMs == 0 && !videoTitle.isEmpty()) {
                long savedMs = prefs.getLong("pos_title_" + videoTitle, 0);
                if (savedMs > 0) {
                    startPositionMs = savedMs;
                    Log.d(TAG, "onCreate: resume by title=" + videoTitle + " pos=" + startPositionMs);
                }
            }
        }

        Log.d(TAG, "onCreate: url=" + currentUrl + " | startPositionMs=" + startPositionMs + " | title=" + title);

        if (currentUrl == null || currentUrl.isEmpty()) {
            Log.e(TAG, "onCreate: URL is null or empty, finishing activity");
            finish();
            return;
        }

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        playerView = new PlayerView(this);
        playerView.setUseController(false);
        playerView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
        playerView.setOnClickListener(v -> {
            Log.d(TAG, "PlayerView clicked, toggling controls");
            toggleControls();
        });
        root.addView(playerView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        bufferingContainer = buildBufferingView();
        root.addView(bufferingContainer, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        controlsOverlay = buildControlsOverlay(title);
        root.addView(controlsOverlay, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        nextUpOverlay = buildNextUpOverlay();
        nextUpOverlay.setVisibility(View.GONE);
        root.addView(nextUpOverlay, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        seekDisplayOverlay = buildSeekDisplayOverlay();
        seekDisplayOverlay.setVisibility(View.GONE);
        root.addView(seekDisplayOverlay, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        mltOverlay = buildMltOverlay();
        mltOverlay.setVisibility(View.GONE);
        root.addView(mltOverlay, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        if (isLive) {
            if (seekRow != null) seekRow.setVisibility(View.GONE);
            if (rewindBtn != null) rewindBtn.setVisibility(View.GONE);
            if (forwardBtn != null) forwardBtn.setVisibility(View.GONE);
            if (btnDivider != null) btnDivider.setVisibility(View.GONE);
            if (backBtn != null) backBtn.setVisibility(View.GONE);
            if (btnRow != null) btnRow.setGravity(Gravity.CENTER);
        }

        setContentView(root);

        buildAndBindPlayer(usedAudioDisabled);

        updateFocusVisuals();
        uiHandler.postDelayed(progressUpdater, 500);
        scheduleHideControls();
        playUrl(currentUrl);

        Log.d(TAG, "========== onCreate END ==========");
    }

    private void buildAndBindPlayer(boolean disableAudio) {
        Log.d(TAG, "buildAndBindPlayer: disableAudio=" + disableAudio + " | seekAttempts reset to 0");
        seekAttempts = 0;
        if (exoPlayer != null) {
            Log.d(TAG, "buildAndBindPlayer: releasing existing player");
            exoPlayer.removeListener(playerListener);
            exoPlayer.release();
            exoPlayer = null;
        }
        DefaultRenderersFactory renderersFactory = new DefaultRenderersFactory(this)
                .setEnableDecoderFallback(true);
        ExoPlayer.Builder builder = new ExoPlayer.Builder(this, renderersFactory);
        if (disableAudio) {
            Log.d(TAG, "buildAndBindPlayer: disabling audio track");
            DefaultTrackSelector trackSelector = new DefaultTrackSelector(this);
            trackSelector.setParameters(trackSelector.buildUponParameters()
                    .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, true)
                    .build());
            builder = builder.setTrackSelector(trackSelector);
        }
        exoPlayer = builder.build();
        playerView.setPlayer(exoPlayer);
        exoPlayer.addListener(playerListener);
        Log.d(TAG, "buildAndBindPlayer: player created and set");
    }

    private void playUrl(String url) {
        Log.d(TAG, "playUrl: url=" + url + " | startPositionMs=" + startPositionMs + " | seekAttempts=" + seekAttempts);
        showBuffering();
        if (startPositionMs > 0) {
            playerView.setAlpha(0f);
            Log.d(TAG, "playUrl: playerView hidden (alpha=0) until seek completes");
        }
        MediaItem item = MediaItem.fromUri(Uri.parse(url));
        exoPlayer.setMediaItem(item);
        exoPlayer.prepare();
        exoPlayer.setPlayWhenReady(true);
        Log.d(TAG, "playUrl: player prepared and set to play");
    }

    private void tryFallbackOrFinish() {
        Log.d(TAG, "tryFallbackOrFinish: usedFallback=" + usedFallback + " | fallbackUrl=" + fallbackUrl);
        if (!usedFallback && fallbackUrl != null && !fallbackUrl.isEmpty()
                && !fallbackUrl.equals(currentUrl)) {
            usedFallback = true;
            currentUrl   = fallbackUrl;
            Log.d(TAG, "tryFallbackOrFinish: using fallback URL: " + currentUrl);
            playUrl(currentUrl);
        } else {
            Log.e(TAG, "tryFallbackOrFinish: no fallback available, finishing");
            finish();
        }
    }

    private void clearResumePosition() {
        android.content.SharedPreferences prefs = getSharedPreferences("SaalaiTVResume", android.content.Context.MODE_PRIVATE);
        android.content.SharedPreferences.Editor editor = prefs.edit();
        if (movieId > 0) {
            editor.remove("pos_" + movieId);
            Log.d(TAG, "clearResumePosition: cleared by movieId=" + movieId);
        }
        if (!videoTitle.isEmpty()) {
            editor.remove("pos_title_" + videoTitle);
            Log.d(TAG, "clearResumePosition: cleared by title=" + videoTitle);
        }
        editor.apply();
    }

    @Override
    public void finish() {
        if (finishCalled) {
            super.finish();
            return;
        }
        finishCalled = true;
        long positionMs = (exoPlayer != null) ? exoPlayer.getCurrentPosition() : 0;
        Log.d(TAG, "finish: positionMs=" + positionMs + " | movieId=" + movieId + " | seekAttempts=" + seekAttempts + " | startPositionMs=" + startPositionMs + " | videoEndedNaturally=" + videoEndedNaturally);
        VideoPlayerPlugin.lastVideoPositionMs = positionMs;
        if (positionMs > 0 && !videoEndedNaturally && !disableResumeSave) {
            long durationMs = (exoPlayer != null) ? exoPlayer.getDuration() : 0;
            if (durationMs < 0) durationMs = 0;
            android.content.SharedPreferences prefs = getSharedPreferences("SaalaiTVResume", android.content.Context.MODE_PRIVATE);
            android.content.SharedPreferences.Editor editor = prefs.edit();
            if (movieId > 0) {
                editor.putLong("pos_" + movieId, positionMs);
                if (durationMs > 0) editor.putLong("dur_" + movieId, durationMs);
                Log.d(TAG, "finish: saved positionMs=" + positionMs + " durationMs=" + durationMs + " by movieId=" + movieId);
            }
            if (!videoTitle.isEmpty()) {
                editor.putLong("pos_title_" + videoTitle, positionMs);
                Log.d(TAG, "finish: saved positionMs=" + positionMs + " by title=" + videoTitle);
            }
            editor.apply();
        } else if (videoEndedNaturally) {
            Log.d(TAG, "finish: skipped save because video ended naturally");
        } else if (disableResumeSave) {
            Log.d(TAG, "finish: skipped save because disableResumeSave=true");
        }
        android.content.Intent result = new android.content.Intent();
        result.putExtra("position_ms", positionMs);
        setResult(android.app.Activity.RESULT_OK, result);
        super.finish();
    }

    private View buildBufferingView() {
        Log.d(TAG, "buildBufferingView: creating buffering overlay");
        FrameLayout overlay = new FrameLayout(this);
        overlay.setBackgroundColor(0x8C000000);

        circularBufferView = new CircularBufferView(this);
        int size = dp(94);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(size, size);
        lp.gravity = Gravity.CENTER;
        overlay.addView(circularBufferView, lp);

        return overlay;
    }

    private class CircularBufferView extends View {
        private final Paint trackPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint arcPaint   = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint textPaint  = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF oval       = new RectF();
        private float rotationAngle    = 0f;
        private ValueAnimator animator;

        CircularBufferView(Context ctx) {
            super(ctx);
            Log.d(TAG, "CircularBufferView: constructor");
            trackPaint.setStyle(Paint.Style.STROKE);
            trackPaint.setColor(0xB2323232);
            trackPaint.setStrokeWidth(dp(9));

            arcPaint.setStyle(Paint.Style.STROKE);
            arcPaint.setColor(0xFFE50914);
            arcPaint.setStrokeWidth(dp(9));
            arcPaint.setStrokeCap(Paint.Cap.ROUND);

            textPaint.setColor(Color.WHITE);
            textPaint.setTextSize(sp(10));
            textPaint.setTextAlign(Paint.Align.CENTER);
            textPaint.setFakeBoldText(true);
            textPaint.setLetterSpacing(0.15f);

            animator = ValueAnimator.ofFloat(0f, 360f);
            animator.setDuration(1100);
            animator.setRepeatCount(ValueAnimator.INFINITE);
            animator.setRepeatMode(ValueAnimator.RESTART);
            animator.addUpdateListener(a -> {
                rotationAngle = (float) a.getAnimatedValue();
                invalidate();
            });
            animator.start();
        }

        @Override
        protected void onDetachedFromWindow() {
            super.onDetachedFromWindow();
            if (animator != null) {
                animator.cancel();
                Log.d(TAG, "CircularBufferView: animator cancelled");
            }
        }

        @Override
        protected void onDraw(Canvas canvas) {
            float cx     = getWidth()  / 2f;
            float cy     = getHeight() / 2f;
            float stroke = dp(12);
            float r      = cx - stroke / 2f - dp(2);
            oval.set(cx - r, cy - r, cx + r, cy + r);

            canvas.drawOval(oval, trackPaint);
            canvas.drawArc(oval, rotationAngle - 90f, 295f, false, arcPaint);

            float textY = cy - (textPaint.descent() + textPaint.ascent()) / 2f;
            canvas.drawText("LOADING", cx, textY, textPaint);
        }
    }

    private int sp(int val) {
        return Math.round(val * getResources().getDisplayMetrics().scaledDensity);
    }

    private void showBuffering() {
        Log.d(TAG, "showBuffering: showing buffering indicator");
        if (bufferingContainer != null) {
            bufferingContainer.setVisibility(View.VISIBLE);
        }
    }

    private void hideBuffering() {
        Log.d(TAG, "hideBuffering: hiding buffering indicator");
        if (bufferingContainer != null) {
            bufferingContainer.setVisibility(View.GONE);
        }
    }

    private View buildControlsOverlay(String title) {
        Log.d(TAG, "buildControlsOverlay: creating controls UI");
        FrameLayout overlay = new FrameLayout(this);

        // ── OUTER VERTICAL CONTAINER ─────────────────────────────
        LinearLayout outer = new LinearLayout(this);
        outer.setOrientation(LinearLayout.VERTICAL);
        outer.setPadding(dp(40), dp(16), dp(40), dp(14));
        GradientDrawable outerBg = new GradientDrawable();
        outerBg.setColor(0xC7000000);
        outerBg.setCornerRadii(new float[]{dp(24), dp(24), dp(24), dp(24), 0, 0, 0, 0});
        outer.setBackground(outerBg);

        // ── ROW 1: SEEKBAR ────────────────────────────────────────
        seekRow = new LinearLayout(this);
        seekRow.setOrientation(LinearLayout.HORIZONTAL);
        seekRow.setGravity(Gravity.CENTER_VERTICAL);

        currentTimeView = new TextView(this);
        currentTimeView.setText("0:00");
        currentTimeView.setTextColor(Color.WHITE);
        currentTimeView.setTextSize(14);
        currentTimeView.setLetterSpacing(0.04f);
        currentTimeView.setGravity(Gravity.CENTER_VERTICAL | Gravity.END);
        LinearLayout.LayoutParams curLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        curLp.gravity = Gravity.CENTER_VERTICAL;
        seekRow.addView(currentTimeView, curLp);

        View gap2 = new View(this);
        seekRow.addView(gap2, new LinearLayout.LayoutParams(dp(12), 1));

        seekBar = new SeekBar(this);
        seekBar.setMax(1000);
        seekBar.setPadding(0, 0, 0, 0);
        seekBar.setFocusable(false);
        seekBar.setFocusableInTouchMode(false);

        GradientDrawable bgDrawable = new GradientDrawable();
        bgDrawable.setShape(GradientDrawable.RECTANGLE);
        bgDrawable.setColor(0x38FFFFFF);
        bgDrawable.setCornerRadius(dp(9));

        GradientDrawable redDrawable = new GradientDrawable();
        redDrawable.setShape(GradientDrawable.RECTANGLE);
        redDrawable.setColor(0xFFE50914);
        redDrawable.setCornerRadius(dp(9));

        ClipDrawable progressClip = new ClipDrawable(redDrawable, Gravity.LEFT, ClipDrawable.HORIZONTAL);

        LayerDrawable layerDrawable = new LayerDrawable(new Drawable[]{bgDrawable, progressClip});
        layerDrawable.setId(0, android.R.id.background);
        layerDrawable.setId(1, android.R.id.progress);
        seekBar.setProgressDrawable(layerDrawable);

        GradientDrawable thumbDrawable = new GradientDrawable();
        thumbDrawable.setShape(GradientDrawable.OVAL);
        thumbDrawable.setColor(0xFFFFFFFF);
        thumbDrawable.setSize(dp(24), dp(24));
        seekBar.setThumb(thumbDrawable);
        seekBar.setThumbOffset(dp(12));
        seekBar.setElevation(dp(6));

        seekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar sb, int progress, boolean fromUser) {
                if (fromUser && exoPlayer != null) {
                    long dur = exoPlayer.getDuration();
                    long seekTo = (long) progress * dur / 1000;
                    Log.d(TAG, "SeekBar onProgressChanged: progress=" + progress + " seekTo=" + seekTo + "ms");
                    if (dur > 0) {
                        exoPlayer.seekTo(seekTo);
                    }
                    showControls();
                }
            }
            @Override
            public void onStartTrackingTouch(SeekBar sb) {
                Log.d(TAG, "SeekBar onStartTrackingTouch");
            }
            @Override
            public void onStopTrackingTouch(SeekBar sb) {
                Log.d(TAG, "SeekBar onStopTrackingTouch");
            }
        });
        LinearLayout.LayoutParams seekLp = new LinearLayout.LayoutParams(0, dp(40), 1f);
        seekLp.gravity = Gravity.CENTER_VERTICAL;
        seekRow.addView(seekBar, seekLp);

        View gap3 = new View(this);
        seekRow.addView(gap3, new LinearLayout.LayoutParams(dp(12), 1));

        totalTimeView = new TextView(this);
        totalTimeView.setText("0:00");
        totalTimeView.setTextColor(0x99FFFFFF);
        totalTimeView.setTextSize(14);
        totalTimeView.setLetterSpacing(0.04f);
        totalTimeView.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams totLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        totLp.gravity = Gravity.CENTER_VERTICAL;
        seekRow.addView(totalTimeView, totLp);

        outer.addView(seekRow, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        View rowGap = new View(this);
        outer.addView(rowGap, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(8)));

        // ── ROW 2: BUTTONS ────────────────────────────────────────
        btnRow = new LinearLayout(this);
        btnRow.setOrientation(LinearLayout.HORIZONTAL);
        btnRow.setGravity(Gravity.CENTER_VERTICAL);

        backBtn = makeIconBtn(R.drawable.ic_back);
        backBtn.setOnClickListener(v -> {
            Log.d(TAG, "Back button clicked");
            finish();
        });
        LinearLayout.LayoutParams backLp = new LinearLayout.LayoutParams(dp(44), dp(44));
        backLp.gravity = Gravity.CENTER_VERTICAL;
        btnRow.addView(backBtn, backLp);

        btnDivider = new View(this);
        btnDivider.setBackgroundColor(0x26FFFFFF);
        LinearLayout.LayoutParams divLp = new LinearLayout.LayoutParams(dp(1), dp(28));
        divLp.leftMargin  = dp(8);
        divLp.rightMargin = dp(8);
        divLp.gravity = Gravity.CENTER_VERTICAL;
        btnRow.addView(btnDivider, divLp);

        rewindBtn = makeIconBtn(R.drawable.ic_rewind);
        rewindBtn.setOnClickListener(v -> {
            Log.d(TAG, "Rewind button clicked");
            setFocusItem(Focus.REWIND);
            doSeek(-1, 0);
            showControls();
        });
        LinearLayout.LayoutParams rewindLp = new LinearLayout.LayoutParams(dp(44), dp(44));
        rewindLp.gravity = Gravity.CENTER_VERTICAL;
        btnRow.addView(rewindBtn, rewindLp);

        playPauseBtn = makeIconBtn(R.drawable.ic_play);
        playPauseBtn.setOnClickListener(v -> {
            Log.d(TAG, "Play/Pause button clicked");
            setFocusItem(Focus.PLAY_PAUSE);
            togglePlayPause();
            showControls();
        });
        LinearLayout.LayoutParams ppLp = new LinearLayout.LayoutParams(dp(44), dp(44));
        ppLp.leftMargin = dp(8);
        ppLp.gravity    = Gravity.CENTER_VERTICAL;
        btnRow.addView(playPauseBtn, ppLp);

        forwardBtn = makeIconBtn(R.drawable.ic_forward);
        forwardBtn.setOnClickListener(v -> {
            Log.d(TAG, "Forward button clicked");
            setFocusItem(Focus.FORWARD);
            doSeek(1, 0);
            showControls();
        });
        LinearLayout.LayoutParams fwdLp = new LinearLayout.LayoutParams(dp(44), dp(44));
        fwdLp.leftMargin = dp(8);
        fwdLp.gravity    = Gravity.CENTER_VERTICAL;
        btnRow.addView(forwardBtn, fwdLp);

        if (mltMovieIds != null && mltMovieIds.length > 0 && !isLive) {
            moreBtn = makeIconBtn(R.drawable.ic_more);
            moreBtn.setOnClickListener(v -> {
                Log.d(TAG, "More button clicked");
                setFocusItem(Focus.MORE);
                showMlt();
            });
            LinearLayout.LayoutParams moreLp = new LinearLayout.LayoutParams(dp(44), dp(44));
            moreLp.leftMargin = dp(8);
            moreLp.gravity    = Gravity.CENTER_VERTICAL;
            btnRow.addView(moreBtn, moreLp);
        }

        outer.addView(btnRow, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        FrameLayout.LayoutParams outerParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
        );
        outerParams.gravity = Gravity.BOTTOM;
        overlay.addView(outer, outerParams);

        return overlay;
    }

    private void setFocusItem(Focus f) {
        Log.d(TAG, "setFocusItem: " + currentFocus + " -> " + f);
        currentFocus = f;
        updateFocusVisuals();
    }

    private void updateFocusVisuals() {
        applyBtnFocus(backBtn,      currentFocus == Focus.BACK);
        applyBtnFocus(rewindBtn,    currentFocus == Focus.REWIND);
        applyBtnFocus(playPauseBtn, currentFocus == Focus.PLAY_PAUSE);
        applyBtnFocus(forwardBtn,   currentFocus == Focus.FORWARD);
        applyBtnFocus(moreBtn,      currentFocus == Focus.MORE);
        applySeekBarFocus(currentFocus == Focus.SEEKBAR);
    }

    private void applySeekBarFocus(boolean focused) {
        if (seekBar == null) {
            Log.w(TAG, "applySeekBarFocus: seekBar is null");
            return;
        }
        Drawable thumb = seekBar.getThumb();
        if (thumb == null) {
            Log.w(TAG, "applySeekBarFocus: thumb is null");
            return;
        }

        int size = focused ? dp(30) : dp(24);
        if (thumb instanceof GradientDrawable) {
            GradientDrawable gradientThumb = (GradientDrawable) thumb;
            gradientThumb.setSize(size, size);
            gradientThumb.setColor(focused ? 0xFFE50914 : 0xFFFFFFFF);
            seekBar.setThumbOffset(size / 2);
            Log.d(TAG, "applySeekBarFocus: focused=" + focused + " size=" + size);
        } else {
            Log.w(TAG, "applySeekBarFocus: thumb is not GradientDrawable, type=" + thumb.getClass().getSimpleName());
        }
    }

    private void applyBtnFocus(ImageButton btn, boolean focused) {
        if (btn == null) {
            Log.w(TAG, "applyBtnFocus: button is null");
            return;
        }
        if (focused) {
            btn.setColorFilter(0xFFE50914, PorterDuff.Mode.SRC_IN);
            btn.setAlpha(1.0f);
            btn.setScaleX(1.3f);
            btn.setScaleY(1.3f);
            Log.d(TAG, "applyBtnFocus: " + btn + " focused");
        } else {
            btn.clearColorFilter();
            btn.setAlpha(0.75f);
            btn.setScaleX(1f);
            btn.setScaleY(1f);
        }
    }

    private ImageButton makeIconBtn(int iconResId) {
        ImageButton btn = new ImageButton(this);
        btn.setImageResource(iconResId);
        btn.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        int pad = dp(8);
        btn.setPadding(pad, pad, pad, pad);
        btn.setBackground(null);
        btn.setClickable(true);
        btn.setFocusable(false);
        btn.setFocusableInTouchMode(false);
        btn.setAlpha(0.75f);
        return btn;
    }

    private int dp(int val) {
        return Math.round(val * getResources().getDisplayMetrics().density);
    }

    private void showControls() {
        Log.d(TAG, "showControls: showing controls");
        controlsVisible = true;
        uiHandler.removeCallbacks(hideControlsRunnable);
        controlsOverlay.animate().alpha(1f).setDuration(200).start();
        scheduleHideControls();
    }

    private void toggleControls() {
        if (controlsVisible) {
            uiHandler.removeCallbacks(hideControlsRunnable);
            controlsVisible = false;
            controlsOverlay.animate().alpha(0f).setDuration(300).start();
            Log.d(TAG, "toggleControls: controls hidden");
        } else {
            showControls();
        }
    }

    private void scheduleHideControls() {
        uiHandler.removeCallbacks(hideControlsRunnable);
        if (mltShowing) return;
        if (exoPlayer != null && exoPlayer.isPlaying()) {
            uiHandler.postDelayed(hideControlsRunnable, HIDE_DELAY_MS);
            Log.d(TAG, "scheduleHideControls: scheduled to hide in " + HIDE_DELAY_MS + "ms");
        } else {
            Log.d(TAG, "scheduleHideControls: player not playing, not scheduling hide");
        }
    }

    private void togglePlayPause() {
        if (exoPlayer == null) {
            Log.w(TAG, "togglePlayPause: exoPlayer is null");
            return;
        }
        if (exoPlayer.isPlaying()) {
            Log.d(TAG, "togglePlayPause: pausing at position=" + exoPlayer.getCurrentPosition() + "ms");
            exoPlayer.pause();
            if (playPauseBtn != null) {
                playPauseBtn.setImageResource(R.drawable.ic_play);
            }
            uiHandler.removeCallbacks(hideControlsRunnable);
        } else {
            Log.d(TAG, "togglePlayPause: resuming at position=" + exoPlayer.getCurrentPosition() + "ms");
            exoPlayer.play();
            if (playPauseBtn != null) {
                playPauseBtn.setImageResource(R.drawable.ic_pause);
            }
            scheduleHideControls();
        }
    }

    private void seek(int deltaMs) {
        if (exoPlayer == null) {
            Log.w(TAG, "seek: exoPlayer is null");
            return;
        }
        long oldPos = exoPlayer.getCurrentPosition();
        long pos = Math.max(0, oldPos + deltaMs);
        long dur = exoPlayer.getDuration();
        if (dur > 0) {
            pos = Math.min(pos, dur);
        }
        exoPlayer.seekTo(pos);
        Log.d(TAG, "seek: " + oldPos + "ms -> " + pos + "ms (delta=" + deltaMs + "ms)");
    }

    private FrameLayout buildMltOverlay() {
        android.util.DisplayMetrics dm = new android.util.DisplayMetrics();
        getWindowManager().getDefaultDisplay().getMetrics(dm);
        int panelWidth = (int) (dm.widthPixels * 0.30f);

        FrameLayout overlay = new FrameLayout(this);

        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setBackgroundColor(0xF0121212);
        panel.setPadding(dp(16), dp(20), dp(16), dp(20));

        TextView label = new TextView(this);
        label.setText("MORE LIKE THIS");
        label.setTextColor(0x8CFFFFFF);
        label.setTextSize(11);
        label.setTypeface(null, android.graphics.Typeface.BOLD);
        label.setLetterSpacing(0.15f);
        LinearLayout.LayoutParams lblLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lblLp.bottomMargin = dp(14);
        panel.addView(label, lblLp);

        mltCardRow = new LinearLayout(this);
        mltCardRow.setOrientation(LinearLayout.VERTICAL);

        int count = mltMovieIds != null ? mltMovieIds.length : 0;
        mltCardViews = new View[count];

        int cardGap = dp(8);
        int rows = (count + 1) / 2;

        for (int row = 0; row < rows; row++) {
            LinearLayout rowLayout = new LinearLayout(this);
            rowLayout.setOrientation(LinearLayout.HORIZONTAL);

            for (int col = 0; col < 2; col++) {
                int i = row * 2 + col;
                LinearLayout.LayoutParams colLp = new LinearLayout.LayoutParams(0,
                        LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
                if (col == 0) colLp.rightMargin = cardGap / 2;
                else colLp.leftMargin = cardGap / 2;

                if (i >= count) {
                    android.view.View spacer = new android.view.View(this);
                    rowLayout.addView(spacer, colLp);
                    continue;
                }

                FrameLayout card = new FrameLayout(this);
                card.setClipToOutline(true);

                GradientDrawable cardBg = new GradientDrawable();
                cardBg.setColor(0xFF1A1A1A);
                cardBg.setCornerRadius(dp(8));
                card.setBackground(cardBg);

                ImageView img = new ImageView(this);
                img.setScaleType(ImageView.ScaleType.CENTER_CROP);
                int cardH = (int) (panelWidth / 2 * 1.5f);
                card.addView(img, new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT, cardH));

                TextView nameTv = new TextView(this);
                nameTv.setText(mltMovieNames[i]);
                nameTv.setTextColor(Color.WHITE);
                nameTv.setTextSize(9);
                nameTv.setTypeface(null, android.graphics.Typeface.BOLD);
                nameTv.setGravity(Gravity.CENTER_HORIZONTAL);
                nameTv.setMaxLines(2);
                nameTv.setEllipsize(android.text.TextUtils.TruncateAt.END);
                nameTv.setPadding(dp(4), dp(16), dp(4), dp(6));
                GradientDrawable nameGrad = new GradientDrawable(
                        GradientDrawable.Orientation.BOTTOM_TOP,
                        new int[]{0xEE000000, 0x00000000}
                );
                nameTv.setBackground(nameGrad);
                FrameLayout.LayoutParams nameLp = new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT);
                nameLp.gravity = Gravity.BOTTOM;
                card.addView(nameTv, nameLp);

                rowLayout.addView(card, colLp);
                mltCardViews[i] = card;

                final String logoUrl = mltMovieLogos[i];
                final ImageView imgFinal = img;
                if (logoUrl != null && !logoUrl.isEmpty()) {
                    new Thread(() -> {
                        try {
                            java.io.InputStream is = new java.net.URL(logoUrl).openStream();
                            android.graphics.Bitmap bm = android.graphics.BitmapFactory.decodeStream(is);
                            is.close();
                            if (bm != null) uiHandler.post(() -> imgFinal.setImageBitmap(bm));
                        } catch (Exception ignored) {}
                    }).start();
                }
            }

            LinearLayout.LayoutParams rowLp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            if (row < rows - 1) rowLp.bottomMargin = cardGap;
            mltCardRow.addView(rowLayout, rowLp);
        }

        mltScrollView = new android.widget.ScrollView(this);
        mltScrollView.setVerticalScrollBarEnabled(false);
        mltScrollView.addView(mltCardRow, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        panel.addView(mltScrollView, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        FrameLayout.LayoutParams panelLp = new FrameLayout.LayoutParams(panelWidth,
                FrameLayout.LayoutParams.MATCH_PARENT);
        panelLp.gravity = Gravity.END;
        overlay.addView(panel, panelLp);

        return overlay;
    }

    private void updateMltFocusVisuals() {
        if (mltCardViews == null) return;
        for (int i = 0; i < mltCardViews.length; i++) {
            if (mltCardViews[i] == null) continue;
            if (i == mltFocusIdx) {
                GradientDrawable border = new GradientDrawable();
                border.setColor(0x00000000);
                border.setCornerRadius(dp(8));
                border.setStroke(dp(3), 0xFFE50914);
                mltCardViews[i].setForeground(border);
            } else {
                mltCardViews[i].setForeground(null);
            }
        }
        if (mltScrollView != null && mltFocusIdx < mltCardViews.length && mltCardViews[mltFocusIdx] != null) {
            final View focusedCard = mltCardViews[mltFocusIdx];
            focusedCard.post(() -> {
                android.view.ViewParent vp = focusedCard.getParent();
                if (vp instanceof View) {
                    int rowTop = ((View) vp).getTop();
                    int rowBottom = rowTop + ((View) vp).getHeight();
                    mltScrollView.smoothScrollTo(0, Math.max(0, rowBottom - mltScrollView.getHeight()));
                }
            });
        }
    }

    private void showMlt() {
        mltShowing  = true;
        mltFocusIdx = 0;
        uiHandler.removeCallbacks(hideControlsRunnable);
        controlsVisible = true;
        if (controlsOverlay != null) controlsOverlay.animate().alpha(1f).setDuration(200).start();
        if (mltOverlay != null) mltOverlay.setVisibility(View.VISIBLE);
        android.util.DisplayMetrics dm = new android.util.DisplayMetrics();
        getWindowManager().getDefaultDisplay().getMetrics(dm);
        int panelWidth = (int) (dm.widthPixels * 0.30f);
        if (playerView != null) {
            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) playerView.getLayoutParams();
            lp.rightMargin = panelWidth;
            playerView.setLayoutParams(lp);
        }
        if (controlsOverlay != null) {
            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) controlsOverlay.getLayoutParams();
            lp.rightMargin = panelWidth;
            controlsOverlay.setLayoutParams(lp);
        }
        updateMltFocusVisuals();
    }

    private void hideMlt() {
        mltShowing = false;
        if (mltOverlay != null) mltOverlay.setVisibility(View.GONE);
        if (playerView != null) {
            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) playerView.getLayoutParams();
            lp.rightMargin = 0;
            playerView.setLayoutParams(lp);
        }
        if (controlsOverlay != null) {
            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) controlsOverlay.getLayoutParams();
            lp.rightMargin = 0;
            controlsOverlay.setLayoutParams(lp);
        }
        scheduleHideControls();
    }

    private FrameLayout buildSeekDisplayOverlay() {
        FrameLayout overlay = new FrameLayout(this);

        LinearLayout inner = new LinearLayout(this);
        inner.setOrientation(LinearLayout.VERTICAL);
        inner.setGravity(Gravity.CENTER);
        inner.setPadding(dp(28), dp(14), dp(28), dp(14));

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xB3000000);
        bg.setCornerRadius(dp(14));
        inner.setBackground(bg);

        seekDeltaView = new TextView(this);
        seekDeltaView.setTextColor(Color.WHITE);
        seekDeltaView.setTextSize(22f);
        seekDeltaView.setTypeface(null, android.graphics.Typeface.BOLD);
        seekDeltaView.setGravity(Gravity.CENTER);
        inner.addView(seekDeltaView);

        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
        );
        lp.gravity = Gravity.CENTER;
        overlay.addView(inner, lp);
        return overlay;
    }

    private void doSeek(int direction, int repeatCount) {
        if (seekDirection != direction) {
            seekDirection = direction;
            seekAccumMs   = 0;
        }
        long step;
        if (repeatCount <= 5)       step = 10_000L;
        else if (repeatCount <= 15) step = 30_000L;
        else                        step = 60_000L;
        long delta = direction * step;
        seekAccumMs += delta;
        seek((int) delta);
        showSeekDisplay();
        uiHandler.removeCallbacks(resetSeekDisplayRunnable);
        uiHandler.postDelayed(resetSeekDisplayRunnable, 1200);
    }

    private void showSeekDisplay() {
        if (seekDisplayOverlay == null) return;
        if (seekDeltaView != null) seekDeltaView.setText(formatSeekDelta(seekAccumMs));
        seekDisplayOverlay.setVisibility(View.VISIBLE);
    }

    private String formatSeekDelta(long ms) {
        String sign = ms >= 0 ? "+" : "-";
        long totalSec = Math.round(Math.abs(ms) / 1000.0);
        long m = totalSec / 60;
        long s = totalSec % 60;
        if (m > 0) return String.format(Locale.US, "%s%d:%02d", sign, m, s);
        return String.format(Locale.US, "%s%ds", sign, s);
    }

    private void updateProgress() {
        if (exoPlayer == null) {
            return;
        }
        long pos = exoPlayer.getCurrentPosition();
        long dur = exoPlayer.getDuration();
        if (dur > 0 && seekBar != null) {
            seekBar.setMax(1000);
            seekBar.setProgress((int) (pos * 1000 / dur));
        }
        if (currentTimeView != null) {
            currentTimeView.setText(formatTime(pos));
        }
        if (totalTimeView != null) {
            totalTimeView.setText(formatTime(Math.max(0, dur)));
        }
        if (playPauseBtn != null) {
            playPauseBtn.setImageResource(exoPlayer.isPlaying() ? R.drawable.ic_pause : R.drawable.ic_play);
        }
    }

    private String formatTime(long ms) {
        long totalSec = ms / 1000;
        long h = totalSec / 3600;
        long m = (totalSec % 3600) / 60;
        long s = totalSec % 60;
        if (h > 0) {
            return String.format(Locale.US, "%d:%02d:%02d", h, m, s);
        }
        return String.format(Locale.US, "%d:%02d", m, s);
    }

    @Override
    protected void onPause() {
        super.onPause();
        Log.d(TAG, "onPause: pausing player at position=" + (exoPlayer != null ? exoPlayer.getCurrentPosition() : -1) + "ms");
        if (exoPlayer != null) {
            exoPlayer.pause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        Log.d(TAG, "onResume: resuming player");
        if (exoPlayer != null) {
            exoPlayer.play();
        }
    }

    private FrameLayout buildNextUpOverlay() {
        FrameLayout overlay = new FrameLayout(this);
        overlay.setBackgroundColor(0x99000000);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(0xF0141414);
        cardBg.setCornerRadius(dp(16));
        card.setBackground(cardBg);
        card.setPadding(dp(24), dp(20), dp(24), dp(20));

        nextUpCountdownView = new TextView(this);
        nextUpCountdownView.setText("Next Up in 10s");
        nextUpCountdownView.setTextColor(0x8DFFFFFF);
        nextUpCountdownView.setTextSize(11);
        nextUpCountdownView.setLetterSpacing(0.15f);
        card.addView(nextUpCountdownView);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams rowLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        rowLp.topMargin = dp(12);
        row.setLayoutParams(rowLp);

        nextUpTitleView = new TextView(this);
        nextUpTitleView.setTextColor(Color.WHITE);
        nextUpTitleView.setTextSize(16);
        nextUpTitleView.setMaxLines(2);
        nextUpTitleView.setEllipsize(android.text.TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        nextUpTitleView.setLayoutParams(titleLp);
        row.addView(nextUpTitleView);
        card.addView(row);

        LinearLayout btnRow2 = new LinearLayout(this);
        btnRow2.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams btnRowLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        btnRowLp.topMargin = dp(16);
        btnRow2.setLayoutParams(btnRowLp);

        android.widget.Button playNowBtn = new android.widget.Button(this);
        playNowBtn.setText("Play Now");
        playNowBtn.setTextColor(Color.WHITE);
        GradientDrawable playBg = new GradientDrawable();
        playBg.setColor(0xFFE50914);
        playBg.setCornerRadius(dp(8));
        playNowBtn.setBackground(playBg);
        LinearLayout.LayoutParams playLp = new LinearLayout.LayoutParams(0, dp(44), 1f);
        playLp.rightMargin = dp(8);
        playNowBtn.setLayoutParams(playLp);
        playNowBtn.setOnClickListener(v -> playNextItem());
        btnRow2.addView(playNowBtn);

        android.widget.Button cancelBtn = new android.widget.Button(this);
        cancelBtn.setText("Cancel");
        cancelBtn.setTextColor(Color.WHITE);
        GradientDrawable cancelBg = new GradientDrawable();
        cancelBg.setColor(0x33FFFFFF);
        cancelBg.setCornerRadius(dp(8));
        cancelBtn.setBackground(cancelBg);
        LinearLayout.LayoutParams cancelLp = new LinearLayout.LayoutParams(0, dp(44), 1f);
        cancelBtn.setLayoutParams(cancelLp);
        cancelBtn.setOnClickListener(v -> { dismissNextUpOverlay(); finish(); });
        btnRow2.addView(cancelBtn);

        card.addView(btnRow2);

        int cardWidth = dp(340);
        FrameLayout.LayoutParams cardLp = new FrameLayout.LayoutParams(cardWidth, FrameLayout.LayoutParams.WRAP_CONTENT);
        cardLp.gravity = Gravity.BOTTOM | Gravity.END;
        cardLp.bottomMargin = dp(80);
        cardLp.rightMargin = dp(60);
        overlay.addView(card, cardLp);

        return overlay;
    }

    private void showNextUpOverlay(String nextTitle) {
        uiHandler.removeCallbacks(hideControlsRunnable);
        controlsOverlay.animate().alpha(0f).setDuration(200).start();
        controlsVisible = false;
        if (nextUpTitleView != null) nextUpTitleView.setText(nextTitle);
        nextUpSecondsLeft = 10;
        if (nextUpCountdownView != null) nextUpCountdownView.setText("Next Up in 10s");
        nextUpShowing = true;
        nextUpOverlay.setVisibility(View.VISIBLE);
        uiHandler.removeCallbacks(nextUpCountdownRunnable);
        uiHandler.postDelayed(nextUpCountdownRunnable, 1000);
    }

    private void dismissNextUpOverlay() {
        uiHandler.removeCallbacks(nextUpCountdownRunnable);
        nextUpShowing = false;
        nextUpOverlay.setVisibility(View.GONE);
    }

    private void playNextItem() {
        dismissNextUpOverlay();
        playlistCurrentIndex++;
        if (playlistUrls == null || playlistCurrentIndex >= playlistUrls.length) {
            finish();
            return;
        }
        currentUrl = playlistUrls[playlistCurrentIndex];
        videoTitle = playlistTitles != null && playlistCurrentIndex < playlistTitles.length
                ? playlistTitles[playlistCurrentIndex] : "";
        movieId = 0;
        startPositionMs = 0;
        if (!videoTitle.isEmpty()) {
            android.content.SharedPreferences prefs = getSharedPreferences("SaalaiTVResume", android.content.Context.MODE_PRIVATE);
            long savedMs = prefs.getLong("pos_title_" + videoTitle, 0);
            if (savedMs > 0) {
                startPositionMs = savedMs;
                Log.d(TAG, "playNextItem: resuming at " + savedMs + "ms for title=" + videoTitle);
            }
        }
        usedFallback = false;
        usedAudioDisabled = false;
        seekAttempts = 0;
        finishCalled = false;
        videoEndedNaturally = false;
        Log.d(TAG, "playNextItem: playing index=" + playlistCurrentIndex + " url=" + currentUrl);
        buildAndBindPlayer(false);
        playUrl(currentUrl);
        playerView.setAlpha(1f);
        showControls();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "onDestroy: cleaning up");
        uiHandler.removeCallbacksAndMessages(null);
        if (exoPlayer != null) {
            exoPlayer.removeListener(playerListener);
            exoPlayer.release();
            exoPlayer = null;
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int keyCode = event.getKeyCode();
        if (event.getAction() == KeyEvent.ACTION_UP) {
            if (!isLive && seekDirection != 0 && (
                    keyCode == KeyEvent.KEYCODE_DPAD_LEFT  ||
                    keyCode == KeyEvent.KEYCODE_DPAD_RIGHT ||
                    keyCode == KeyEvent.KEYCODE_MEDIA_REWIND ||
                    keyCode == KeyEvent.KEYCODE_MEDIA_FAST_FORWARD ||
                    keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
                    keyCode == KeyEvent.KEYCODE_ENTER)) {
                uiHandler.removeCallbacks(resetSeekDisplayRunnable);
                uiHandler.postDelayed(resetSeekDisplayRunnable, 800);
            }
            return super.dispatchKeyEvent(event);
        }
        if (event.getAction() != KeyEvent.ACTION_DOWN) {
            return super.dispatchKeyEvent(event);
        }
        Log.d(TAG, "dispatchKeyEvent: keyCode=" + keyCode + " | currentFocus=" + currentFocus);

        if (mltShowing) {
            int mltCount = mltMovieIds != null ? mltMovieIds.length : 0;
            if (keyCode == KeyEvent.KEYCODE_BACK) {
                hideMlt();
                setFocusItem(moreBtn != null ? Focus.MORE : Focus.FORWARD);
                return true;
            }
            if (keyCode == KeyEvent.KEYCODE_DPAD_LEFT) {
                if (mltFocusIdx % 2 == 0) { hideMlt(); setFocusItem(moreBtn != null ? Focus.MORE : Focus.FORWARD); }
                else { mltFocusIdx--; updateMltFocusVisuals(); }
                return true;
            }
            if (keyCode == KeyEvent.KEYCODE_DPAD_RIGHT) {
                if (mltFocusIdx % 2 == 1) return true;
                if (mltFocusIdx + 1 < mltCount) { mltFocusIdx++; updateMltFocusVisuals(); }
                return true;
            }
            if (keyCode == KeyEvent.KEYCODE_DPAD_UP) {
                if (mltFocusIdx >= 2) { mltFocusIdx -= 2; updateMltFocusVisuals(); }
                return true;
            }
            if (keyCode == KeyEvent.KEYCODE_DPAD_DOWN) {
                if (mltFocusIdx + 2 < mltCount) { mltFocusIdx += 2; updateMltFocusVisuals(); }
                return true;
            }
            if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER) {
                if (mltCount > 0 && mltFocusIdx < mltCount) {
                    long selectedMovieId = mltMovieIds[mltFocusIdx];
                    long posMs = exoPlayer != null ? exoPlayer.getCurrentPosition() : 0;
                    if (posMs > 0 && !disableResumeSave) {
                        android.content.SharedPreferences prefs = getSharedPreferences("SaalaiTVResume", android.content.Context.MODE_PRIVATE);
                        android.content.SharedPreferences.Editor editor = prefs.edit();
                        if (movieId > 0) editor.putLong("pos_" + movieId, posMs);
                        if (!videoTitle.isEmpty()) editor.putLong("pos_title_" + videoTitle, posMs);
                        editor.apply();
                    }
                    VideoPlayerPlugin.lastVideoPositionMs = posMs;
                    android.content.Intent resultIntent = new android.content.Intent();
                    resultIntent.putExtra("position_ms", posMs);
                    resultIntent.putExtra("navigate_to_movie_id", selectedMovieId);
                    setResult(RESULT_OK, resultIntent);
                    finishCalled = true;
                    super.finish();
                }
                return true;
            }
            return true;
        }

        if (nextUpShowing) {
            if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER) {
                Log.d(TAG, "dispatchKeyEvent: OK during Next Up - playing next");
                playNextItem();
            } else if (keyCode == KeyEvent.KEYCODE_BACK) {
                Log.d(TAG, "dispatchKeyEvent: BACK during Next Up - dismissing and finishing");
                dismissNextUpOverlay();
                finish();
            }
            return true;
        }

        if (keyCode == KeyEvent.KEYCODE_BACK) {
            Log.d(TAG, "dispatchKeyEvent: BACK pressed, finishing");
            finish();
            return true;
        }

        if (!controlsVisible) {
            Log.d(TAG, "dispatchKeyEvent: controls hidden, showing controls");
            showControls();
            return true;
        }

        showControls();

        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_UP:
                Log.d(TAG, "dispatchKeyEvent: DPAD_UP");
                if (!isLive && currentFocus != Focus.SEEKBAR) {
                    setFocusItem(Focus.SEEKBAR);
                } else if (!isLive && currentFocus == Focus.SEEKBAR) {
                    Log.d(TAG, "dispatchKeyEvent: DPAD_UP with SEEKBAR focused, hiding controls");
                    uiHandler.removeCallbacks(hideControlsRunnable);
                    controlsVisible = false;
                    controlsOverlay.animate().alpha(0f).setDuration(300).start();
                }
                return true;

            case KeyEvent.KEYCODE_DPAD_DOWN:
                Log.d(TAG, "dispatchKeyEvent: DPAD_DOWN");
                if (!isLive && currentFocus == Focus.SEEKBAR) {
                    setFocusItem(Focus.PLAY_PAUSE);
                } else {
                    showControls();
                }
                return true;

            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_MEDIA_REWIND:
                Log.d(TAG, "dispatchKeyEvent: LEFT/REWIND");
                if (isLive) return true;
                if (currentFocus == Focus.SEEKBAR) {
                    doSeek(-1, event.getRepeatCount());
                } else {
                    switch (currentFocus) {
                        case REWIND:
                            setFocusItem(Focus.BACK);
                            break;
                        case PLAY_PAUSE:
                            setFocusItem(Focus.REWIND);
                            break;
                        case FORWARD:
                            setFocusItem(Focus.PLAY_PAUSE);
                            break;
                        case MORE:
                            setFocusItem(Focus.FORWARD);
                            break;
                        default:
                            break;
                    }
                }
                return true;

            case KeyEvent.KEYCODE_DPAD_RIGHT:
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                Log.d(TAG, "dispatchKeyEvent: RIGHT/FAST_FORWARD");
                if (isLive) return true;
                if (currentFocus == Focus.SEEKBAR) {
                    doSeek(1, event.getRepeatCount());
                } else {
                    switch (currentFocus) {
                        case BACK:
                            setFocusItem(Focus.REWIND);
                            break;
                        case REWIND:
                            setFocusItem(Focus.PLAY_PAUSE);
                            break;
                        case PLAY_PAUSE:
                            setFocusItem(Focus.FORWARD);
                            break;
                        case FORWARD:
                            if (moreBtn != null) setFocusItem(Focus.MORE);
                            break;
                        case MORE:
                            break;
                        default:
                            break;
                    }
                }
                return true;

            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
                Log.d(TAG, "dispatchKeyEvent: CENTER/ENTER on focus=" + currentFocus);
                switch (currentFocus) {
                    case BACK:
                        finish();
                        break;
                    case SEEKBAR:
                        togglePlayPause();
                        break;
                    case REWIND:
                        doSeek(-1, event.getRepeatCount());
                        break;
                    case PLAY_PAUSE:
                        togglePlayPause();
                        break;
                    case FORWARD:
                        doSeek(1, event.getRepeatCount());
                        break;
                    case MORE:
                        showMlt();
                        break;
                }
                return true;

            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                Log.d(TAG, "dispatchKeyEvent: MEDIA_PLAY_PAUSE");
                togglePlayPause();
                return true;

            case KeyEvent.KEYCODE_MEDIA_PLAY:
                Log.d(TAG, "dispatchKeyEvent: MEDIA_PLAY");
                if (exoPlayer != null && !exoPlayer.isPlaying()) {
                    exoPlayer.play();
                    if (playPauseBtn != null) {
                        playPauseBtn.setImageResource(R.drawable.ic_pause);
                    }
                    scheduleHideControls();
                }
                return true;

            case KeyEvent.KEYCODE_MEDIA_PAUSE:
                Log.d(TAG, "dispatchKeyEvent: MEDIA_PAUSE");
                if (exoPlayer != null && exoPlayer.isPlaying()) {
                    exoPlayer.pause();
                    if (playPauseBtn != null) {
                        playPauseBtn.setImageResource(R.drawable.ic_play);
                    }
                }
                return true;
        }

        return super.dispatchKeyEvent(event);
    }
}