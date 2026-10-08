package io.github.soreno.myearhertz;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // The long-term check reminders. Silent and still: any sound, even a vibration motor's hum, has a pitch
    // and would act as a reference tone. High importance so the reminder still pops up on screen.
    // Created here because the notifications plugin can't make a channel without its default sound.
    static final String CHECKS_CHANNEL = "checks";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        NotificationChannel checks = new NotificationChannel(CHECKS_CHANNEL, "Checks", NotificationManager.IMPORTANCE_HIGH);
        checks.setSound(null, null);
        checks.enableVibration(false);
        checks.setShowBadge(true);
        getSystemService(NotificationManager.class).createNotificationChannel(checks);
    }
}
