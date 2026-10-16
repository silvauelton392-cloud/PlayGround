package com.thomsongs.app;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

public class UpdateReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
        long pending = ctx.getSharedPreferences("thomupd", Context.MODE_PRIVATE).getLong("dl", -1);
        if (id == -1 || id != pending) return;
        try {
            DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
            Uri uri = dm.getUriForDownloadedFile(id);
            if (uri == null) return;
            Intent inst = new Intent(Intent.ACTION_VIEW);
            inst.setDataAndType(uri, "application/vnd.android.package-archive");
            inst.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            ctx.startActivity(inst);
        } catch (Exception ignored) {}
    }
}
