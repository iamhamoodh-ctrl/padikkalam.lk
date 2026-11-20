package lk.padikkalam.study;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
public final class StudyAlarm extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        StudyState.get(context).tick(Intent.ACTION_TIME_CHANGED.equals(intent.getAction()));
    }
}
