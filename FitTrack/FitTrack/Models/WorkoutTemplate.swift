import Foundation
import SwiftData

/// A reusable routine ("Push day", "Tuesday 5k") you can start a workout from.
///
/// Kept separate from `Workout` on purpose: starting a workout *copies* the
/// template into fresh `Workout`/`Exercise`/`ExerciseSet` objects, so editing
/// the routine later never rewrites sessions you already logged.
@Model
final class WorkoutTemplate {
    var name: String = ""
    var typeRaw: String = WorkoutType.strength.rawValue
    var notes: String = ""
    var createdAt: Date = Date()
    var lastUsedAt: Date?

    var targetDurationMinutes: Double = 0
    var targetDistanceKm: Double = 0

    @Relationship(deleteRule: .cascade, inverse: \TemplateExercise.template)
    var exercises: [TemplateExercise] = []

    init(
        name: String = "",
        type: WorkoutType = .strength,
        notes: String = "",
        createdAt: Date = Date(),
        targetDurationMinutes: Double = 0,
        targetDistanceKm: Double = 0
    ) {
        self.name = name
        self.typeRaw = type.rawValue
        self.notes = notes
        self.createdAt = createdAt
        self.targetDurationMinutes = targetDurationMinutes
        self.targetDistanceKm = targetDistanceKm
        self.exercises = []
    }

    var type: WorkoutType {
        get { WorkoutType(rawValue: typeRaw) ?? .other }
        set { typeRaw = newValue.rawValue }
    }

    var orderedExercises: [TemplateExercise] {
        exercises.sorted { $0.order < $1.order }
    }

    /// Materialises this routine into a brand-new workout ready to be edited
    /// and saved. The returned object is **not** yet inserted into a context.
    func makeWorkout(on date: Date = Date()) -> Workout {
        let workout = Workout(
            name: name,
            type: type,
            date: date,
            notes: notes,
            durationMinutes: targetDurationMinutes,
            distanceKm: targetDistanceKm
        )
        workout.exercises = orderedExercises.map { templateExercise in
            let exercise = Exercise(name: templateExercise.name, order: templateExercise.order)
            exercise.sets = (0..<max(templateExercise.targetSets, 1)).map { index in
                ExerciseSet(
                    order: index,
                    reps: templateExercise.targetReps,
                    weight: templateExercise.targetWeight,
                    completed: false
                )
            }
            return exercise
        }
        return workout
    }
}

/// One planned exercise inside a routine.
@Model
final class TemplateExercise {
    var name: String = ""
    var order: Int = 0
    var targetSets: Int = 3
    var targetReps: Int = 10
    /// Kilograms, like `ExerciseSet.weight`.
    var targetWeight: Double = 0

    var template: WorkoutTemplate?

    init(name: String = "", order: Int = 0, targetSets: Int = 3, targetReps: Int = 10, targetWeight: Double = 0) {
        self.name = name
        self.order = order
        self.targetSets = targetSets
        self.targetReps = targetReps
        self.targetWeight = targetWeight
    }
}
