import Foundation

/// One day's calories, for the weekly bar chart.
struct DailyCaloriePoint: Identifiable, Equatable {
    var day: Date
    var calories: Double
    var id: Date { day }
}

/// One weight reading, for the line chart.
struct WeightPoint: Identifiable, Equatable {
    var day: Date
    var weightKg: Double
    var id: Date { day }
}

/// Turns raw model arrays into chart-ready series. Pure functions, so the
/// charts stay dumb and this stays easy to reason about.
enum TrendBuilder {

    /// Calories per day over the last `days` days, **including days with no
    /// entries** (as zero) so the bar chart keeps an even weekly rhythm.
    static func dailyCalories(
        from entries: [FoodEntry],
        days: Int = 7,
        endingOn end: Date = Date()
    ) -> [DailyCaloriePoint] {
        let window = DateRanges.lastDays(days, endingOn: end)
        guard let first = window.first else { return [] }

        var totals: [Date: Double] = [:]
        for entry in entries where entry.dayKey >= first {
            totals[entry.dayKey, default: 0] += entry.calories
        }
        return window.map { DailyCaloriePoint(day: $0, calories: totals[$0] ?? 0) }
    }

    /// Weight readings within the last `days` days, oldest first. Days without
    /// a reading are skipped — a line chart should not dip to zero.
    /// When a day has several readings the latest one wins.
    static func weightSeries(
        from entries: [WeightEntry],
        days: Int? = nil,
        endingOn end: Date = Date()
    ) -> [WeightPoint] {
        var candidates = entries
        if let days {
            let cutoff = end.startOfDay.adding(days: -(days - 1))
            candidates = candidates.filter { $0.dayKey >= cutoff }
        }

        var latestPerDay: [Date: WeightEntry] = [:]
        for entry in candidates {
            if let existing = latestPerDay[entry.dayKey], existing.date >= entry.date { continue }
            latestPerDay[entry.dayKey] = entry
        }
        return latestPerDay
            .map { WeightPoint(day: $0.key, weightKg: $0.value.weightKg) }
            .sorted { $0.day < $1.day }
    }

    /// Average of the non-empty days in a calorie series. Empty days are
    /// excluded so a half-logged week does not look artificially low.
    static func averageCalories(_ points: [DailyCaloriePoint]) -> Double {
        let logged = points.filter { $0.calories > 0 }
        guard !logged.isEmpty else { return 0 }
        return logged.reduce(0) { $0 + $1.calories } / Double(logged.count)
    }

    /// Change between the first and last reading of a weight series, in kg.
    static func weightChange(_ points: [WeightPoint]) -> Double? {
        guard let first = points.first, let last = points.last, points.count > 1 else { return nil }
        return last.weightKg - first.weightKg
    }

    /// Workouts bucketed by day, most recent first.
    static func workoutsByDay(_ workouts: [Workout]) -> [(day: Date, workouts: [Workout])] {
        Dictionary(grouping: workouts) { $0.dayKey }
            .map { (day: $0.key, workouts: $0.value.sorted { $0.date > $1.date }) }
            .sorted { $0.day > $1.day }
    }

    /// Number of days in the last `days` that have at least one workout.
    static func activeDayCount(_ workouts: [Workout], days: Int = 7, endingOn end: Date = Date()) -> Int {
        let window = Set(DateRanges.lastDays(days, endingOn: end))
        return Set(workouts.map(\.dayKey)).intersection(window).count
    }
}
