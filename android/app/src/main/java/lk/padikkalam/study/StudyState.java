package lk.padikkalam.study;

import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.*;
import android.provider.Settings;
import java.time.*;
import java.util.*;
import org.json.*;

final class StudyState {
    static final String FOCUS="Focus", SHORT="Short break", LONG="Long break";
    static final String CHANNEL="study-reminders", CLOCK_ID="focus-clock";
    static final long MIN=60000L;
    private static StudyState instance;
    final Context app;
    final SharedPreferences storage;
    final Map<String,Block> blocks=new LinkedHashMap<>();
    final Map<String,Integer> totals=new TreeMap<>(), counts=new TreeMap<>();
    final Map<String,Long> seen=new LinkedHashMap<>();
    String mode=FOCUS, label="", theme="System";
    int focus=25, brief=5, longer=15, cycle=0, length=25, boot=-1;
    long remaining=25*MIN, until=0, elapsedEnd=0, lastCheck;
    boolean alerts, firstNotice;
    static StudyState get(Context c) { if(instance==null)instance=new StudyState(c.getApplicationContext());return instance; }
    private StudyState(Context c) {
        app=c; storage=c.getSharedPreferences("study-v1",Context.MODE_PRIVATE);
        theme=storage.getString("theme","System");firstNotice=storage.getBoolean("notice-1",true);
        alerts=storage.getBoolean("alerts",false);lastCheck=storage.getLong("checked",System.currentTimeMillis());
        try {
            JSONArray list=new JSONArray(storage.getString("blocks","[]"));
            for(int i=0;i<list.length();i++){Block b=Block.parse(list.getJSONObject(i));blocks.put(b.id,b);}
            JSONObject j=new JSONObject(storage.getString("clock","{}"));
            focus=j.optInt("focus",25);brief=j.optInt("short",5);longer=j.optInt("long",15);
            mode=j.optString("mode",FOCUS);label=j.optString("label","");cycle=j.optInt("cycle",0);
            length=j.optInt("length",focus);remaining=j.optLong("remaining",length*MIN);
            until=j.optLong("until",0);elapsedEnd=j.optLong("elapsed",0);boot=j.optInt("boot",-1);
            JSONObject logs=new JSONObject(storage.getString("history","{}"));
            for(Iterator<String> it=logs.keys();it.hasNext();){String k=it.next();JSONArray entry=logs.getJSONArray(k);counts.put(k,entry.getInt(0));totals.put(k,entry.getInt(1));}
            JSONObject records=new JSONObject(storage.getString("seen","{}"));
            for(Iterator<String> it=records.keys();it.hasNext();){String k=it.next();seen.put(k,records.getLong(k));}
        } catch(JSONException | IllegalArgumentException e){ throw new IllegalStateException("Unable to read the study planner",e); }
        NotificationManager nm=c.getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL,"Study timer and planner",NotificationManager.IMPORTANCE_HIGH));
    }
    int minutes(String phase){return SHORT.equals(phase)?brief:LONG.equals(phase)?longer:focus;}
    int bootCount(){return Settings.Global.getInt(app.getContentResolver(),"boot_count",-1);}
    long left(long now){if(until==0)return remaining;return Math.max(0,until-now);}
    void commit(){
        try{
            JSONArray all=new JSONArray();for(Block b:blocks.values())all.put(b.json());
            JSONObject j=new JSONObject().put("focus",focus).put("short",brief).put("long",longer)
                .put("mode",mode).put("label",label).put("cycle",cycle).put("length",length)
                .put("remaining",remaining).put("until",until).put("elapsed",elapsedEnd).put("boot",boot);
            JSONObject history=new JSONObject();for(String k:counts.keySet())history.put(k,new JSONArray().put(counts.get(k)).put(totals.get(k)));
            if(!storage.edit().putString("blocks",all.toString()).putString("clock",j.toString())
                .putString("history",history.toString()).putString("seen",new JSONObject(seen).toString())
                .putString("theme",theme).putLong("checked",lastCheck).putBoolean("notice-1",firstNotice)
                .putBoolean("alerts",alerts).commit()) throw new IllegalStateException("Device storage is full.");
        }catch(JSONException e){throw new IllegalStateException(e);}
    }
    void choose(String phase){mode=phase;length=minutes(mode);until=0;elapsedEnd=0;remaining=length*MIN;}
    void start(){long now=System.currentTimeMillis();until=now+remaining;elapsedEnd=SystemClock.elapsedRealtime()+remaining;boot=bootCount();saveAndArm();}
    void pause(){tick(false);if(until!=0){remaining=left(System.currentTimeMillis());until=0;elapsedEnd=0;saveAndArm();}}
    void saveAndArm(){commit();arm(System.currentTimeMillis());}
    void tick(boolean systemClockChanged){
        long now=System.currentTimeMillis();ZoneId zone=ZoneId.systemDefault();
        if(until!=0 && systemClockChanged && boot>=0 && boot==bootCount() && elapsedEnd>0)
            until=now+elapsedEnd-SystemClock.elapsedRealtime();
        if(until!=0 && until<=now){
            boolean focused=FOCUS.equals(mode);long finished=until;
            if(focused){String date=Instant.ofEpochMilli(finished).atZone(zone).toLocalDate().toString();
                counts.put(date,counts.getOrDefault(date,0)+1);totals.put(date,totals.getOrDefault(date,0)+length);cycle++;}
            choose(focused?(cycle%4==0?LONG:SHORT):FOCUS);
            if(now-finished<60*MIN)notify(CLOCK_ID,focused?"Focus session complete":"Break complete",mode+" is ready.");
        }
        long from=Math.min(now,Math.max(lastCheck,now-60*MIN));
        if(alerts)for(Block b:blocks.values()){
            long due=b.nextAfter(from,zone);String tag=b.id+"-"+due;
            if(due<=now && !seen.containsKey(tag)){
                seen.put(tag,now);notify(tag,b.title,"Study block at "+b.start+" · "+b.pattern());
            }
        }
        seen.entrySet().removeIf(e->now-e.getValue()>2*24*60*MIN);lastCheck=now;
        saveAndArm();
    }
    boolean permitted(){NotificationManager nm=app.getSystemService(NotificationManager.class);NotificationChannel channel=nm.getNotificationChannel(CHANNEL);
        return nm.areNotificationsEnabled() && channel!=null && channel.getImportance()!=NotificationManager.IMPORTANCE_NONE
            &&(Build.VERSION.SDK_INT<33||app.checkSelfPermission("android.permission.POST_NOTIFICATIONS")==PackageManager.PERMISSION_GRANTED);}
    boolean precise(){return Build.VERSION.SDK_INT<31 || app.getSystemService(AlarmManager.class).canScheduleExactAlarms();}
    void notify(String tag,String title,String text){
        if(!alerts||!permitted())return;
        Intent open=new Intent(app,StudyActivity.class).putExtra("screen",CLOCK_ID.equals(tag)?"Focus":"Planner")
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap=PendingIntent.getActivity(app,CLOCK_ID.equals(tag)?2:3,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification n=new Notification.Builder(app,CHANNEL).setSmallIcon(lk.padikkalam.study.R.drawable.status_book)
            .setContentTitle(title).setContentText(text).setAutoCancel(true).setContentIntent(tap).build();
        try{app.getSystemService(NotificationManager.class).notify(tag,1,n);}catch(SecurityException ignored){}
    }
    void arm(long now){
        AlarmManager manager=app.getSystemService(AlarmManager.class);
        PendingIntent intent=PendingIntent.getBroadcast(app,1,new Intent(app,StudyAlarm.class).setAction("lk.padikkalam.study.ALARM"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        long next=until>0?until:Long.MAX_VALUE;
        if(alerts && permitted())for(Block b:blocks.values())next=Math.min(next,b.nextAfter(now,ZoneId.systemDefault()));
        if(next==Long.MAX_VALUE){manager.cancel(intent);return;}
        next=Math.max(now+50,next);
        if(precise()){try{manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next,intent);return;}catch(SecurityException ignored){}}
        manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next,intent);
    }
}
