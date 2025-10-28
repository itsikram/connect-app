package com.connect.app;

import android.content.Intent;
import androidx.annotation.Nullable;

import com.facebook.react.HeadlessJsTaskService;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;

/**
 * Headless JS service to re-start JS background tasks after app termination or boot.
 */
public class KeepAliveService extends HeadlessJsTaskService {
    @Override
    protected @Nullable HeadlessJsTaskConfig getTaskConfig(Intent intent) {
        WritableMap data = Arguments.createMap();
        data.putString("source", "KeepAliveService");
        return new HeadlessJsTaskConfig(
                "KeepAliveTask",
                data,
                0,
                true
        );
    }
}


