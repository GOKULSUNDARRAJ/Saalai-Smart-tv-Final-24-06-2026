package com.example.tvapp;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

public class WebVideoActivity extends Activity {

    private WebView webView;

    private final class JsBridge {
        @JavascriptInterface
        public void back() {
            runOnUiThread(() -> finish());
        }
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
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

        String url   = getIntent().getStringExtra("url");
        String title = getIntent().getStringExtra("title");
        if (url == null || url.isEmpty()) { finish(); return; }
        if (title == null) title = "";

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setDomStorageEnabled(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new JsBridge(), "Android");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                view.setVisibility(View.VISIBLE);
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
        });

        webView.setVisibility(View.INVISIBLE);
        webView.loadDataWithBaseURL(
            "about:blank",
            buildHtml(url, title),
            "text/html",
            "utf-8",
            null
        );

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        root.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        setContentView(root);
    }

    private static String buildHtml(String url, String title) {
        String safeUrl   = url  .replace("\\", "\\\\").replace("'", "\\'");
        String safeTitle = title.replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");

        return "<!DOCTYPE html><html><head>"
            + "<meta charset='utf-8'>"
            + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<style>"
            + "*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}"
            + "html,body{width:100%;height:100%;background:#000;overflow:hidden;font-family:sans-serif;}"
            + "video{position:fixed;top:0;left:0;width:100%;height:100%;object-fit:contain;background:#000;outline:none;}"

            + "#buf{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);"
            + "display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:none;}"
            + "#spinner{width:64px;height:64px;border:5px solid rgba(255,255,255,0.2);"
            + "border-top-color:#e50914;border-radius:50%;animation:spin 0.8s linear infinite;}"
            + "@keyframes spin{to{transform:rotate(360deg);}}"
            + "#bufTxt{color:#fff;font-size:14px;}"

            + "#ctrl{position:fixed;top:0;left:0;width:100%;height:100%;"
            + "pointer-events:none;transition:opacity 0.3s;}"
            + "#ctrl.vis{opacity:1;pointer-events:auto;}"
            + "#ctrl.hid{opacity:0;pointer-events:none;}"

            + "#topBar{position:absolute;top:0;left:0;right:0;"
            + "display:flex;align-items:center;padding:20px 24px;"
            + "background:rgba(0,0,0,0.8);}"
            + "#backBtn{color:rgba(255,255,255,0.8);font-size:18px;"
            + "padding:8px 14px;border-radius:8px;cursor:pointer;"
            + "border:3px solid transparent;white-space:nowrap;flex-shrink:0;}"
            + "#backBtn.foc{background:#e50914;border-color:#fff;color:#fff;}"
            + "#ttl{color:#fff;font-size:18px;margin-left:8px;"
            + "overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}"

            + "#botBar{position:absolute;bottom:0;left:0;right:0;"
            + "padding:12px 24px 20px;background:rgba(0,0,0,0.8);}"

            + "#seekWrap{width:100%;height:28px;display:flex;align-items:center;position:relative;cursor:pointer;}"
            + "#seekTrack{width:100%;height:4px;background:rgba(255,255,255,0.3);border-radius:2px;position:relative;}"
            + "#seekFill{height:100%;background:#e50914;border-radius:2px;position:absolute;top:0;left:0;width:0%;}"
            + "#seekThumb{width:16px;height:16px;border-radius:50%;background:#fff;"
            + "position:absolute;top:50%;left:0%;transform:translate(-50%,-50%);"
            + "box-shadow:0 0 4px rgba(0,0,0,0.6);}"
            + "#seekWrap.foc #seekThumb{box-shadow:0 0 0 3px rgba(229,9,20,0.7);}"

            + "#btnsRow{display:flex;align-items:center;padding-top:8px;}"
            + ".cbtn{color:rgba(255,255,255,0.8);font-size:24px;"
            + "padding:6px 10px;border-radius:8px;cursor:pointer;"
            + "border:3px solid transparent;line-height:1;user-select:none;}"
            + ".cbtn.foc{background:#e50914;border-color:#fff;color:#fff;}"
            + "#ppBtn{font-size:30px;margin-left:16px;}"
            + "#fwdBtn{margin-left:16px;}"
            + "#spacer{flex:1;}"
            + "#timeV{color:rgba(255,255,255,0.8);font-size:15px;}"
            + "</style></head><body>"

            + "<video id='v' autoplay playsinline preload='auto'></video>"

            + "<div id='buf'><div id='spinner'></div><div id='bufTxt'>Buffering\u2026</div></div>"

            + "<div id='ctrl' class='vis'>"
            + "<div id='topBar'>"
            + "<div id='backBtn'>\u00AB Back</div>"
            + "<div id='ttl'>" + safeTitle + "</div>"
            + "</div>"
            + "<div id='botBar'>"
            + "<div id='seekWrap'><div id='seekTrack'><div id='seekFill'></div><div id='seekThumb'></div></div></div>"
            + "<div id='btnsRow'>"
            + "<div id='rwdBtn' class='cbtn'>\u23EA</div>"
            + "<div id='ppBtn'  class='cbtn'>\u25B6</div>"
            + "<div id='fwdBtn' class='cbtn'>\u23E9</div>"
            + "<div id='spacer'></div>"
            + "<div id='timeV'>0:00 / 0:00</div>"
            + "</div></div></div>"

            + "<script>"
            + "var v=document.getElementById('v');"
            + "var buf=document.getElementById('buf');"
            + "var ctrl=document.getElementById('ctrl');"
            + "var backBtn=document.getElementById('backBtn');"
            + "var seekWrap=document.getElementById('seekWrap');"
            + "var seekFill=document.getElementById('seekFill');"
            + "var seekThumb=document.getElementById('seekThumb');"
            + "var rwdBtn=document.getElementById('rwdBtn');"
            + "var ppBtn=document.getElementById('ppBtn');"
            + "var fwdBtn=document.getElementById('fwdBtn');"
            + "var timeV=document.getElementById('timeV');"

            + "var F={BACK:0,SEEK:1,RWD:2,PP:3,FWD:4};"
            + "var cf=F.PP;"
            + "var vis=true;"
            + "var hideT=null;"
            + "var HIDE=5000;"
            + "var STEP=10;"

            + "function fmt(s){s=Math.floor(s);return Math.floor(s/60)+':'+(('0'+(s%60)).slice(-2));}"

            + "function tick(){"
            + "var pos=v.currentTime,dur=isNaN(v.duration)?0:v.duration;"
            + "var pct=dur>0?(pos/dur*100):0;"
            + "seekFill.style.width=pct+'%';"
            + "seekThumb.style.left=pct+'%';"
            + "timeV.textContent=fmt(pos)+' / '+fmt(Math.max(0,dur));"
            + "ppBtn.textContent=v.paused?'\u25B6':'\u23F8';"
            + "}"
            + "setInterval(tick,500);"

            + "function showBuf(){buf.style.display='flex';}"
            + "function hideBuf(){buf.style.display='none';}"
            + "hideBuf();"
            + "v.addEventListener('waiting',showBuf);"
            + "v.addEventListener('stalled',showBuf);"
            + "v.addEventListener('playing',hideBuf);"
            + "v.addEventListener('canplay',hideBuf);"

            + "function showCtrl(){"
            + "clearTimeout(hideT);ctrl.className='vis';vis=true;"
            + "if(!v.paused)hideT=setTimeout(hideCtrl,HIDE);"
            + "}"
            + "function hideCtrl(){ctrl.className='hid';vis=false;}"

            + "function updFoc(){"
            + "backBtn.className=cf===F.BACK?'foc':'';"
            + "seekWrap.className='seekWrap'+(cf===F.SEEK?' foc':'');"
            + "rwdBtn.className='cbtn'+(cf===F.RWD?' foc':'');"
            + "ppBtn.className='cbtn'+(cf===F.PP?' foc':'');"
            + "fwdBtn.className='cbtn'+(cf===F.FWD?' foc':'');"
            + "}"
            + "function setFoc(f){cf=f;updFoc();}"

            + "function togglePlay(){"
            + "if(v.paused){v.play();hideT=setTimeout(hideCtrl,HIDE);}"
            + "else{v.pause();clearTimeout(hideT);}"
            + "tick();"
            + "}"
            + "function seek(d){"
            + "v.currentTime=Math.max(0,Math.min(isNaN(v.duration)?0:v.duration,v.currentTime+d));"
            + "tick();"
            + "}"

            + "v.src='" + safeUrl + "';"
            + "v.play().catch(function(){});"
            + "showBuf();"
            + "showCtrl();"
            + "setFoc(F.PP);"

            + "document.addEventListener('keydown',function(e){"
            + "var k=e.keyCode;"
            + "if(k===27){Android.back();return;}"
            + "e.preventDefault();"
            + "if(!vis){showCtrl();return;}"
            + "showCtrl();"
            + "if(k===38){"
            + "if(cf===F.RWD||cf===F.PP||cf===F.FWD)setFoc(F.SEEK);"
            + "else if(cf===F.SEEK)setFoc(F.BACK);"
            + "}else if(k===40){"
            + "if(cf===F.BACK)setFoc(F.SEEK);"
            + "else if(cf===F.SEEK)setFoc(F.PP);"
            + "}else if(k===37){"
            + "if(cf===F.SEEK)seek(-STEP);"
            + "else if(cf===F.RWD)setFoc(F.BACK);"
            + "else if(cf===F.PP)setFoc(F.RWD);"
            + "else if(cf===F.FWD)setFoc(F.PP);"
            + "}else if(k===39){"
            + "if(cf===F.SEEK)seek(+STEP);"
            + "else if(cf===F.BACK)setFoc(F.RWD);"
            + "else if(cf===F.RWD)setFoc(F.PP);"
            + "else if(cf===F.PP)setFoc(F.FWD);"
            + "}else if(k===13){"
            + "if(cf===F.BACK)Android.back();"
            + "else if(cf===F.SEEK||cf===F.PP)togglePlay();"
            + "else if(cf===F.RWD)seek(-STEP);"
            + "else if(cf===F.FWD)seek(+STEP);"
            + "}else if(k===85||k===179)togglePlay();"
            + "else if((k===126||k===130)&&v.paused)v.play();"
            + "else if((k===127||k===131)&&!v.paused)v.pause();"
            + "});"
            + "</script></body></html>";
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            finish();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.evaluateJavascript("if(window.v&&!v.paused)v.pause();", null);
            webView.onPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.evaluateJavascript("if(window.v&&v.paused)v.play().catch(function(){});", null);
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.evaluateJavascript("if(window.v){v.pause();v.src='';}", null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
