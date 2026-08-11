import Foundation
import SwiftData

/// A logged workout session.
///
/// Strength sessions carry `exercises` (each with sets/reps/weight); cardio
/// sessions carry `durationMinutes` / `distanceKm`. Nothing stops a session
/// from having both — the editor just shows what the type implies.
@Model
final class Workout {
    var name: String = ""
    /// Raw value of `WorkoutType`.
    var typeRaw: String = WorkoutType.strength.rawValue
    var date: Date = Date()
    /// `date` truncated to midnight — grouping key for "browse by date".
    var dayKey: Date = Date()
    var notes: String = ""

    var durationMinutes: Double = 0
    /// Always stored in kilometres; the UI converts for miles.
    var distanceKm: Double = 0
    var caloriesBurned: Double = 0

    @Relationship(deleteRule: .cascade, inverse: \Exercise.workout)
    var exercises: [Exercise] = []

    init(
        name: String = "",
        type: WorkoutType = .strength,
        date: Date = Date(),
        notes: String = "",
        durationMinutes: Double = 0,
        distanceKm: Double = 0,
        caloriesBurned: Double = 0
    ) {
        self.name = name
        self.typeRaw = type.rawValue
        self.date = date
        self.dayKey = Calendar.current.startOfDay(for: date)
        self.notes = notes
        self.durationMinutes = durationMinutes
        self.distanceKm = distanceKm
        self.caloriesBurned = caloriesBurned
        self.exercises = []
    }

    var type: WorkoutType {
        get { WorkoutType(rawValue: typeRaw) ?? .other }
        set { typeRaw = newValue.rawValue }
    }

    func setDate(_ newDate: Date) {
        date = newDate
        dayKey = Calendar.current.startOfDay(for: newDate)
    }

    /// Exercises in the order they were added.
    var orderedExercises: [Exercise] {
        exercises.sorted { $0.order < $1.order }
    }

    var totalSets: Int {
        exercises.reduce(0) { $0 + $1.sets.count }
    }

    /// Sum of reps × weight across every set — a rough "how much work" number.
    var totalVolume: Double {
        exercises.reduce(0) { $0 + $1.volume }
    }

    /// One-line summary shown in list rows.
    var summaryLine: String {
        switch type {
        case .strength:
            let exerciseCount = exercises.count
            return "\(exerciseCount) exercise\(exerciseCount == 1 ? "" : "s") · \(totalSets) set\(totalSets == 1 ? "" : "s")"
        case .cardio, .other:
            var parts: [String] = []
            if durationMinutes > 0 { parts.append(Format.duration(minutes: durationMinutes)) }
            if distanceKm > 0 { parts.append(Format.distance(kilometers: distanceKm)) }
            if parts.isEmpty { parts.append("No details") }
            return parts.joined(separator: " · ")
        }
    }
}

/// One exercise inside a logged workout (e.g. "Bench press").
@Model
final class Exercise {
    var name: String = ""
    var order: Int = 0
    var notes: String = ""

    var workout: Workout?

    @Relationship(deleteRule: .cascade, inverse: \ExerciseSet.exercise)
    var sets: [ExerciseSet] = []

    init(name: String = "", order: Int = 0, notes: String = "") {
        self.name = name
        self.order = order
        self.notes = notes
        self.sets = []
    }

    var orderedSets: [ExerciseSet] {
        sets.sorted { $0.order < $1.order }
    }

    var volume: Double {
        sets.reduce(0) { $0 + Double($1.reps) * $1.weight }
    }

    var heaviestWeight: Double {
        sets.map(\.weight).max() ?? 0
    }
}

/// A single set: reps at a weight. Weight is stored in kilograms.
@Model
final class ExerciseSet {
    var order: Int = 0
    var reps: Int = 0
    var weight: Double = 0
    var completed: Bool = true

    var exercise: Exercise?

    init(order: Int = 0, reps: Int = 0, weight: Double = 0, completed: Bool = true) {
        self.order = order
        self.reps = reps
        self.weight = weight
        self.completed = completed
    }
}
