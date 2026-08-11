import Foundation
import Combine

/// App-wide preferences: goals and display units.
///
/// These are a handful of scalars, so they live in `UserDefaults` rather than
/// SwiftData — no singleton row to fetch and keep unique. Injected once from
/// `FitTrackApp` and read with `@EnvironmentObject`.
final class UserSettings: ObservableObject {

    private enum Key {
        static let calorieGoal = "calorieGoal"
        static let proteinGoal = "proteinGoal"
        static let carbsGoal = "carbsGoal"
        static let fatGoal = "fatGoal"
        static let macroGoalsEnabled = "macroGoalsEnabled"
        static let weightUnit = "weightUnit"
        static let distanceUnit = "distanceUnit"
        static let weightGoalKg = "weightGoalKg"
    }

    private let defaults: UserDefaults

    @Published var calorieGoal: Int { didSet { defaults.set(calorieGoal, forKey: Key.calorieGoal) } }
    @Published var proteinGoal: Int { didSet { defaults.set(proteinGoal, forKey: Key.proteinGoal) } }
    @Published var carbsGoal: Int { didSet { defaults.set(carbsGoal, forKey: Key.carbsGoal) } }
    @Published var fatGoal: Int { didSet { defaults.set(fatGoal, forKey: Key.fatGoal) } }

    /// Macro goals are optional — when off, the UI shows macro totals without
    /// progress bars or a "remaining" number.
    @Published var macroGoalsEnabled: Bool { didSet { defaults.set(macroGoalsEnabled, forKey: Key.macroGoalsEnabled) } }

    @Published var weightUnit: WeightUnit { didSet { defaults.set(weightUnit.rawValue, forKey: Key.weightUnit) } }
    @Published var distanceUnit: DistanceUnit { didSet { defaults.set(distanceUnit.rawValue, forKey: Key.distanceUnit) } }

    /// Target body weight in kilograms. Zero means "no goal set".
    @Published var weightGoalKg: Double { didSet { defaults.set(weightGoalKg, forKey: Key.weightGoalKg) } }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults

        let storedCalories = defaults.integer(forKey: Key.calorieGoal)
        self.calorieGoal = storedCalories > 0 ? storedCalories : 2200

        let storedProtein = defaults.integer(forKey: Key.proteinGoal)
        self.proteinGoal = storedProtein > 0 ? storedProtein : 150

        let storedCarbs = defaults.integer(forKey: Key.carbsGoal)
        self.carbsGoal = storedCarbs > 0 ? storedCarbs : 220

        let storedFat = defaults.integer(forKey: Key.fatGoal)
        self.fatGoal = storedFat > 0 ? storedFat : 70

        self.macroGoalsEnabled = defaults.object(forKey: Key.macroGoalsEnabled) as? Bool ?? true

        self.weightUnit = (defaults.string(forKey: Key.weightUnit).flatMap(WeightUnit.init(rawValue:))) ?? .kilograms
        self.distanceUnit = (defaults.string(forKey: Key.distanceUnit).flatMap(DistanceUnit.init(rawValue:))) ?? .kilometers
        self.weightGoalKg = defaults.double(forKey: Key.weightGoalKg)
    }

    /// Goals bundled up for the nutrition math helpers.
    var nutritionGoals: NutritionGoals {
        NutritionGoals(
            calories: Double(calorieGoal),
            protein: macroGoalsEnabled ? Double(proteinGoal) : nil,
            carbs: macroGoalsEnabled ? Double(carbsGoal) : nil,
            fat: macroGoalsEnabled ? Double(fatGoal) : nil
        )
    }

    // MARK: - Unit helpers

    func displayWeight(_ kilograms: Double) -> Double { weightUnit.fromKilograms(kilograms) }
    func storageWeight(_ displayValue: Double) -> Double { weightUnit.toKilograms(displayValue) }

    func displayDistance(_ kilometers: Double) -> Double { distanceUnit.fromKilometers(kilometers) }
    func storageDistance(_ displayValue: Double) -> Double { distanceUnit.toKilometers(displayValue) }

    func formattedWeight(_ kilograms: Double, decimals: Int = 1) -> String {
        Format.number(displayWeight(kilograms), decimals: decimals) + " " + weightUnit.abbreviation
    }

    func formattedDistance(_ kilometers: Double, decimals: Int = 2) -> String {
        Format.number(displayDistance(kilometers), decimals: decimals) + " " + distanceUnit.abbreviation
    }

    func resetToDefaults() {
        calorieGoal = 2200
        proteinGoal = 150
        carbsGoal = 220
        fatGoal = 70
        macroGoalsEnabled = true
        weightUnit = .kilograms
        distanceUnit = .kilometers
        weightGoalKg = 0
    }
}
