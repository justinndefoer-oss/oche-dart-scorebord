import Foundation

/// Calories + macros for some set of entries.
struct NutritionTotals: Equatable {
    var calories: Double = 0
    var protein: Double = 0
    var carbs: Double = 0
    var fat: Double = 0

    static let zero = NutritionTotals()

    static func + (lhs: NutritionTotals, rhs: NutritionTotals) -> NutritionTotals {
        NutritionTotals(
            calories: lhs.calories + rhs.calories,
            protein: lhs.protein + rhs.protein,
            carbs: lhs.carbs + rhs.carbs,
            fat: lhs.fat + rhs.fat
        )
    }
}

/// Daily targets. Macro targets are optional (see `UserSettings.macroGoalsEnabled`).
struct NutritionGoals: Equatable {
    var calories: Double
    var protein: Double?
    var carbs: Double?
    var fat: Double?
}

/// Pure aggregation over food entries. No SwiftUI, no SwiftData queries — the
/// views fetch, these functions do the arithmetic.
enum NutritionMath {

    static func totals(for entries: [FoodEntry]) -> NutritionTotals {
        entries.reduce(into: NutritionTotals.zero) { totals, entry in
            totals.calories += entry.calories
            totals.protein += entry.protein
            totals.carbs += entry.carbs
            totals.fat += entry.fat
        }
    }

    /// Entries bucketed by meal, each bucket sorted by time.
    static func groupedByMeal(_ entries: [FoodEntry]) -> [(meal: MealCategory, entries: [FoodEntry])] {
        MealCategory.allCases
            .sorted { $0.sortIndex < $1.sortIndex }
            .map { meal in
                (meal, entries.filter { $0.meal == meal }.sorted { $0.date < $1.date })
            }
    }

    /// Entries bucketed by day, most recent day first.
    static func groupedByDay(_ entries: [FoodEntry]) -> [(day: Date, entries: [FoodEntry])] {
        Dictionary(grouping: entries) { $0.dayKey }
            .map { (day: $0.key, entries: $0.value.sorted { $0.date < $1.date }) }
            .sorted { $0.day > $1.day }
    }

    /// Fraction of a goal that has been consumed, clamped to 0 for a
    /// non-positive goal. Values above 1 are allowed so the UI can show
    /// "over goal".
    static func progress(_ value: Double, goal: Double?) -> Double {
        guard let goal, goal > 0 else { return 0 }
        return max(0, value / goal)
    }

    /// Calories still available today. Negative when over the goal.
    static func remaining(_ value: Double, goal: Double) -> Double {
        goal - value
    }

    /// Share of calories coming from each macro, for the split bar.
    /// Returns zeros when nothing has been logged.
    static func macroSplit(_ totals: NutritionTotals) -> (protein: Double, carbs: Double, fat: Double) {
        let proteinCalories = totals.protein * 4
        let carbCalories = totals.carbs * 4
        let fatCalories = totals.fat * 9
        let sum = proteinCalories + carbCalories + fatCalories
        guard sum > 0 else { return (0, 0, 0) }
        return (proteinCalories / sum, carbCalories / sum, fatCalories / sum)
    }
}
