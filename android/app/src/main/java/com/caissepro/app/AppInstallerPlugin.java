package com.caissepro.app;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "AppInstaller")
public class AppInstallerPlugin extends Plugin {
    private static final String TAG = "AppInstaller";
    private long currentDownloadId = -1;
    private PluginCall pendingCall = null;

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        String filename = call.getString("filename", "CaissePro.apk");
        Log.d(TAG, "Downloading APK from: " + url);

        try {
            // Delete old APK if exists
            File oldFile = new File(
                getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
                filename
            );
            if (oldFile.exists()) oldFile.delete();

            // Use Android DownloadManager
            DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle("Mise a jour CaissePro");
            request.setDescription("Telechargement en cours...");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, filename);
            request.setMimeType("application/vnd.android.package-archive");

            currentDownloadId = dm.enqueue(request);
            pendingCall = call;

            // Register receiver for download completion
            BroadcastReceiver receiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                    if (id != currentDownloadId) return;

                    try {
                        context.unregisterReceiver(this);
                    } catch (Exception e) {
                        // Already unregistered
                    }

                    DownloadManager.Query query = new DownloadManager.Query();
                    query.setFilterById(currentDownloadId);
                    Cursor cursor = dm.query(query);

                    if (cursor != null && cursor.moveToFirst()) {
                        int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                        int status = cursor.getInt(statusIndex);

                        if (status == DownloadManager.STATUS_SUCCESSFUL) {
                            Log.d(TAG, "Download complete, launching installer...");
                            installApk(filename);
                            if (pendingCall != null) {
                                JSObject result = new JSObject();
                                result.put("success", true);
                                result.put("message", "Download complete, installer launched");
                                pendingCall.resolve(result);
                                pendingCall = null;
                            }
                        } else {
                            Log.e(TAG, "Download failed with status: " + status);
                            if (pendingCall != null) {
                                pendingCall.reject("Download failed with status: " + status);
                                pendingCall = null;
                            }
                        }
                        cursor.close();
                    }
                }
            };

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(receiver,
                    new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                    Context.RECEIVER_EXPORTED);
            } else {
                getContext().registerReceiver(receiver,
                    new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
            }

            // Send progress updates
            notifyDownloadProgress(dm);

        } catch (Exception e) {
            Log.e(TAG, "Download error: " + e.getMessage());
            call.reject("Download error: " + e.getMessage());
        }
    }

    private void installApk(String filename) {
        try {
            File apkFile = new File(
                getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
                filename
            );

            if (!apkFile.exists()) {
                Log.e(TAG, "APK file not found: " + apkFile.getAbsolutePath());
                return;
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            Uri apkUri;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                // Use FileProvider for Android 7+
                apkUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    apkFile
                );
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                apkUri = Uri.fromFile(apkFile);
            }

            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

        } catch (Exception e) {
            Log.e(TAG, "Install error: " + e.getMessage());
        }
    }

    private void notifyDownloadProgress(DownloadManager dm) {
        new Thread(() -> {
            boolean downloading = true;
            while (downloading) {
                DownloadManager.Query query = new DownloadManager.Query();
                query.setFilterById(currentDownloadId);
                Cursor cursor = dm.query(query);

                if (cursor != null && cursor.moveToFirst()) {
                    int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                    int bytesIndex = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
                    int totalIndex = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES);

                    int status = cursor.getInt(statusIndex);
                    long bytesDownloaded = cursor.getLong(bytesIndex);
                    long totalBytes = cursor.getLong(totalIndex);

                    if (status == DownloadManager.STATUS_SUCCESSFUL ||
                        status == DownloadManager.STATUS_FAILED) {
                        downloading = false;
                    } else if (totalBytes > 0) {
                        int progress = (int) ((bytesDownloaded * 100) / totalBytes);
                        JSObject data = new JSObject();
                        data.put("progress", progress);
                        data.put("bytesDownloaded", bytesDownloaded);
                        data.put("totalBytes", totalBytes);
                        notifyListeners("downloadProgress", data);
                    }
                    cursor.close();
                }

                try { Thread.sleep(500); } catch (InterruptedException e) { break; }
            }
        }).start();
    }

    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null) { call.reject("URL is required"); return; }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Cannot open URL: " + e.getMessage());
        }
    }
}
