import React from "react";
import { 
  CalendarDays, 
  ChevronRight, 
  Download, 
  ShieldCheck, 
  Clock, 
  AlertTriangle 
} from "lucide-react";
import { format, addDays } from "date-fns";
import { Document } from "../types";
import { cn } from "../lib/utils";

interface CalendarViewProps {
  documents: Document[];
  currentCalendarDate: Date;
  setCurrentCalendarDate: React.Dispatch<React.SetStateAction<Date>>;
  calendarFilter: any;
  setCalendarFilter: React.Dispatch<React.SetStateAction<any>>;
  setSelectedDoc: (doc: Document) => void;
  getStatus: (date: string) => string;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  documents,
  currentCalendarDate,
  setCurrentCalendarDate,
  calendarFilter,
  setCalendarFilter,
  setSelectedDoc,
  getStatus
}) => {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <CalendarDays size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <select 
                  value={currentCalendarDate.getMonth()}
                  onChange={(e) => setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), parseInt(e.target.value), 1))}
                  className="bg-transparent font-bold text-2xl outline-none cursor-pointer hover:text-blue-600 transition-colors"
                >
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i} value={i}>{format(new Date(2024, i, 1), "MMMM")}</option>
                  ))}
                </select>
                <select 
                  value={currentCalendarDate.getFullYear()}
                  onChange={(e) => setCurrentCalendarDate(new Date(parseInt(e.target.value), currentCalendarDate.getMonth(), 1))}
                  className="bg-transparent font-bold text-2xl outline-none cursor-pointer hover:text-blue-600 transition-colors"
                >
                  {Array.from({ length: 10 }).map((_, i) => {
                    const year = new Date().getFullYear() - 5 + i;
                    return <option key={year} value={year}>{year}</option>;
                  })}
                </select>
              </div>
              <p className="text-gray-500">Document Expiry Schedule</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-100">
              <button 
                onClick={() => setCurrentCalendarDate(prev => addDays(prev, -30))}
                className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-600"
              >
                <ChevronRight size={20} className="rotate-180" />
              </button>
              <button 
                onClick={() => setCurrentCalendarDate(new Date())}
                className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-blue-600 transition-colors"
              >
                Today
              </button>
              <button 
                onClick={() => setCurrentCalendarDate(prev => addDays(prev, 30))}
                className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-600"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <button 
              onClick={() => {
                const icsContent = [
                  "BEGIN:VCALENDAR",
                  "VERSION:2.0",
                  ...documents.map(d => [
                    "BEGIN:VEVENT",
                    `SUMMARY:Expiry: ${d.title}`,
                    `DTSTART;VALUE=DATE:${d.expiryDate.replace(/-/g, '')}`,
                    `DESCRIPTION:Document ${d.title} is expiring.`,
                    "END:VEVENT"
                  ].join("\n")),
                  "END:VCALENDAR"
                ].join("\n");
                const blob = new Blob([icsContent], { type: 'text/calendar' });
                const url = URL.createObjectURL(blob);
                const a = window.document.createElement('a');
                a.href = url;
                a.download = 'doc_expiries.ics';
                a.click();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
            >
              <Download size={18} />
              Export .ics
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-2xl overflow-hidden shadow-inner">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-gray-50 p-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
          {Array.from({ length: 42 }).map((_, i) => {
            const monthStart = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), 1);
            const startDay = monthStart.getDay();
            const date = addDays(monthStart, i - startDay);
            const dateStr = format(date, "yyyy-MM-dd");
            const docsOnDate = documents.filter(d => {
              const matchesDate = d.expiryDate === dateStr;
              if (!matchesDate) return false;
              if (calendarFilter === 'All') return true;
              return getStatus(d.expiryDate) === calendarFilter;
            });
            const isToday = format(new Date(), "yyyy-MM-dd") === dateStr;
            const isCurrentMonth = date.getMonth() === currentCalendarDate.getMonth();

            return (
              <div key={i} className={cn(
                "bg-white min-h-[140px] p-3 space-y-2 transition-colors hover:bg-gray-50/50",
                !isCurrentMonth && "bg-gray-50/30 opacity-40",
                isToday && "bg-blue-50/30 ring-1 ring-inset ring-blue-100"
              )}>
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "text-sm font-bold",
                    isToday ? "text-blue-600" : isCurrentMonth ? "text-gray-700" : "text-gray-400"
                  )}>
                    {format(date, "d")}
                  </span>
                  {isToday && <span className="w-2 h-2 bg-blue-600 rounded-full shadow-sm shadow-blue-500/50"></span>}
                </div>
                <div className="space-y-1.5">
                  {docsOnDate.map(d => (
                    <div 
                      key={d.id} 
                      onClick={() => setSelectedDoc(d)}
                      className={cn(
                        "text-[10px] p-2 rounded-lg border truncate font-bold cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]",
                        getStatus(d.expiryDate) === 'Expired' ? "bg-red-50 text-red-700 border-red-100 shadow-sm shadow-red-500/10" :
                        getStatus(d.expiryDate) === 'Expiring Soon' ? "bg-amber-50 text-amber-700 border-amber-100 shadow-sm shadow-amber-500/10" :
                        "bg-green-50 text-green-700 border-green-100 shadow-sm shadow-green-500/10"
                      )}
                      title={`${d.title} expires on this date`}
                    >
                      {d.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm bg-gray-50 p-4 rounded-2xl border border-gray-100">
          <button 
            onClick={() => setCalendarFilter('All')}
            className={cn(
              "px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2",
              calendarFilter === 'All' ? "bg-gray-900 text-white shadow-lg" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
            )}
          >
            All
          </button>
          <button 
            onClick={() => setCalendarFilter('Safe')}
            className={cn(
              "px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2",
              calendarFilter === 'Safe' ? "bg-green-600 text-white shadow-lg" : "bg-white text-green-600 border border-green-200 hover:bg-green-50"
            )}
          >
            <ShieldCheck size={16} />
            Safe
          </button>
          <button 
            onClick={() => setCalendarFilter('Expiring Soon')}
            className={cn(
              "px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2",
              calendarFilter === 'Expiring Soon' ? "bg-amber-600 text-white shadow-lg" : "bg-white text-amber-600 border border-amber-200 hover:bg-amber-50"
            )}
          >
            <Clock size={16} />
            Expiring Soon
          </button>
          <button 
            onClick={() => setCalendarFilter('Expired')}
            className={cn(
              "px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2",
              calendarFilter === 'Expired' ? "bg-red-600 text-white shadow-lg" : "bg-white text-red-600 border border-red-200 hover:bg-red-50"
            )}
          >
            <AlertTriangle size={16} />
            Expired
          </button>
        </div>
      </div>
    </div>
  );
};
