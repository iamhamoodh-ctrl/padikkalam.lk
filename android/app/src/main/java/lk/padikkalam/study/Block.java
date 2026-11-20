package lk.padikkalam.study;

import java.time.*;
import java.util.*;
import org.json.*;

final class Block {
    final String id, title, color;
    final LocalDate first;
    final LocalTime start, end;
    final int days, reminder;
    static final List<String> COLORS = Arrays.asList("Gold","Green","Blue","Purple","Rose");

    Block(String id, String title, LocalDate first, LocalTime start, LocalTime end,
          int days, int reminder, String color) {
        this.id = UUID.fromString(id).toString();
        this.title = title.trim();
        if (this.title.isEmpty() || this.title.length() > 120 || !end.isAfter(start)
                || days < 0 || days > 127 || !Arrays.asList(-1,0,5,10,15,30).contains(reminder)
                || !COLORS.contains(color)) throw new IllegalArgumentException("Check the title, times and reminder.");
        this.first=first; this.start=start.withSecond(0).withNano(0); this.end=end.withSecond(0).withNano(0);
        this.days=days; this.reminder=reminder; this.color=color;
    }
    static Block parse(JSONObject j) throws JSONException {
        return new Block(j.getString("id"),j.getString("title"),LocalDate.parse(j.getString("date")),
            LocalTime.parse(j.getString("start")),LocalTime.parse(j.getString("end")),
            j.getInt("days"),j.getInt("reminder"),j.getString("color"));
    }
    JSONObject json() throws JSONException {
        return new JSONObject().put("id",id).put("title",title).put("date",first.toString())
            .put("start",start.toString()).put("end",end.toString()).put("days",days)
            .put("reminder",reminder).put("color",color);
    }
    static int bit(LocalDate day) { return 1 << (day.getDayOfWeek().getValue()-1); }
    boolean occurs(LocalDate d) {
        return !d.isBefore(first) && (days==0 ? first.equals(d) : (days&bit(d))!=0);
    }
    long nextAfter(long after, ZoneId zone) {
        if (reminder<0) return Long.MAX_VALUE;
        LocalDate d = Instant.ofEpochMilli(after).atZone(zone).toLocalDate();
        if (d.isBefore(first)) d=first;
        for(int i=0;i<9;i++,d=d.plusDays(1)) {
            if(occurs(d)) {
                long alarm=d.atTime(start).atZone(zone).minusMinutes(reminder).toInstant().toEpochMilli();
                if (alarm>after) return alarm;
            }
        }
        return Long.MAX_VALUE;
    }
    String pattern() {
        if(days==0)return "Once";
        if(days==127)return "Daily";
        if(days==31)return "Weekdays";
        List<String> list=new ArrayList<>();
        String[] labels={"Mon","Tue","Wed","Thu","Fri","Sat","Sun"};
        for(int i=0;i<7;i++)if((days&(1<<i))!=0)list.add(labels[i]);
        return String.join(", ",list);
    }
}
