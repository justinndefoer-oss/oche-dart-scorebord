import Foundation

/// Meal buckets a food entry can belong to.
///
/// Stored on `FoodEntry` as a raw `String` (`mealRaw`) rather than as an enum
/// property: SwiftData can persist `Codable` enums, but they are awkward to use
/// inside `#Predicate`. Raw strings keep the store and the predicates simple.
enum MealCategory: String, CaseIterable, Identifiable, Codable {
    case breakfast
    case lunch
    case dinner
    case snack

    var id: String { rawValue }

    var title: String {
        switch self {
        case .breakfast: return "Breakfast"
        case .lunch: return "Lunch"
        case .dinner: return "Dinner"
        case .snack: return "Snack"
        }
    }

    var symbolName: String {
        switch self {
        case .breakfast: return "sunrise"
        case .lunch: return "sun.max"
        case .dinner: return "moon"
        case .snack: return "carrot"
        }
    }

    /// Order used when listing a day's meals.
    var sortIndex: Int {
        switch self {
        case .breakfast: return 0
        case .lunch: return 1
        case .dinner: return 2
        case .snack: return 3
        }
    }
}

/// Kind of workout. Drives which fields the editor shows.
enum WorkoutType: String, CaseIterable, Identifiable, Codable {
    case strength
    case cardio
    case other

    var id: String { rawValue }

    var title: String {
        switch self {
        case .strength: return "Strength"
        case .cardio: return "Cardio"
        case .other: return "Other"
        }
    }

    var symbolName: String {
        switch self {
        case .strength: return "dumbbell"
        case .cardio: return "figure.run"
        case .other: return "figure.mixed.cardio"
        }
    }

    /// Strength workouts log exercises with sets/reps/weight.
    var usesExercises: Bool { self == .strength }

    /// Cardio workouts log duration + distance.
    var usesDistance: Bool { self == .cardio }
}

/// Display unit for body weight. Everything is *stored* in kilograms;
/// this only affects what the UI shows and accepts.
enum WeightUnit: String, CaseIterable, Identifiable, Codable {
    case kilograms
    case pounds

    var id: String { rawValue }

    var title: String {
        switch self {
        case .kilograms: return "Kilograms (kg)"
        case .pounds: return "Pounds (lb)"
        }
    }

    var abbreviation: String {
        switch self {
        case .kilograms: return "kg"
        case .pounds: return "lb"
        }
    }

    private static let poundsPerKilogram = 2.2046226218

    /// Convert a stored kilogram value into this unit.
    func fromKilograms(_ kilograms: Double) -> Double {
        switch self {
        case .kilograms: return kilograms
        case .pounds: return kilograms * Self.poundsPerKilogram
        }
    }

    /// Convert a value expressed in this unit back into kilograms for storage.
    func toKilograms(_ value: Double) -> Double {
        switch self {
        case .kilograms: return value
        case .pounds: return value / Self.poundsPerKilogram
        }
    }
}

/// Length unit for cardio distance. Stored in kilometres.
enum DistanceUnit: String, CaseIterable, Identifiable, Codable {
    case kilometers
    case miles

    var id: String { rawValue }

    var title: String {
        switch self {
        case .kilometers: return "Kilometers (km)"
        case .miles: return "Miles (mi)"
        }
    }

    var abbreviation: String {
        switch self {
        case .kilometers: return "km"
        case .miles: return "mi"
        }
    }

    private static let milesPerKilometer = 0.621371192

    func fromKilometers(_ kilometers: Double) -> Double {
        switch self {
        case .kilometers: return kilometers
        case .miles: return kilometers * Self.milesPerKilometer
        }
    }

    func toKilometers(_ value: Double) -> Double {
        switch self {
        case .kilometers: return value
        case .miles: return value / Self.milesPerKilometer
        }
    }
}
