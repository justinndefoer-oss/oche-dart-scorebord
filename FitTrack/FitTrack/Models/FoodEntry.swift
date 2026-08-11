import Foundation
import SwiftData

/// One logged food, on one day, in one meal.
///
/// Nutrition is denormalised (copied from the `Food` at log time) so history
/// stays accurate even if the source food is later edited or deleted.
@Model
final class FoodEntry {
    var name: String = ""
    /// Raw value of `MealCategory`. See the note in `Enums.swift`.
    var mealRaw: String = MealCategory.breakfast.rawValue
    var servings: Double = 1

    var caloriesPerServing: Double = 0
    var proteinPerServing: Double = 0
    var carbsPerServing: Double = 0
    var fatPerServing: Double = 0

    /// Exact time the entry is for (used for ordering within a day).
    var date: Date = Date()
    /// `date` truncated to midnight in the current calendar — the grouping key
    /// for "browse by day" and for daily totals.
    var dayKey: Date = Date()

    /// Optional link back to the library food this came from. Nullified rather
    /// than cascaded: deleting a library food must not delete your history.
    @Relationship(deleteRule: .nullify)
    var food: Food?

    init(
        name: String = "",
        meal: MealCategory = .breakfast,
        servings: Double = 1,
        caloriesPerServing: Double = 0,
        proteinPerServing: Double = 0,
        carbsPerServing: Double = 0,
        fatPerServing: Double = 0,
        date: Date = Date(),
        food: Food? = nil
    ) {
        self.name = name
        self.mealRaw = meal.rawValue
        self.servings = servings
        self.caloriesPerServing = caloriesPerServing
        self.proteinPerServing = proteinPerServing
        self.carbsPerServing = carbsPerServing
        self.fatPerServing = fatPerServing
        self.date = date
        self.dayKey = Calendar.current.startOfDay(for: date)
        self.food = food
    }

    var meal: MealCategory {
        get { MealCategory(rawValue: mealRaw) ?? .snack }
        set { mealRaw = newValue.rawValue }
    }

    /// Keeps `dayKey` in sync whenever the entry is moved to another day.
    func setDate(_ newDate: Date) {
        date = newDate
        dayKey = Calendar.current.startOfDay(for: newDate)
    }

    var calories: Double { caloriesPerServing * servings }
    var protein: Double { proteinPerServing * servings }
    var carbs: Double { carbsPerServing * servings }
    var fat: Double { fatPerServing * servings }

    /// Builds an entry from a library food, copying its nutrition across.
    static func from(
        food: Food,
        meal: MealCategory,
        servings: Double,
        date: Date = Date()
    ) -> FoodEntry {
        FoodEntry(
            name: food.name,
            meal: meal,
            servings: servings,
            caloriesPerServing: food.calories,
            proteinPerServing: food.protein,
            carbsPerServing: food.carbs,
            fatPerServing: food.fat,
            date: date,
            food: food
        )
    }
}
