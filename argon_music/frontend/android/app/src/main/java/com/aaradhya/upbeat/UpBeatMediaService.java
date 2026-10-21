package com.aaradhya.upbeat;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.support.v4.media.MediaBrowserCompat;
import android.support.v4.media.MediaDescriptionCompat;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.MediaBrowserServiceCompat;
import androidx.media.session.MediaButtonReceiver;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

/**
 * Android Notification Media Controls & Android Auto In-Car Browser Service for UpBeat.
 * Implements MediaBrowserServiceCompat + MediaSessionCompat + MediaStyle notification controls
 * so UpBeat displays the native interactive playback bar (Play, Pause, Forward, Backward, Scrubber)
 * in the Android notification shade, Quick Settings, lock screen, and car display (Spotify/YT Music style).
 */
public class UpBeatMediaService extends MediaBrowserServiceCompat {

    public static final String CHANNEL_ID = "upbeat_playback_channel";
    public static final int NOTIFICATION_ID = 1042;
    private static final String PREFS_NAME = "upbeat_car_prefs";
    private static final String KEY_QUEUE = "car_queue_json";
    private static final String KEY_FAVS = "car_favs_json";

    public static final String ACTION_TOGGLE_PLAY = "com.aaradhya.upbeat.ACTION_TOGGLE_PLAY";
    public static final String ACTION_PLAY = "com.aaradhya.upbeat.ACTION_PLAY";
    public static final String ACTION_PAUSE = "com.aaradhya.upbeat.ACTION_PAUSE";
    public static final String ACTION_NEXT = "com.aaradhya.upbeat.ACTION_NEXT";
    public static final String ACTION_PREV = "com.aaradhya.upbeat.ACTION_PREV";
    public static final String ACTION_REWIND = "com.aaradhya.upbeat.ACTION_REWIND";
    public static final String ACTION_FORWARD = "com.aaradhya.upbeat.ACTION_FORWARD";
    public static final String ACTION_STOP = "com.aaradhya.upbeat.ACTION_STOP";

    public static final String MEDIA_ID_ROOT = "root";
    public static final String MEDIA_ID_QUEUE = "folder_queue";
    public static final String MEDIA_ID_FAVORITES = "folder_favorites";
    public static final String MEDIA_ID_PRESETS = "folder_presets";

    public static UpBeatMediaService sInstance = null;

    private MediaSessionCompat mMediaSession;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    private boolean isCurrentlyPlaying = false;
    private String currentTitle = "UpBeat";
    private String currentArtist = "Curated Stream";
    private String currentArtUrl = "";
    private long currentDurationMs = 0;
    private long currentPositionMs = 0;

    private Bitmap cachedArtworkBitmap = null;
    private String cachedArtworkUrl = "";

    @Override
    public void onCreate() {
        super.onCreate();
        sInstance = this;
        createNotificationChannel();
        acquireLocks();

        // Initialize MediaSessionCompat with interactive transport flags
        mMediaSession = new MediaSessionCompat(this, "UpBeatMediaSession");
        mMediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );

        Intent mediaButtonIntent = new Intent(Intent.ACTION_MEDIA_BUTTON);
        mediaButtonIntent.setClass(this, MediaButtonReceiver.class);
        int pFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent mbPendingIntent = PendingIntent.getBroadcast(this, 0, mediaButtonIntent, pFlags);
        mMediaSession.setMediaButtonReceiver(mbPendingIntent);

        mMediaSession.setCallback(new MediaSessionCallback());
        mMediaSession.setActive(true);
        setSessionToken(mMediaSession.getSessionToken());

        updatePlaybackState(PlaybackStateCompat.STATE_NONE, 0);
    }

    private class MediaSessionCallback extends MediaSessionCompat.Callback {
        @Override
        public void onPlay() {
            dispatchToApp("play", "");
        }

        @Override
        public void onPause() {
            dispatchToApp("pause", "");
        }

        @Override
        public void onSkipToNext() {
            dispatchToApp("next", "");
        }

        @Override
        public void onSkipToPrevious() {
            dispatchToApp("prev", "");
        }

        @Override
        public void onFastForward() {
            long targetSec = (currentPositionMs / 1000) + 10;
            dispatchToApp("seek", String.valueOf(targetSec));
        }

        @Override
        public void onRewind() {
            long targetSec = Math.max(0, (currentPositionMs / 1000) - 10);
            dispatchToApp("seek", String.valueOf(targetSec));
        }

        @Override
        public void onSeekTo(long pos) {
            dispatchToApp("seek", String.valueOf(pos / 1000));
        }

        @Override
        public void onPlayFromMediaId(String mediaId, Bundle extras) {
            if (mediaId == null) return;
            if (mediaId.startsWith("track_")) {
                dispatchToApp("play_index", mediaId.substring(6));
            } else if (mediaId.startsWith("fav_")) {
                dispatchToApp("play_favorite", mediaId.substring(4));
            } else if (mediaId.startsWith("preset_")) {
                dispatchToApp("play_preset", mediaId);
            }
        }
    }

    private void dispatchToApp(String action, String payload) {
        if (MainActivity.sInstance != null) {
            MainActivity.sInstance.dispatchCarAction(action, payload);
        } else {
            Intent launchIntent = new Intent(this, MainActivity.class);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            launchIntent.putExtra("car_action", action);
            launchIntent.putExtra("car_payload", payload);
            startActivity(launchIntent);
        }
    }

    @Nullable
    @Override
    public BrowserRoot onGetRoot(@NonNull String clientPackageName, int clientUid, @Nullable Bundle rootHints) {
        return new BrowserRoot(MEDIA_ID_ROOT, null);
    }

    @Override
    public void onLoadChildren(@NonNull String parentMediaId, @NonNull Result<List<MediaBrowserCompat.MediaItem>> result) {
        List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        if (MEDIA_ID_ROOT.equals(parentMediaId)) {
            items.add(createFolder(MEDIA_ID_QUEUE, "Current Queue", "Active playlist tracks"));
            items.add(createFolder(MEDIA_ID_FAVORITES, "Liked Songs", "Your saved favorites"));
            items.add(createFolder(MEDIA_ID_PRESETS, "Curated Vibes", "Quick mood & genre mixes"));
            result.sendResult(items);
            return;
        }

        if (MEDIA_ID_QUEUE.equals(parentMediaId)) {
            String queueJson = prefs.getString(KEY_QUEUE, "[]");
            populateFromJsonArray(items, queueJson, "track_");
            result.sendResult(items);
            return;
        }

        if (MEDIA_ID_FAVORITES.equals(parentMediaId)) {
            String favsJson = prefs.getString(KEY_FAVS, "[]");
            populateFromJsonArray(items, favsJson, "fav_");
            result.sendResult(items);
            return;
        }

        if (MEDIA_ID_PRESETS.equals(parentMediaId)) {
            items.add(createPlayable("preset_late_night", "Late Night Drive", "Atmospheric Hip-Hop & Lofi", ""));
            items.add(createPlayable("preset_focus", "Deep Focus Ambient", "Instrumental Electronic Beats", ""));
            items.add(createPlayable("preset_energy", "High Energy Workout", "Gym Motivation & Fast BPM", ""));
            items.add(createPlayable("preset_anime", "Anime Openings", "Hiroyuki Sawano & J-Rock", ""));
            items.add(createPlayable("preset_hindi", "New Hindi Songs", "Latest Releases & Top Hits", ""));
            result.sendResult(items);
            return;
        }

        result.sendResult(items);
    }

    private MediaBrowserCompat.MediaItem createFolder(String id, String title, String subtitle) {
        MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
            .setMediaId(id)
            .setTitle(title)
            .setSubtitle(subtitle)
            .build();
        return new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE);
    }

    private MediaBrowserCompat.MediaItem createPlayable(String id, String title, String subtitle, String iconUri) {
        MediaDescriptionCompat.Builder builder = new MediaDescriptionCompat.Builder()
            .setMediaId(id)
            .setTitle(title)
            .setSubtitle(subtitle);
        if (iconUri != null && !iconUri.isEmpty()) {
            builder.setIconUri(Uri.parse(iconUri));
        }
        return new MediaBrowserCompat.MediaItem(builder.build(), MediaBrowserCompat.MediaItem.FLAG_PLAYABLE);
    }

    private void populateFromJsonArray(List<MediaBrowserCompat.MediaItem> items, String json, String idPrefix) {
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                String title = obj.optString("title", "Track " + (i + 1));
                String artist = obj.optString("artist", "UpBeat");
                String thumb = obj.optString("thumbnail", "");
                int idx = obj.optInt("index", i);
                items.add(createPlayable(idPrefix + idx, title, artist, thumb));
            }
        } catch (Exception ignored) {}
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        MediaButtonReceiver.handleIntent(mMediaSession, intent);

        if (intent != null && intent.getAction() != null) {
            String act = intent.getAction();
            if (ACTION_TOGGLE_PLAY.equals(act)) {
                dispatchToApp(isCurrentlyPlaying ? "pause" : "play", "");
                return START_STICKY;
            } else if (ACTION_PLAY.equals(act)) {
                dispatchToApp("play", "");
                return START_STICKY;
            } else if (ACTION_PAUSE.equals(act)) {
                dispatchToApp("pause", "");
                return START_STICKY;
            } else if (ACTION_NEXT.equals(act)) {
                dispatchToApp("next", "");
                return START_STICKY;
            } else if (ACTION_PREV.equals(act)) {
                dispatchToApp("prev", "");
                return START_STICKY;
            } else if (ACTION_REWIND.equals(act)) {
                long targetSec = Math.max(0, (currentPositionMs / 1000) - 10);
                dispatchToApp("seek", String.valueOf(targetSec));
                return START_STICKY;
            } else if (ACTION_FORWARD.equals(act)) {
                long targetSec = (currentPositionMs / 1000) + 10;
                dispatchToApp("seek", String.valueOf(targetSec));
                return START_STICKY;
            } else if (ACTION_STOP.equals(act)) {
                dispatchToApp("pause", "");
                stopForeground(true);
                stopSelf();
                return START_NOT_STICKY;
            }
        }

        if (intent != null) {
            String t = intent.getStringExtra("title");
            String a = intent.getStringExtra("artist");
            String art = intent.getStringExtra("artUrl");
            long dur = intent.getLongExtra("durationSec", 0);
            long pos = intent.getLongExtra("positionSec", 0);
            boolean playing = intent.getBooleanExtra("isPlaying", false);

            if (t != null && !t.isEmpty()) currentTitle = t;
            if (a != null && !a.isEmpty()) currentArtist = a;
            if (art != null) currentArtUrl = art;
            if (dur > 0) currentDurationMs = dur * 1000;
            currentPositionMs = pos * 1000;
            isCurrentlyPlaying = playing;

            mMediaSession.setActive(true);
            applyMediaMetadata();
            updatePlaybackState(
                playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                currentPositionMs
            );

            if (currentArtUrl != null && !currentArtUrl.isEmpty() && !currentArtUrl.equals(cachedArtworkUrl)) {
                loadArtworkBitmapAsync(currentArtUrl);
            }
        }

        Notification notification = buildNotification(currentTitle, currentArtist, isCurrentlyPlaying);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                );
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception ignored) {}

        acquireLocks();
        return START_STICKY;
    }

    private void updatePlaybackState(int state, long positionMs) {
        long actions = PlaybackStateCompat.ACTION_PLAY
            | PlaybackStateCompat.ACTION_PAUSE
            | PlaybackStateCompat.ACTION_PLAY_PAUSE
            | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
            | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
            | PlaybackStateCompat.ACTION_SEEK_TO
            | PlaybackStateCompat.ACTION_STOP
            | PlaybackStateCompat.ACTION_FAST_FORWARD
            | PlaybackStateCompat.ACTION_REWIND;

        PlaybackStateCompat.Builder stateBuilder = new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(state, positionMs, 1.0f);

        mMediaSession.setPlaybackState(stateBuilder.build());
    }

    private void applyMediaMetadata() {
        MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "UpBeat")
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, currentDurationMs);

        if (cachedArtworkBitmap != null) {
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, cachedArtworkBitmap);
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, cachedArtworkBitmap);
        }
        if (currentArtUrl != null && !currentArtUrl.isEmpty()) {
            metaBuilder.putString(MediaMetadataCompat.METADATA_KEY_ALBUM_ART_URI, currentArtUrl);
            metaBuilder.putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON_URI, currentArtUrl);
        }

        mMediaSession.setMetadata(metaBuilder.build());
    }

    private void loadArtworkBitmapAsync(final String urlString) {
        if (urlString == null || urlString.isEmpty()) {
            cachedArtworkBitmap = null;
            cachedArtworkUrl = "";
            applyMediaMetadata();
            notifyNotification();
            return;
        }

        new Thread(() -> {
            try {
                URL url = new URL(urlString);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setDoInput(true);
                conn.setConnectTimeout(4000);
                conn.setReadTimeout(4000);
                conn.connect();
                InputStream input = conn.getInputStream();
                Bitmap bmp = BitmapFactory.decodeStream(input);
                if (bmp != null) {
                    cachedArtworkBitmap = bmp;
                    cachedArtworkUrl = urlString;
                    new Handler(Looper.getMainLooper()).post(() -> {
                        applyMediaMetadata();
                        notifyNotification();
                    });
                }
            } catch (Exception ignored) {}
        }).start();
    }

    private void notifyNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, buildNotification(currentTitle, currentArtist, isCurrentlyPlaying));
        }
    }

    private PendingIntent createActionIntent(String action) {
        Intent intent = new Intent(this, UpBeatMediaService.class);
        intent.setAction(action);
        int pFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getService(this, action.hashCode(), intent, pFlags);
    }

    private Notification buildNotification(String title, String artist, boolean isPlaying) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, openIntent, pendingFlags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(artist)
            .setSubText("UpBeat")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(contentIntent)
            .setOngoing(isPlaying)
            .setSilent(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT);

        if (cachedArtworkBitmap != null) {
            builder.setLargeIcon(cachedArtworkBitmap);
        }

        builder
            .addAction(new NotificationCompat.Action(
                android.R.drawable.ic_media_previous, "Previous", createActionIntent(ACTION_PREV)))
            .addAction(new NotificationCompat.Action(
                isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                isPlaying ? "Pause" : "Play",
                createActionIntent(ACTION_TOGGLE_PLAY)))
            .addAction(new NotificationCompat.Action(
                android.R.drawable.ic_media_next, "Next", createActionIntent(ACTION_NEXT)))
            .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(mMediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2)
                .setShowCancelButton(true)
                .setCancelButtonIntent(createActionIntent(ACTION_STOP)));

        return builder.build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "UpBeat Playback",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows interactive music player controls in notification bar");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    public static void saveQueue(Context context, String queueJson) {
        if (context == null || queueJson == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_QUEUE, queueJson).apply();
        if (sInstance != null) {
            sInstance.notifyChildrenChanged(MEDIA_ID_QUEUE);
        }
    }

    public static void saveFavorites(Context context, String favsJson) {
        if (context == null || favsJson == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_FAVS, favsJson).apply();
        if (sInstance != null) {
            sInstance.notifyChildrenChanged(MEDIA_ID_FAVORITES);
        }
    }

    public static void updatePlayback(Context context, boolean isPlaying, String title, String artist, String artUrl, long durationSec, long positionSec) {
        if (context == null) return;
        try {
            Intent serviceIntent = new Intent(context, UpBeatMediaService.class);
            serviceIntent.putExtra("isPlaying", isPlaying);
            serviceIntent.putExtra("title", title != null ? title : "UpBeat");
            serviceIntent.putExtra("artist", artist != null ? artist : "");
            serviceIntent.putExtra("artUrl", artUrl != null ? artUrl : "");
            serviceIntent.putExtra("durationSec", durationSec);
            serviceIntent.putExtra("positionSec", positionSec);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                androidx.core.content.ContextCompat.startForegroundService(context, serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } catch (Exception ignored) {}
    }

    private void acquireLocks() {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "UpBeat::MediaWakeLock");
                    wakeLock.setReferenceCounted(false);
                }
            }
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire();
            }
        } catch (Exception ignored) {}

        try {
            if (wifiLock == null) {
                WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wm != null) {
                    int lockType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                        : WifiManager.WIFI_MODE_FULL_HIGH_PERF;
                    wifiLock = wm.createWifiLock(lockType, "UpBeat::MediaWifiLock");
                    wifiLock.setReferenceCounted(false);
                }
            }
            if (wifiLock != null && !wifiLock.isHeld()) {
                wifiLock.acquire();
            }
        } catch (Exception ignored) {}
    }

    private void releaseLocks() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {}
        try {
            if (wifiLock != null && wifiLock.isHeld()) {
                wifiLock.release();
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (mMediaSession != null) {
            mMediaSession.setActive(false);
            mMediaSession.release();
        }
        releaseLocks();
        sInstance = null;
    }
}
