package com.example.tvapp;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;

@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    private long downloadId = -1;
    private PluginCall currentCall = null;
    private BroadcastReceiver onDownloadComplete = null;
    private String currentVersion = "latest";
    private Handler handler = new Handler(Looper.getMainLooper());
    private Runnable progressRunnable;

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String version = call.getString("version", "latest");
        currentVersion = version;
        
        if (url == null || url.isEmpty()) {
            call.reject("URL is missing");
            return;
        }

        currentCall = call;
        Context context = getContext();
        File dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        
        if (dir != null) {
            File targetApk = new File(dir, "update_" + version + ".apk");
            if (targetApk.exists()) {
                // Verify if it's a completely downloaded and valid APK
                android.content.pm.PackageManager pm = context.getPackageManager();
                android.content.pm.PackageInfo info = pm.getPackageArchiveInfo(targetApk.getAbsolutePath(), 0);
                if (info != null) {
                    // Valid APK, just install
                    installApk(targetApk);
                    return;
                } else {
                    // Incomplete or corrupted, delete it and re-download
                    targetApk.delete();
                }
            }

            // Delete any older updates to save space
            File[] files = dir.listFiles();
            if (files != null) {
                for (File f : files) {
                    if (f.getName().startsWith("update_") && f.getName().endsWith(".apk")) {
                        f.delete();
                    }
                }
            }
        }

        DownloadManager downloadManager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);

        Uri uri = Uri.parse(url);
        DownloadManager.Request request = new DownloadManager.Request(uri);
        request.setTitle("App Update");
        request.setDescription("Downloading latest version...");
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_HIDDEN);
        
        request.setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, "update_" + version + ".apk");

        if (onDownloadComplete == null) {
            onDownloadComplete = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                    if (downloadId == id) {
                        handleDownloadComplete(id);
                    }
                }
            };
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(onDownloadComplete, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_EXPORTED);
            } else {
                context.registerReceiver(onDownloadComplete, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
            }
        }

        downloadId = downloadManager.enqueue(request);
        startProgressPolling();
    }

    private void startProgressPolling() {
        if (progressRunnable != null) {
            handler.removeCallbacks(progressRunnable);
        }
        progressRunnable = new Runnable() {
            @Override
            public void run() {
                checkProgress();
                if (downloadId != -1) {
                    handler.postDelayed(this, 500);
                }
            }
        };
        handler.post(progressRunnable);
    }

    private void checkProgress() {
        if (downloadId == -1) return;
        Context context = getContext();
        DownloadManager downloadManager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        DownloadManager.Query query = new DownloadManager.Query();
        query.setFilterById(downloadId);
        Cursor cursor = downloadManager.query(query);
        if (cursor != null && cursor.moveToFirst()) {
            int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
            if (statusIndex >= 0) {
                int status = cursor.getInt(statusIndex);
                if (status == DownloadManager.STATUS_FAILED) {
                    if (currentCall != null) {
                        currentCall.reject("Download failed from DownloadManager");
                        currentCall = null;
                    }
                    downloadId = -1;
                    cursor.close();
                    return;
                } else if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    long id = downloadId;
                    downloadId = -1;
                    cursor.close();
                    handleDownloadComplete(id);
                    return;
                }
            }

            int bytesDownloadedIndex = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
            int bytesTotalIndex = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES);
            if (bytesDownloadedIndex >= 0 && bytesTotalIndex >= 0) {
                long downloaded = cursor.getLong(bytesDownloadedIndex);
                long total = cursor.getLong(bytesTotalIndex);
                if (total > 0) {
                    int progress = (int) ((downloaded * 100L) / total);
                    JSObject ret = new JSObject();
                    ret.put("progress", progress);
                    notifyListeners("onProgress", ret);
                } else if (downloaded > 0) {
                    // Indeterminate, just send something so UI isn't dead
                    int progress = (int) ((downloaded / 1024 / 1024) % 100); 
                    if (progress == 0) progress = 1;
                    JSObject ret = new JSObject();
                    ret.put("progress", progress);
                    notifyListeners("onProgress", ret);
                }
            }
            cursor.close();
        }
    }

    private void handleDownloadComplete(long id) {
        downloadId = -1; // stop polling
        Context context = getContext();
        DownloadManager downloadManager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        
        DownloadManager.Query query = new DownloadManager.Query();
        query.setFilterById(id);
        Cursor cursor = downloadManager.query(query);
        
        if (cursor != null && cursor.moveToFirst()) {
            int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
            if (statusIndex >= 0) {
                int status = cursor.getInt(statusIndex);
                if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    File dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    File apkFile = new File(dir, "update_" + currentVersion + ".apk");
                    installApk(apkFile);
                } else {
                    if (currentCall != null) {
                        currentCall.reject("Download failed");
                        currentCall = null;
                    }
                }
            }
            cursor.close();
        }
    }

    private void installApk(File apkFile) {
        Context context = getContext();

        if (!apkFile.exists()) {
            if (currentCall != null) currentCall.reject("APK file not found");
            return;
        }

        try {
            Uri apkUri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", apkFile);

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            if (getActivity() != null) {
                getActivity().startActivity(intent);
            } else {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            }

            if (currentCall != null) {
                currentCall.resolve();
                currentCall = null;
            }
        } catch (Exception e) {
            e.printStackTrace();
            if (currentCall != null) {
                currentCall.reject("Install failed: " + e.getMessage());
                currentCall = null;
            }
        }
    }
}
