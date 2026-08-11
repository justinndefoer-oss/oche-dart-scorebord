import Foundation

extension Date {
    var startOfDay: Date { Calendar.current.startOfDay(for: self) }

    func adding(days: Int) -> Date {
        Calendar.current.date(byAdding: .day, value: days, to: self) ?? self
    }

    var isToday: Bool { Calendar.current.isDateInToday(self) }
    var isYesterday: Bool { Calendar.current.isDateInYesterday(self) }

    func isSameDay(as other: Date) -> Bool {
        Calendar.current.isDate(self, inSameDayAs: other)
    }

    /// "Today" / "Yesterday" / "Mon 4 Aug".
    var dayLabel: String {
        if isToday { return "Today" }
        if isYesterday { return "Yesterday" }
        return formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated))
    }

    /// "Today" / "Yesterday" / "Monday, 4 August 2026" — for screen titles.
    var longDayLabel: String {
        if isToday { return "Today" }
        if isYesterday { return "Yesterday" }
        return formatted(.dateTime.weekday(.wide).day().month(.wide).year())
    }

    /// "08:15" — used for entry timestamps.
    var timeLabel: String {
        formatted(date: .omitted, time: .shortened)
    }

    /// Single-letter-ish weekday for chart axes: "Mon".
    var shortWeekdayLabel: String {
        formatted(.dateTime.weekday(.abbreviated))
    }
}

enum DateRanges {
    /// The last `count` days ending today, oldest first, each at midnight.
    static func lastDays(_ count: Int, endingOn end: Date = Date()) -> [Date] {
        let lastDay = end.startOfDay
        return (0..<count).reversed().map { lastDay.adding(days: -$0) }
    }
}
