package lk.padikkalam.study;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.nio.charset.StandardCharsets;
final class CalendarTransfer {
    static final String[] DAYS={"MO","TU","WE","TH","FR","SA","SU"};
    static final DateTimeFormatter LOCAL=DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss",Locale.ROOT);
    static String escape(String s){return s.replace("\\","\\\\").replace("\n","\\n").replace(";","\\;").replace(",","\\,");}
    static String unescape(String s){
        StringBuilder b=new StringBuilder();for(int i=0;i<s.length();i++){
            char c=s.charAt(i);if(c=='\\'&&i+1<s.length()){c=s.charAt(++i);if(c=='n'||c=='N')c='\n';}b.append(c);
        }return b.toString();
    }
    static void line(StringBuilder out,String s){
        int width=0;for(int i=0;i<s.length();){int cp=s.codePointAt(i);String part=new String(Character.toChars(cp));int bytes=part.getBytes(StandardCharsets.UTF_8).length;
            if(width+bytes>74){out.append("\r\n ");width=1;}out.append(part);width+=bytes;i+=Character.charCount(cp);}
        out.append("\r\n");
    }
    static String write(Collection<Block> blocks){
        StringBuilder o=new StringBuilder();line(o,"BEGIN:VCALENDAR");line(o,"VERSION:2.0");line(o,"PRODID:-//Padikkalam.lk//Study planner//EN");line(o,"CALSCALE:GREGORIAN");
        for(Block b:blocks){LocalDate start=b.first;while(!b.occurs(start)) start=start.plusDays(1);
            line(o,"BEGIN:VEVENT");line(o,"UID:"+b.id+"@padikkalam.lk");line(o,"DTSTAMP:"+LOCAL.format(LocalDateTime.now(ZoneOffset.UTC))+"Z");
            line(o,"DTSTART:"+LOCAL.format(start.atTime(b.start)));line(o,"DTEND:"+LOCAL.format(start.atTime(b.end)));line(o,"SUMMARY:"+escape(b.title));
            line(o,"X-PADIKKALAM-COLOR:"+b.color);if(b.days==127)line(o,"RRULE:FREQ=DAILY");
            else if(b.days!=0){List<String> days=new ArrayList<>();for(int i=0;i<7;i++)if((b.days&(1<<i))!=0)days.add(DAYS[i]);line(o,"RRULE:FREQ=WEEKLY;BYDAY="+String.join(",",days));}
            if(b.reminder>=0){line(o,"BEGIN:VALARM");line(o,"TRIGGER:"+(b.reminder==0?"PT0M":"-PT"+b.reminder+"M"));line(o,"ACTION:DISPLAY");line(o,"DESCRIPTION:"+escape(b.title));line(o,"END:VALARM");}line(o,"END:VEVENT");}
        line(o,"END:VCALENDAR");return o.toString();
    }
    static List<Block> read(String input){
        if(!input.contains("BEGIN:VCALENDAR"))throw new IllegalArgumentException("Choose a Padikkalam .ics calendar export.");
        List<Block> result=new ArrayList<>();Map<String,String> fields=null;
        for(String s:input.replace("\r\n","\n").replaceAll("\n[ \\t]","").split("\n")){
            if(s.equals("BEGIN:VEVENT")){fields=new HashMap<>();continue;}if(fields==null)continue;
            if(s.equals("END:VEVENT")){result.add(event(fields));if(result.size()>1000)throw new IllegalArgumentException("Import up to 1,000 blocks at a time.");fields=null;continue;}
            int split=s.indexOf(':');if(split>0)fields.put(s.substring(0,split),s.substring(split+1));
        }
        if(fields!=null||result.isEmpty())throw new IllegalArgumentException("No complete study blocks were found.");return result;
    }
    static Block event(Map<String,String> m){
        String uid=m.getOrDefault("UID","");if(!uid.endsWith("@padikkalam.lk"))throw new IllegalArgumentException("Choose a calendar exported by Padikkalam.");
        LocalDateTime start=LocalDateTime.parse(m.get("DTSTART"),LOCAL),end=LocalDateTime.parse(m.get("DTEND"),LOCAL);
        if(!start.toLocalDate().equals(end.toLocalDate()))throw new IllegalArgumentException("Only same-day study blocks are supported.");
        String rule=m.getOrDefault("RRULE","");int days=0;
        if(rule.equals("FREQ=DAILY"))days=127;
        else if(rule.equals("FREQ=WEEKLY"))days=Block.bit(start.toLocalDate());
        else if(rule.startsWith("FREQ=WEEKLY;BYDAY=")){for(String d:rule.substring(18).split(",")){int i=Arrays.asList(DAYS).indexOf(d);if(i<0)throw new IllegalArgumentException("Unknown repeat day.");days|=1<<i;}}
        else if(!rule.isEmpty())throw new IllegalArgumentException("Unsupported recurrence.");
        String alarm=m.get("TRIGGER");int reminder=-1;
        if(alarm!=null){if(!alarm.matches("-?PT[0-9]+M"))throw new IllegalArgumentException("Unsupported reminder.");reminder=Integer.parseInt(alarm.replaceAll("[^0-9]",""));}
        String color=m.getOrDefault("X-PADIKKALAM-COLOR","Gold");if(!Block.COLORS.contains(color))color="Gold";
        return new Block(uid.substring(0,uid.indexOf('@')),unescape(m.getOrDefault("SUMMARY","Study block")),start.toLocalDate(),start.toLocalTime(),end.toLocalTime(),days,reminder,color);
    }
}
