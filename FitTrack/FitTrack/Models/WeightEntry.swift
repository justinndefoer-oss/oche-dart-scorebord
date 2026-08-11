import Foundation
import SwiftData

/// A body-weight reading. Always stored in kilograms; `UserSettings.weightUnit`
/// decides what the UI shows.
@Model
final class WeightEntry {
    var weightKg: Double = 0
    var date: Date = Date()
    /// `date` truncated to midnight — one "official" reading per day is the
    /// common case, and this makes charting and de-duping straightforward.
    var dayKey: Date = Date()
    var note: String = ""

    init(weightKg: Double = 0, date: Date = Date(), note: String = "") {
        self.weightKg = weightKg
        self.date = date
        self.dayKey = Calendar.current.startOfDay(for: date)
        self.note = note
    }

    func setDate(_ newDate: Date) {
        date = newDate
        dayKey = Calendar.current.startOfDay(for: newDate)
    }
}
