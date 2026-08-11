import Foundation

/// Small formatting helpers used across the UI. Kept in one place so numbers
/// look the same everywhere.
enum Format {

    /// A plain number with a fixed number of decimals, trailing zeros trimmed.
    /// `Format.number(72.50)` → "72.5", `Format.number(72.0)` → "72".
    static func number(_ value: Double, decimals: Int = 1) -> String {
        guard value.isFinite else { return "0" }
        let rounded = (value * pow(10, Double(decimals))).rounded() / pow(10, Double(decimals))
        if rounded == rounded.rounded() {
            return String(Int(rounded))
        }
        return String(format: "%.\(decimals)f", rounded)
    }

    /// Calories are always whole numbers in the UI.
    static func calories(_ value: Double) -> String {
        guard value.isFinite else { return "0" }
        return String(Int(value.rounded()))
    }

    /// Grams with at most one decimal, e.g. "142 g" / "12.5 g".
    static func grams(_ value: Double) -> String {
        number(value, decimals: 1) + " g"
    }

    /// "45 min" / "1h 20m".
    static func duration(minutes: Double) -> String {
        let total = Int(minutes.rounded())
        if total < 60 { return "\(total) min" }
        let hours = total / 60
        let remainder = total % 60
        return remainder == 0 ? "\(hours)h" : "\(hours)h \(remainder)m"
    }

    /// Distance in kilometres, formatted in kilometres. Views that respect the
    /// user's unit preference should use `UserSettings.formattedDistance`.
    static func distance(kilometers: Double) -> String {
        number(kilometers, decimals: 2) + " km"
    }

    /// Weight in kilograms, unconverted. Prefer `UserSettings.formattedWeight`.
    static func weight(kilograms: Double) -> String {
        number(kilograms, decimals: 1) + " kg"
    }

    /// Servings: "1", "1.5", "0.75".
    static func servings(_ value: Double) -> String {
        number(value, decimals: 2)
    }

    /// Percentage as a whole number, e.g. "83%".
    static func percent(_ fraction: Double) -> String {
        "\(Int((fraction * 100).rounded()))%"
    }

    /// Signed delta, e.g. "+1.2" / "−0.8" (true minus sign, reads better).
    static func signedNumber(_ value: Double, decimals: Int = 1) -> String {
        let magnitude = number(abs(value), decimals: decimals)
        if abs(value) < pow(10, -Double(decimals)) / 2 { return magnitude }
        return (value > 0 ? "+" : "−") + magnitude
    }
}
