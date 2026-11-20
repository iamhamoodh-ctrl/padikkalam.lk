package lk.padikkalam.study;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.*;
import android.graphics.drawable.*;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.text.InputType;
import android.view.*;
import android.widget.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

public final class StudyActivity extends Activity {
    private static final String SITE="https://padikkalam-lk.hamosumo97.chatgpt.site";
    private static final String[] TABS={"Focus","Planner","Library"};
    private final Handler handler=new Handler(Looper.getMainLooper());
    private StudyState state;
    private String screen="Focus";
    private LocalDate selected=LocalDate.now();
    private LinearLayout root,content,nav;
    private TextView digits;
    private boolean active,dark;
    private int bg,paper,ink,muted,edge;
    private final int forest=0xff193e32,gold=0xfff4cd50, ivory=0xfffaf8e6;
    private long shownUntil;
    private final Runnable clockTick=new Runnable(){public void run(){
        if(!active)return;
        long now=System.currentTimeMillis();
        if(state.until>0 && state.until<=now)state.tick(false);
        if(shownUntil!=state.until){render();return;}
        updateDigits(now);
        if(state.until>0)handler.postDelayed(this,Math.min(1000,Math.max(60,state.until-now)));
    }};
    @Override public void onCreate(Bundle saved){
        state=StudyState.get(this);
        dark="Dark".equals(state.theme)||("System".equals(state.theme)&&(getResources().getConfiguration().uiMode&Configuration.UI_MODE_NIGHT_MASK)==Configuration.UI_MODE_NIGHT_YES);
        setTheme(dark?R.style.DarkTheme:R.style.AppTheme);
        super.onCreate(saved);
        if(saved!=null){screen=saved.getString("screen","Focus");selected=LocalDate.parse(saved.getString("date",LocalDate.now().toString()));}
        else if("Planner".equals(getIntent().getStringExtra("screen")))screen="Planner";
        bg=dark?0xff14201d:0xfffafaf5;paper=dark?0xff1e3028:0xfffffff9;ink=dark?0xfff1f3e7:0xff1d3529;muted=dark?0xffc3d0c5:0xff53675a;edge=dark?0xff425747:0xffd5dfd3;
        if(state.firstNotice){state.firstNotice=false;state.commit();new AlertDialog.Builder(this).setTitle("Welcome to Padikkalam.lk")
            .setMessage("Version 1.0 brings an offline Pomodoro timer and a study calendar with Android reminders. Open Library to read and upload notes.\n\nDesigned by Hamoodh Mohideen")
            .setPositiveButton("Get started",null).show();}
    }
    @Override protected void onResume(){super.onResume();active=true;state.tick(false);render();}
    @Override protected void onPause(){active=false;handler.removeCallbacks(clockTick);super.onPause();}
    @Override protected void onSaveInstanceState(Bundle out){super.onSaveInstanceState(out);out.putString("screen",screen);out.putString("date",selected.toString());}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);if("Planner".equals(intent.getStringExtra("screen")))screen="Planner";else screen="Focus";render();}
    private int dp(int v){return Math.round(v*getResources().getDisplayMetrics().density);}
    private LinearLayout col(){LinearLayout l=new LinearLayout(this);l.setOrientation(1);return l;}
    private LinearLayout row(){LinearLayout l=new LinearLayout(this);l.setGravity(Gravity.CENTER_VERTICAL);return l;}
    private void pad(View v,int h,int y){v.setPadding(dp(h),dp(y),dp(h),dp(y));}
    private GradientDrawable box(int color,int radius,boolean border){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));if(border)d.setStroke(dp(1),edge);return d;}
    private TextView text(String value,float size,int color,boolean bold){TextView v=new TextView(this);v.setText(value);v.setTextSize(size);v.setTextColor(color);if(bold)v.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return v;}
    private TextView heading(String value,int size,int color){TextView t=text(value,size,color,false);t.setTypeface(Typeface.SERIF);return t;}
    private void gap(LinearLayout l,int y){l.addView(new View(this),1,dp(y));}
    private void expand(LinearLayout r,View v){r.addView(v,new LinearLayout.LayoutParams(0,-2,1));}
    private Button button(String label,boolean primary,Runnable action){Button b=new Button(this);b.setText(label);b.setAllCaps(false);b.setTextSize(14);b.setTextColor(primary?forest:ink);b.setMinWidth(0);b.setMinimumWidth(0);b.setMinHeight(dp(44));b.setMinimumHeight(dp(44));b.setBackground(box(primary?gold:paper,10,!primary));pad(b,10,4);b.setOnClickListener(v->action.run());return b;}
    private void action(LinearLayout l,String name,boolean primary,Runnable run){gap(l,6);l.addView(button(name,primary,run));}
    private LinearLayout card(LinearLayout parent,int color){LinearLayout c=col();c.setBackground(box(color,16,color!=forest));pad(c,16,16);parent.addView(c);gap(parent,12);return c;}
    private void render(){
        handler.removeCallbacks(clockTick);digits=null;shownUntil=state.until;
        root=col();root.setBackgroundColor(bg);root.setOnApplyWindowInsetsListener((v,i)->{v.setPadding(i.getSystemWindowInsetLeft(),i.getSystemWindowInsetTop(),i.getSystemWindowInsetRight(),i.getSystemWindowInsetBottom());return i;});
        if(Build.VERSION.SDK_INT<35)getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        getWindow().setStatusBarColor(forest);getWindow().setNavigationBarColor(forest);setContentView(root);
        LinearLayout head=row();pad(head,14,7);head.setBackgroundColor(forest);root.addView(head);
        ImageView logo=new ImageView(this);logo.setImageResource(R.drawable.scholar);logo.setContentDescription("Boy studying under a streetlight");head.addView(logo,dp(39),dp(39));
        TextView brand=heading(" Padikkalam.lk",22,ivory);expand(head,brand);
        Button settings=button("Settings",false,this::settings);head.addView(settings);
        ScrollView scroll=new ScrollView(this);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));content=col();pad(content,15,16);scroll.addView(content);
        if(screen.equals("Planner"))planner();else if(screen.equals("Library"))library();else focus();
        TextView credit=text("Designed by Hamoodh Mohideen",12,muted,false);credit.setGravity(Gravity.CENTER);pad(credit,0,10);content.addView(credit);
        nav=row();nav.setBackgroundColor(paper);pad(nav,6,5);root.addView(nav);
        for(String name:TABS){Button b=button(name,screen.equals(name),()->{screen=name;render();});b.setSelected(screen.equals(name));expand(nav,b);}
        if(active&&state.until>0)handler.postDelayed(clockTick,500);
    }
    private void focus(){
        content.addView(heading("Study monitor",32,ink));gap(content,10);
        LinearLayout c=card(content,forest);c.addView(text("POMODORO TIMER",12,0xffead388,true));
        TextView phase=heading(state.mode,25,ivory);c.addView(phase);digits=heading("",64,ivory);digits.setGravity(Gravity.CENTER);c.addView(digits);updateDigits(System.currentTimeMillis());
        TextView label=text(state.label.isEmpty()?"Independent study":state.label,15,ivory,false);label.setGravity(Gravity.CENTER);c.addView(label);
        action(c,state.until>0?"Pause":state.remaining<state.length*StudyState.MIN?"Resume":"Start "+state.mode.toLowerCase(Locale.ROOT),true,()->{if(state.until>0)state.pause();else state.start();render();});
        LinearLayout tools=row();gap(c,6);c.addView(tools);expand(tools,button("Change phase",false,()->{if(state.until>0){tip("Pause the timer first.");return;}String[] modes={StudyState.FOCUS,StudyState.SHORT,StudyState.LONG};new AlertDialog.Builder(this).setTitle("Choose a phase").setItems(modes,(dialog,i)->{state.choose(modes[i]);state.saveAndArm();render();}).show();}));
        expand(tools,button("Reset",false,()->{state.choose(state.mode);state.label="";state.saveAndArm();render();}));
        String today=LocalDate.now().toString();gap(c,12);c.addView(text(state.counts.getOrDefault(today,0)+" focus sessions today  ·  "+state.totals.getOrDefault(today,0)+" min",14,ivory,false));
        LinearLayout day=card(content,paper);day.addView(heading("Today’s agenda",23,ink));rows(day,LocalDate.now(),false);
        action(day,"Plan a study block",false,()->blockForm(null,LocalDate.now()));
    }
    private void updateDigits(long now){if(digits==null)return;long seconds=(state.left(now)+999)/1000;digits.setText(String.format(Locale.ROOT,"%02d:%02d",seconds/60,seconds%60));}
    private void planner(){
        content.addView(heading("Study calendar",32,ink));content.addView(text(ZoneId.systemDefault().getId().replace('_',' '),14,muted,false));gap(content,10);
        LinearLayout c=card(content,paper);LinearLayout days=row();c.addView(days);
        expand(days,button("Previous",false,()->{selected=selected.minusWeeks(1);render();}));
        expand(days,button("Pick date",false,()->datePicker(selected,v->{selected=v;render();})));
        expand(days,button("Next",false,()->{selected=selected.plusWeeks(1);render();}));
        LocalDate mon=selected.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));gap(c,7);HorizontalScrollView strip=new HorizontalScrollView(this);LinearLayout week=row();strip.addView(week);c.addView(strip);
        for(int i=0;i<7;i++){LocalDate d=mon.plusDays(i);week.addView(button(d.format(DateTimeFormatter.ofPattern("EEE d",Locale.ENGLISH)),d.equals(selected),()->{selected=d;render();}));}
        gap(c,12);c.addView(heading(selected.format(DateTimeFormatter.ofPattern("EEEE, d MMMM",Locale.ENGLISH)),23,ink));rows(c,selected,true);action(c,"Add study block",true,()->blockForm(null,selected));
        LinearLayout x=card(content,paper);x.addView(heading("Transfer a calendar",22,ink));x.addView(text("Import a Padikkalam .ics export, or save your phone’s blocks as a calendar file.",14,muted,false));
        action(x,"Import study blocks",false,this::importFile);
        if(!state.blocks.isEmpty())action(x,"Export calendar",false,this::exportFile);
        action(x,"Reminder settings",false,this::settings);
    }
    private void rows(LinearLayout parent,LocalDate date,boolean edit){
        List<Block> schedule=new ArrayList<>();for(Block b:state.blocks.values())if(b.occurs(date))schedule.add(b);
        schedule.sort(Comparator.comparing(b->b.start));
        if(schedule.isEmpty()){gap(parent,6);parent.addView(text("No study blocks planned for this day.",15,muted,false));return;}
        int[] hues={0xffa67a09,0xff3d835a,0xff4980a8,0xff8562a2,0xffb16678};
        for(Block b:schedule){gap(parent,10);LinearLayout r=row();parent.addView(r);View bar=new View(this);bar.setBackgroundColor(hues[Block.COLORS.indexOf(b.color)]);r.addView(bar,dp(4),dp(52));LinearLayout lines=col();pad(lines,8,0);expand(r,lines);lines.addView(text(b.title,16,ink,true));lines.addView(text(b.start+" – "+b.end+" · "+b.pattern(),13,muted,false));if(edit)r.addView(button("Edit",false,()->blockForm(b,date)));else r.addView(button("Focus",false,()->{if(state.until>0){tip("Pause the current timer first.");return;}state.choose(StudyState.FOCUS);state.label=b.title;state.start();screen="Focus";render();}));}
    }
    private interface DateChoice {void pick(LocalDate d);}
    private void datePicker(LocalDate d,DateChoice output){new DatePickerDialog(this,(v,y,m,dd)->output.pick(LocalDate.of(y,m+1,dd)),d.getYear(),d.getMonthValue()-1,d.getDayOfMonth()).show();}
    private void tip(String v){Toast.makeText(this,v,Toast.LENGTH_LONG).show();}
    private ScrollView formScroll(LinearLayout fields){ScrollView pane=new ScrollView(this);pad(fields,18,8);pane.addView(fields);return pane;}
    private Spinner select(LinearLayout box,String label,String[] options,int index){gap(box,8);box.addView(text(label,14,muted,true));Spinner s=new Spinner(this);ArrayAdapter<String> a=new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,options);s.setAdapter(a);s.setSelection(index);box.addView(s);return s;}
    private EditText field(LinearLayout parent,String label,String value,boolean number){gap(parent,8);parent.addView(text(label,14,muted,true));EditText e=new EditText(this);e.setSingleLine();e.setTextSize(16);e.setInputType(number?InputType.TYPE_CLASS_NUMBER:InputType.TYPE_CLASS_TEXT);e.setText(value);parent.addView(e);return e;}
    private void timePicker(LocalTime t,java.util.function.Consumer<LocalTime> out){new TimePickerDialog(this,(v,h,m)->out.accept(LocalTime.of(h,m)),t.getHour(),t.getMinute(),true).show();}
    private void blockForm(Block old,LocalDate initial){
        LinearLayout f=col();EditText title=field(f,"Block title",old==null?"":old.title,false);title.setHint("Physics MCQ practice");
        LocalDate[] date={old==null?initial:old.first};LocalTime[] times={old==null?LocalTime.of(9,0):old.start,old==null?LocalTime.of(10,0):old.end};
        Button dateButton=button("Date  "+date[0],false,()->{});dateButton.setOnClickListener(v->datePicker(date[0],d->{date[0]=d;dateButton.setText("Date  "+d);}));gap(f,6);f.addView(dateButton);
        LinearLayout t=row();f.addView(t);for(int i=0;i<2;i++){final int ix=i;String prefix=i==0?"Start  ":"End  ";Button b=button(prefix+times[i],false,()->{});b.setOnClickListener(v->timePicker(times[ix],n->{times[ix]=n;b.setText(prefix+n);}));expand(t,b);}
        String[] repeats={"Once","Daily","Weekdays","Weekly on start day","Custom days"};
        int mask=old==null?0:old.days;int repeat=mask==0?0:mask==127?1:mask==31?2:mask==Block.bit(date[0])?3:4;
        Spinner rep=select(f,"Repeat",repeats,repeat);
        LinearLayout checks=col();f.addView(checks);CheckBox[] boxes=new CheckBox[7];String[] labels={"Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"};
        for(int i=0;i<7;i++){boxes[i]=new CheckBox(this);boxes[i].setText(labels[i]);boxes[i].setChecked((mask&(1<<i))!=0);checks.addView(boxes[i]);}
        checks.setVisibility(repeat==4?View.VISIBLE:View.GONE);
        rep.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){public void onItemSelected(AdapterView<?> p,View v,int i,long id){checks.setVisibility(i==4?View.VISIBLE:View.GONE);}public void onNothingSelected(AdapterView<?> p){}});
        int[] mins={-1,0,5,10,15,30};int rem=old==null?10:old.reminder,index=0;for(int i=0;i<mins.length;i++)if(mins[i]==rem)index=i;
        Spinner reminder=select(f,"Reminder",new String[]{"None","At start","5 minutes before","10 minutes before","15 minutes before","30 minutes before"},index);
        Spinner color=select(f,"Colour",Block.COLORS.toArray(new String[0]),old==null?0:Block.COLORS.indexOf(old.color));
        if(old!=null && old.days!=0)f.addView(text("Edits apply to the entire series.",13,muted,false));
        AlertDialog.Builder builder=new AlertDialog.Builder(this).setTitle(old==null?"New study block":"Edit study block").setView(formScroll(f)).setPositiveButton("Save",null).setNegativeButton("Cancel",null);
        if(old!=null)builder.setNeutralButton("Remove",(dlg,w)->new AlertDialog.Builder(this).setTitle("Remove this study block?").setMessage(old.title+" · "+old.pattern()).setNegativeButton("Cancel",null).setPositiveButton("Remove",(d,i)->{state.blocks.remove(old.id);state.saveAndArm();render();}).show());
        AlertDialog dialog=builder.create();dialog.show();dialog.getButton(-1).setOnClickListener(v->{try{
            int selectedDays=rep.getSelectedItemPosition(),days=selectedDays==0?0:selectedDays==1?127:selectedDays==2?31:selectedDays==3?Block.bit(date[0]):0;
            if(selectedDays==4){for(int i=0;i<7;i++)if(boxes[i].isChecked())days|=1<<i;if(days==0)throw new IllegalArgumentException("Select a repeat day.");}
            Block b=new Block(old==null?UUID.randomUUID().toString():old.id,title.getText().toString(),date[0],times[0],times[1],days,mins[reminder.getSelectedItemPosition()],(String)color.getSelectedItem());
            state.tick(false);state.blocks.put(b.id,b);state.saveAndArm();selected=date[0];dialog.dismiss();render();
            if(b.reminder>=0 && (!state.alerts || !state.permitted()))tip("Enable notifications in Settings to receive reminders.");
        }catch(IllegalArgumentException e){tip(e.getMessage());}});
    }
    private void library(){
        content.addView(heading("Study library",32,ink));gap(content,10);
        LinearLayout library=card(content,forest);library.addView(heading("Notes for your next lesson",25,ivory));library.addView(text("Use your signed-in browser for notes, uploads and account settings.",15,ivory,false));action(library,"Browse notes",true,()->website("/"));action(library,"Upload a note",false,()->website("/upload"));action(library,"My uploads",false,()->website("/my-uploads"));action(library,"Ask the study tutor",false,()->website("/tutor"));action(library,"Explore study resources",false,()->website("/explore"));
        LinearLayout about=card(content,paper);about.addView(heading("Padikkalam.lk",23,ink));action(about,"My account",false,()->website("/login"));action(about,"Our vision",false,()->website("/vision"));action(about,"App updates",false,this::updates);
    }
    private void updates(){new AlertDialog.Builder(this).setTitle("Padikkalam.lk · Android 1.0.0").setMessage("Includes an offline Pomodoro, recurring time blocks, calendar transfer and Android reminders. The website’s opening notice carries the owner’s latest announcements.").setPositiveButton("Open website", (d,w)->website("/")).setNegativeButton("Close",null).show();}
    private void website(String path){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(state.storage.getString("site",SITE)+path)));}catch(ActivityNotFoundException e){tip("Install a web browser to open the online library.");}}
    private void settings(){
        LinearLayout f=col();Spinner theme=select(f,"Theme",new String[]{"System","Light","Dark"},Arrays.asList("System","Light","Dark").indexOf(state.theme));
        EditText a=field(f,"Focus length (minutes)",""+state.focus,true), b=field(f,"Short break (minutes)",""+state.brief,true), c=field(f,"Long break (minutes)",""+state.longer,true);
        EditText host=field(f,"Website address",state.storage.getString("site",SITE),false);host.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI);
        gap(f,12);f.addView(text("After four focus sessions, a long break is ready.",14,muted,false));
        Button alerts=button(state.alerts&&state.permitted()?"Turn off notifications":"Enable notifications",false,()->{});gap(f,8);f.addView(alerts);
        alerts.setOnClickListener(v->{if(state.alerts&&state.permitted()){state.alerts=false;state.saveAndArm();alerts.setText("Enable notifications");}else{
            if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
                if(getPreferences(0).getBoolean("asked",false)&&!shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)){systemNotifications();return;}
                getPreferences(0).edit().putBoolean("asked",true).apply();requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},5);
            }else if(!state.permitted())systemNotifications();else{state.alerts=true;state.lastCheck=System.currentTimeMillis();state.saveAndArm();alerts.setText("Turn off notifications");}
        }});
        if(Build.VERSION.SDK_INT>=31 && !state.precise()){f.addView(text("Android may delay alerts in battery-saving mode. Allow precise timing for time-sensitive reminders.",13,muted,false));action(f,"Timing permission",false,()->{try{startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getPackageName())));}catch(ActivityNotFoundException e){tip("Alarms & reminders is managed in Android settings.");}});}
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Study settings").setView(formScroll(f)).setPositiveButton("Save",null).setNegativeButton("Close",null).create();dialog.show();
        dialog.getButton(-1).setOnClickListener(v->{try{int focus=Integer.parseInt(a.getText().toString()),brief=Integer.parseInt(b.getText().toString()),longer=Integer.parseInt(c.getText().toString());
            if(Math.min(focus,Math.min(brief,longer))<1||Math.max(focus,Math.max(brief,longer))>240)throw new NumberFormatException();
            String site=host.getText().toString().trim().replaceAll("/+$","");Uri origin=Uri.parse(site);
            if(!"https".equals(origin.getScheme())||origin.getHost()==null||origin.getEncodedUserInfo()!=null||origin.getQuery()!=null||origin.getFragment()!=null){host.setError("Enter the HTTPS address of your Padikkalam website.");return;}
            state.storage.edit().putString("site",site).apply();
            boolean idle=state.until==0&&state.remaining==state.length*StudyState.MIN;state.focus=focus;state.brief=brief;state.longer=longer;if(idle)state.choose(state.mode);
            String chosen=(String)theme.getSelectedItem();boolean changed=!state.theme.equals(chosen);state.theme=chosen;state.saveAndArm();dialog.dismiss();if(changed)recreate();else render();
        }catch(NumberFormatException ex){tip("Enter 1 to 240 minutes for each phase.");}});
    }
    private void systemNotifications(){try{startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()));}catch(ActivityNotFoundException e){tip("Open Android notification settings for Padikkalam.lk.");}}
    @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){super.onRequestPermissionsResult(code,permissions,results);if(code==5&&results.length>0){state.alerts=results[0]==PackageManager.PERMISSION_GRANTED;state.lastCheck=System.currentTimeMillis();state.saveAndArm();tip(state.alerts?"Study notifications enabled.":"Study notifications are off.");}}
    private void importFile(){Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");try{startActivityForResult(i,11);}catch(ActivityNotFoundException e){tip("No file picker available.");}}
    private void exportFile(){Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("text/calendar").putExtra(Intent.EXTRA_TITLE,"Padikkalam-study-blocks.ics");try{startActivityForResult(i,12);}catch(ActivityNotFoundException e){tip("No file picker available.");}}
    @Override public void onActivityResult(int code,int result,Intent data){super.onActivityResult(code,result,data);if(result!=RESULT_OK||data==null||data.getData()==null)return;
        Uri uri=data.getData();try{
            if(code==12){try(OutputStream out=getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new IOException();out.write(CalendarTransfer.write(state.blocks.values()).getBytes(StandardCharsets.UTF_8));}tip("Calendar exported.");}
            if(code==11){ByteArrayOutputStream buf=new ByteArrayOutputStream();try(InputStream in=getContentResolver().openInputStream(uri)){if(in==null)throw new IOException();byte[] chunk=new byte[8192];int n;while((n=in.read(chunk))!=-1){if(buf.size()+n>1024*1024)throw new IllegalArgumentException("Choose a calendar smaller than 1 MB.");buf.write(chunk,0,n);}}
                List<Block> blocks=CalendarTransfer.read(buf.toString("UTF-8"));int updates=0;for(Block b:blocks)if(state.blocks.containsKey(b.id))updates++;
                new AlertDialog.Builder(this).setTitle("Import study blocks?").setMessage((blocks.size()-updates)+" new · "+updates+" existing blocks will be updated. Other blocks stay in your planner.").setNegativeButton("Cancel",null).setPositiveButton("Import",(dlg,w)->{state.tick(false);for(Block b:blocks)state.blocks.put(b.id,b);state.saveAndArm();selected=blocks.get(0).first;screen="Planner";render();tip("Study blocks imported.");}).show();
            }
        }catch(Exception e){tip(code==11?"Could not import this file. Choose a Padikkalam .ics export.":"Could not save the calendar file.");}}
}
