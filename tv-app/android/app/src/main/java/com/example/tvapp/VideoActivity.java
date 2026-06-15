package com.example.tvapp;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.PorterDuff;
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
import android.widget.ProgressBar;
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

import java.util.Locale;

public class VideoActivity extends Activity {

    private static final String TAG           = "SaalaiPlayer";
    private static final int    HIDE_DELAY_MS = 5000;
    private static final int    SEEK_STEP_MS  = 10000;

    private enum Focus { BACK, SEEKBAR, REWIND, PLAY_PAUSE, FORWARD }

    private ExoPlayer  exoPlayer;
    private PlayerView playerView;
    private boolean    usedFallback      = false;
    private boolean    usedAudioDisabled = false;
    private String     currentUrl;
    private String     fallbackUrl;
    private long       startPositionMs   = 0;
    private int        seekAttempts      = 0;

    private static final long SEEK_TOLERANCE_MS = 5000L;
    private static final int  MAX_SEEK_ATTEMPTS = 5;

    private View        controlsOverlay;
    private View        bufferingContainer;
    private ImageButton backBtn;
    private ImageButton rewindBtn;
    private ImageButton playPauseBtn;
    private ImageButton forwardBtn;
    private SeekBar     seekBar;
    private TextView    currentTimeView;
    private TextView    totalTimeView;
    private boolean     controlsVisible = true;

    private Focus currentFocus = Focus.PLAY_PAUSE;

    private final Handler uiHandler = new Handler(Looper.getMainLooper());

    private final Runnable hideControlsRunnable = () -> {
        controlsVisible = false;
        controlsOverlay.animate().alpha(0f).setDuration(300).start();
    };

    private final Runnable progressUpdater = new Runnable() {
        @Override public void run() {
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
                }
                Log.d(TAG, "STATE_READY (final): showing playerView at pos=" + currentPos + "ms");
                playerView.setAlpha(1f);
                hideBuffering();
                if (playPauseBtn != null) {
                    playPauseBtn.setImageResource(exoPlayer.isPlaying() ? R.drawable.ic_pause : R.drawable.ic_play);
                }
                scheduleHideControls();
            } else if (state == Player.STATE_BUFFERING) {
                showBuffering();
            } else if (state == Player.STATE_ENDED) {
                finish();
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
            if (!usedAudioDisabled) {
                usedAudioDisabled = true;
                buildAndBindPlayer(true);
                playUrl(currentUrl);
            } else {
                tryFallbackOrFinish();
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

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
        String title = getIntent().getStringExtra("title");
        if (title == null) title = "";

        Log.d(TAG, "onCreate: url=" + currentUrl + " | startPositionMs=" + startPositionMs + " | title=" + title);

        if (currentUrl == null || currentUrl.isEmpty()) { finish(); return; }

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        playerView = new PlayerView(this);
        playerView.setUseController(false);
        playerView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
        playerView.setOnClickListener(v -> toggleControls());
        root.addView(playerView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        bufferingContainer = buildBufferingView();
        FrameLayout.LayoutParams bufParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        bufParams.gravity = Gravity.CENTER;
        root.addView(bufferingContainer, bufParams);

        controlsOverlay = buildControlsOverlay(title);
        root.addView(controlsOverlay, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        setContentView(root);

        buildAndBindPlayer(usedAudioDisabled);

        updateFocusVisuals();
        uiHandler.postDelayed(progressUpdater, 500);
        scheduleHideControls();
        playUrl(currentUrl);
    }

    private void buildAndBindPlayer(boolean disableAudio) {
        seekAttempts = 0;
        if (exoPlayer != null) {
            exoPlayer.removeListener(playerListener);
            exoPlayer.release();
            exoPlayer = null;
        }
        DefaultRenderersFactory renderersFactory = new DefaultRenderersFactory(this)
                .setEnableDecoderFallback(true);
        ExoPlayer.Builder builder = new ExoPlayer.Builder(this, renderersFactory);
        if (disableAudio) {
            DefaultTrackSelector trackSelector = new DefaultTrackSelector(this);
            trackSelector.setParameters(trackSelector.buildUponParameters()
                    .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, true)
                    .build());
            builder = builder.setTrackSelector(trackSelector);
        }
        exoPlayer = builder.build();
        playerView.setPlayer(exoPlayer);
        exoPlayer.addListener(playerListener);
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
    }

    private void tryFallbackOrFinish() {
        if (!usedFallback && fallbackUrl != null && !fallbackUrl.isEmpty()
                && !fallbackUrl.equals(currentUrl)) {
            usedFallback = true;
            currentUrl   = fallbackUrl;
            playUrl(currentUrl);
        } else {
            finish();
        }
    }

    @Override
    public void finish() {
        long positionMs = (exoPlayer != null) ? exoPlayer.getCurrentPosition() : 0;
        Log.d(TAG, "finish: positionMs=" + positionMs + " | seekAttempts=" + seekAttempts + " | startPositionMs=" + startPositionMs);
        android.content.Intent result = new android.content.Intent();
        result.putExtra("position_ms", positionMs);
        setResult(android.app.Activity.RESULT_OK, result);
        super.finish();
    }

    private View buildBufferingView() {
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setGravity(Gravity.CENTER);

        ProgressBar spinner = new ProgressBar(this, null, android.R.attr.progressBarStyleLarge);
        spinner.setIndeterminate(true);
        try {
            spinner.getIndeterminateDrawable().setColorFilter(0xFFE50914, PorterDuff.Mode.SRC_IN);
        } catch (Exception ignored) {}
        LinearLayout.LayoutParams spinnerLp = new LinearLayout.LayoutParams(dp(72), dp(72));
        spinnerLp.gravity = Gravity.CENTER_HORIZONTAL;
        container.addView(spinner, spinnerLp);

        TextView label = new TextView(this);
        label.setText("Buffering\u2026");
        label.setTextColor(0xB3FFFFFF);
        label.setTextSize(14);
        label.setLetterSpacing(0.08f);
        LinearLayout.LayoutParams lblLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        lblLp.topMargin  = dp(14);
        lblLp.gravity    = Gravity.CENTER_HORIZONTAL;
        container.addView(label, lblLp);

        return container;
    }

    private void showBuffering() {
        bufferingContainer.setVisibility(View.VISIBLE);
    }

    private void hideBuffering() {
        bufferingContainer.setVisibility(View.GONE);
    }

    private View buildControlsOverlay(String title) {
        FrameLayout overlay = new FrameLayout(this);

        // ── OUTER VERTICAL CONTAINER ─────────────────────────────
        LinearLayout outer = new LinearLayout(this);
        outer.setOrientation(LinearLayout.VERTICAL);
        outer.setPadding(dp(40), dp(12), dp(40), dp(14));
        outer.setBackgroundColor(0xC7000000);

        // ── ROW 1: SEEKBAR ────────────────────────────────────────
        LinearLayout seekRow = new LinearLayout(this);
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
                    if (dur > 0) exoPlayer.seekTo((long) progress * dur / 1000);
                    showControls();
                }
            }
            @Override public void onStartTrackingTouch(SeekBar sb) {}
            @Override public void onStopTrackingTouch(SeekBar sb) {}
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
        LinearLayout btnRow = new LinearLayout(this);
        btnRow.setOrientation(LinearLayout.HORIZONTAL);
        btnRow.setGravity(Gravity.CENTER_VERTICAL);

        backBtn = makeIconBtn(R.drawable.ic_back);
        backBtn.setOnClickListener(v -> finish());
        LinearLayout.LayoutParams backLp = new LinearLayout.LayoutParams(dp(44), dp(44));
        backLp.gravity = Gravity.CENTER_VERTICAL;
        btnRow.addView(backBtn, backLp);

        View divider = new View(this);
        divider.setBackgroundColor(0x26FFFFFF);
        LinearLayout.LayoutParams divLp = new LinearLayout.LayoutParams(dp(1), dp(28));
        divLp.leftMargin  = dp(8);
        divLp.rightMargin = dp(8);
        divLp.gravity = Gravity.CENTER_VERTICAL;
        btnRow.addView(divider, divLp);

        rewindBtn = makeIconBtn(R.drawable.ic_rewind);
        rewindBtn.setOnClickListener(v -> { setFocusItem(Focus.REWIND); seek(-SEEK_STEP_MS); showControls(); });
        LinearLayout.LayoutParams rewindLp = new LinearLayout.LayoutParams(dp(44), dp(44));
        rewindLp.gravity = Gravity.CENTER_VERTICAL;
        btnRow.addView(rewindBtn, rewindLp);

        playPauseBtn = makeIconBtn(R.drawable.ic_play);
        playPauseBtn.setOnClickListener(v -> { setFocusItem(Focus.PLAY_PAUSE); togglePlayPause(); showControls(); });
        LinearLayout.LayoutParams ppLp = new LinearLayout.LayoutParams(dp(44), dp(44));
        ppLp.leftMargin = dp(8);
        ppLp.gravity    = Gravity.CENTER_VERTICAL;
        btnRow.addView(playPauseBtn, ppLp);

        forwardBtn = makeIconBtn(R.drawable.ic_forward);
        forwardBtn.setOnClickListener(v -> { setFocusItem(Focus.FORWARD); seek(SEEK_STEP_MS); showControls(); });
        LinearLayout.LayoutParams fwdLp = new LinearLayout.LayoutParams(dp(44), dp(44));
        fwdLp.leftMargin = dp(8);
        fwdLp.gravity    = Gravity.CENTER_VERTICAL;
        btnRow.addView(forwardBtn, fwdLp);

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
        currentFocus = f;
        updateFocusVisuals();
    }

    private void updateFocusVisuals() {
        applyBtnFocus(backBtn,      currentFocus == Focus.BACK);
        applyBtnFocus(rewindBtn,    currentFocus == Focus.REWIND);
        applyBtnFocus(playPauseBtn, currentFocus == Focus.PLAY_PAUSE);
        applyBtnFocus(forwardBtn,   currentFocus == Focus.FORWARD);
        applySeekBarFocus(currentFocus == Focus.SEEKBAR);
    }

    private void applySeekBarFocus(boolean focused) {
        if (seekBar == null || seekBar.getThumb() == null) return;
        int size = focused ? dp(30) : dp(24);
        GradientDrawable thumb = (GradientDrawable) seekBar.getThumb();
        thumb.setSize(size, size);
        thumb.setColor(focused ? 0xFFE50914 : 0xFFFFFFFF);
        seekBar.setThumbOffset(size / 2);
    }

    private void applyBtnFocus(ImageButton btn, boolean focused) {
        if (btn == null) return;
        if (focused) {
            btn.setColorFilter(0xFFE50914, PorterDuff.Mode.SRC_IN);
            btn.setAlpha(1.0f);
            btn.setScaleX(1.3f);
            btn.setScaleY(1.3f);
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
        } else {
            showControls();
        }
    }

    private void scheduleHideControls() {
        uiHandler.removeCallbacks(hideControlsRunnable);
        if (exoPlayer != null && exoPlayer.isPlaying()) {
            uiHandler.postDelayed(hideControlsRunnable, HIDE_DELAY_MS);
        }
    }

    private void togglePlayPause() {
        if (exoPlayer == null) return;
        if (exoPlayer.isPlaying()) {
            exoPlayer.pause();
            playPauseBtn.setImageResource(R.drawable.ic_play);
            uiHandler.removeCallbacks(hideControlsRunnable);
        } else {
            exoPlayer.play();
            playPauseBtn.setImageResource(R.drawable.ic_pause);
            scheduleHideControls();
        }
    }

    private void seek(int deltaMs) {
        if (exoPlayer == null) return;
        long pos = Math.max(0, exoPlayer.getCurrentPosition() + deltaMs);
        long dur = exoPlayer.getDuration();
        if (dur > 0) pos = Math.min(pos, dur);
        exoPlayer.seekTo(pos);
    }

    private void updateProgress() {
        if (exoPlayer == null) return;
        long pos = exoPlayer.getCurrentPosition();
        long dur = exoPlayer.getDuration();
        if (dur > 0) {
            seekBar.setMax(1000);
            seekBar.setProgress((int) (pos * 1000 / dur));
        }
        if (currentTimeView != null) currentTimeView.setText(formatTime(pos));
        if (totalTimeView != null) totalTimeView.setText(formatTime(Math.max(0, dur)));
        playPauseBtn.setImageResource(exoPlayer.isPlaying() ? R.drawable.ic_pause : R.drawable.ic_play);
    }

    private String formatTime(long ms) {
        long totalSec = ms / 1000;
        long h = totalSec / 3600;
        long m = (totalSec % 3600) / 60;
        long s = totalSec % 60;
        if (h > 0) return String.format(Locale.US, "%d:%02d:%02d", h, m, s);
        return String.format(Locale.US, "%d:%02d", m, s);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (exoPlayer != null) exoPlayer.pause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (exoPlayer != null) exoPlayer.play();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        uiHandler.removeCallbacksAndMessages(null);
        if (exoPlayer != null) {
            exoPlayer.removeListener(playerListener);
            exoPlayer.release();
            exoPlayer = null;
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() != KeyEvent.ACTION_DOWN) return super.dispatchKeyEvent(event);
        int keyCode = event.getKeyCode();
        if (keyCode == KeyEvent.KEYCODE_BACK) { finish(); return true; }

        if (!controlsVisible) {
            showControls();
            return true;
        }

        showControls();

        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_UP:
                if (currentFocus != Focus.SEEKBAR) {
                    setFocusItem(Focus.SEEKBAR);
                } else {
                    uiHandler.removeCallbacks(hideControlsRunnable);
                    controlsVisible = false;
                    controlsOverlay.animate().alpha(0f).setDuration(300).start();
                }
                return true;

            case KeyEvent.KEYCODE_DPAD_DOWN:
                if (currentFocus == Focus.SEEKBAR) {
                    setFocusItem(Focus.PLAY_PAUSE);
                } else {
                    showControls();
                }
                return true;

            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_MEDIA_REWIND:
                if (currentFocus == Focus.SEEKBAR) { seek(-SEEK_STEP_MS); }
                else switch (currentFocus) {
                    case REWIND:     setFocusItem(Focus.BACK); break;
                    case PLAY_PAUSE: setFocusItem(Focus.REWIND); break;
                    case FORWARD:    setFocusItem(Focus.PLAY_PAUSE); break;
                    default: break;
                }
                return true;

            case KeyEvent.KEYCODE_DPAD_RIGHT:
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                if (currentFocus == Focus.SEEKBAR) { seek(SEEK_STEP_MS); }
                else switch (currentFocus) {
                    case BACK:       setFocusItem(Focus.REWIND); break;
                    case REWIND:     setFocusItem(Focus.PLAY_PAUSE); break;
                    case PLAY_PAUSE: setFocusItem(Focus.FORWARD); break;
                    case FORWARD:    break;
                    default: break;
                }
                return true;

            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
                switch (currentFocus) {
                    case BACK:       finish(); break;
                    case SEEKBAR:    togglePlayPause(); break;
                    case REWIND:     seek(-SEEK_STEP_MS); break;
                    case PLAY_PAUSE: togglePlayPause(); break;
                    case FORWARD:    seek(+SEEK_STEP_MS); break;
                }
                return true;

            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                togglePlayPause(); return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY:
                if (exoPlayer != null && !exoPlayer.isPlaying()) {
                    exoPlayer.play();
                    playPauseBtn.setImageResource(R.drawable.ic_pause);
                    scheduleHideControls();
                }
                return true;
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
                if (exoPlayer != null && exoPlayer.isPlaying()) {
                    exoPlayer.pause();
                    playPauseBtn.setImageResource(R.drawable.ic_play);
                }
                return true;
        }

        return super.dispatchKeyEvent(event);
    }
}
