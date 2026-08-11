import Foundation
import SwiftData

/// A reusable "custom food" — the saved library you pick from so you don't
/// retype the same yoghurt every morning.
///
/// Nutrition is stored *per serving*. A `FoodEntry` copies these numbers when
/// it is logged, so editing or deleting a `Food` never rewrites history.
@Model
final class Food {
    var name: String = ""
    /// Free text describing one serving, e.g. "100 g", "1 cup", "1 slice".
    var servingDescription: String = ""
    var calories: Double = 0
    var protein: Double = 0
    var carbs: Double = 0
    var fat: Double = 0
    var createdAt: Date = Date()
    /// Used to sort the library by "recently used" first.
    var lastUsedAt: Date?
    var useCount: Int = 0

    init(
        name: String = "",
        servingDescription: String = "",
        calories: Double = 0,
        protein: Double = 0,
        carbs: Double = 0,
        fat: Double = 0,
        createdAt: Date = Date(),
        lastUsedAt: Date? = nil,
        useCount: Int = 0
    ) {
        self.name = name
        self.servingDescription = servingDescription
        self.calories = calories
        self.protein = protein
        self.carbs = carbs
        self.fat = fat
        self.createdAt = createdAt
        self.lastUsedAt = lastUsedAt
        self.useCount = useCount
    }

    /// Calories implied by the macros, useful as a sanity hint in the editor.
    var caloriesFromMacros: Double {
        protein * 4 + carbs * 4 + fat * 9
    }

    func markUsed(at date: Date = Date()) {
        lastUsedAt = date
        useCount += 1
    }
}
