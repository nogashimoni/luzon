export interface HebrewHoliday {
  title: string
  date: string      // YYYY-MM-DD
  endDate?: string  // YYYY-MM-DD exclusive (for multi-day holidays)
}

const holidays: HebrewHoliday[] = [
  // ===== 5786 (2025–2026) =====
  { title: 'ראש השנה', date: '2025-09-22', endDate: '2025-09-24' },
  { title: 'יום כיפור', date: '2025-10-01', endDate: '2025-10-02' },
  { title: 'סוכות', date: '2025-10-06', endDate: '2025-10-14' },
  { title: 'שמיני עצרת', date: '2025-10-13', endDate: '2025-10-14' },
  { title: 'שמחת תורה', date: '2025-10-14', endDate: '2025-10-15' },
  { title: 'חנוכה', date: '2025-12-14', endDate: '2025-12-23' },
  { title: 'ט"ו בשבט', date: '2026-02-01' },
  { title: 'פורים', date: '2026-03-05' },
  { title: 'פסח', date: '2026-04-01', endDate: '2026-04-09' },
  { title: 'יום השואה', date: '2026-04-16' },
  { title: 'יום הזיכרון', date: '2026-04-22' },
  { title: 'יום העצמאות', date: '2026-04-23' },
  { title: 'ל"ג בעומר', date: '2026-05-14' },
  { title: 'שבועות', date: '2026-05-21', endDate: '2026-05-23' },
  { title: 'תשעה באב', date: '2026-07-22' },

  // ===== 5787 (2026–2027) =====
  { title: 'ראש השנה', date: '2026-09-11', endDate: '2026-09-13' },
  { title: 'יום כיפור', date: '2026-09-20', endDate: '2026-09-21' },
  { title: 'סוכות', date: '2026-09-25', endDate: '2026-10-03' },
  { title: 'שמיני עצרת', date: '2026-10-02', endDate: '2026-10-03' },
  { title: 'שמחת תורה', date: '2026-10-03', endDate: '2026-10-04' },
  { title: 'חנוכה', date: '2026-12-04', endDate: '2026-12-13' },
  { title: 'ט"ו בשבט', date: '2027-02-11' },
  { title: 'פורים', date: '2027-03-23' },
  { title: 'פסח', date: '2027-04-20', endDate: '2027-04-28' },
  { title: 'יום השואה', date: '2027-05-05' },
  { title: 'יום הזיכרון', date: '2027-05-11' },
  { title: 'יום העצמאות', date: '2027-05-12' },
  { title: 'ל"ג בעומר', date: '2027-05-03' },
  { title: 'שבועות', date: '2027-06-09', endDate: '2027-06-11' },
  { title: 'תשעה באב', date: '2027-08-12' },
]

export function getHebrewHolidayEvents() {
  return holidays.map((h) => ({
    title: h.title,
    start: h.date,
    end: h.endDate ?? h.date,
    allDay: true,
    display: 'background' as const,
    backgroundColor: '#FEF3C7',
    extendedProps: { isHoliday: true },
  }))
}

export function getHebrewHolidayLabelEvents() {
  return holidays.map((h) => ({
    title: h.title,
    start: h.date,
    allDay: true,
    display: 'list-item' as const,
    color: '#D97706',
    textColor: '#D97706',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    classNames: ['holiday-label'],
    editable: false,
    extendedProps: { isHoliday: true },
  }))
}
