import Foundation

/// Plain-struct mirrors of the workout models, used while editing.
///
/// The editor works on drafts instead of live `@Model` objects so that a
/// half-finished workout never ends up in the store, "Cancel" is free, and
/// SwiftUI list editing (add/remove/reorder rows) stays simple value semantics.
/// Weights and distances in a draft are in the **user's display unit**;
/// conversion to the stored kilogram/kilometre values happens at the load and
/// commit boundaries.
struct WorkoutDraft {
    var name: String = ""
    var type: WorkoutType = .strength
    var date: Date = Date()
    var notes: String = ""
    var durationMinutes: Double = 0
    var distance: Double = 0
    var caloriesBurned: Double = 0
    var exercises: [ExerciseDraft] = []

    var isValid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    // MARK: - Loading

    static func from(_ workout: Workout, settings: UserSettings) -> WorkoutDraft {
        WorkoutDraft(
            name: workout.name,
            type: workout.type,
            date: workout.date,
            notes: workout.notes,
            durationMinutes: workout.durationMinutes,
            distance: settings.displayDistance(workout.distanceKm),
            caloriesBurned: workout.caloriesBurned,
            exercises: workout.orderedExercises.map { exercise in
                ExerciseDraft(
                    name: exercise.name,
                    sets: exercise.orderedSets.map { set in
                        SetDraft(
                            reps: set.reps,
                            weight: settings.displayWeight(set.weight),
                            completed: set.completed
                        )
                    }
                )
            }
        )
    }

    static func from(_ template: WorkoutTemplate, settings: UserSettings, on date: Date = Date()) -> WorkoutDraft {
        WorkoutDraft(
            name: template.name,
            type: template.type,
            date: date,
            notes: template.notes,
            durationMinutes: template.targetDurationMinutes,
            distance: settings.displayDistance(template.targetDistanceKm),
            caloriesBurned: 0,
            exercises: template.orderedExercises.map { templateExercise in
                ExerciseDraft(
                    name: templateExercise.name,
                    sets: (0..<max(templateExercise.targetSets, 1)).map { _ in
                        SetDraft(
                            reps: templateExercise.targetReps,
                            weight: settings.displayWeight(templateExercise.targetWeight),
                            completed: false
                        )
                    }
                )
            }
        )
    }

    // MARK: - Committing

    /// Copies the draft onto a workout object (new or existing). Existing
    /// exercises are replaced wholesale — simpler than diffing, and a workout
    /// holds a handful of rows.
    func apply(to workout: Workout, settings: UserSettings) -> [Exercise] {
        workout.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        workout.type = type
        workout.setDate(date)
        workout.notes = notes
        workout.durationMinutes = durationMinutes
        workout.distanceKm = settings.storageDistance(distance)
        workout.caloriesBurned = caloriesBurned

        let newExercises = exercises.enumerated().map { index, exerciseDraft -> Exercise in
            let exercise = Exercise(name: exerciseDraft.name, order: index)
            exercise.sets = exerciseDraft.sets.enumerated().map { setIndex, setDraft in
                ExerciseSet(
                    order: setIndex,
                    reps: setDraft.reps,
                    weight: settings.storageWeight(setDraft.weight),
                    completed: setDraft.completed
                )
            }
            return exercise
        }
        workout.exercises = newExercises
        return newExercises
    }

    /// Turns the draft into a reusable routine.
    func makeTemplate(settings: UserSettings) -> WorkoutTemplate {
        let template = WorkoutTemplate(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            type: type,
            notes: notes,
            targetDurationMinutes: durationMinutes,
            targetDistanceKm: settings.storageDistance(distance)
        )
        template.exercises = exercises.enumerated().map { index, exerciseDraft in
            TemplateExercise(
                name: exerciseDraft.name,
                order: index,
                targetSets: max(exerciseDraft.sets.count, 1),
                targetReps: exerciseDraft.sets.first?.reps ?? 10,
                targetWeight: settings.storageWeight(exerciseDraft.sets.first?.weight ?? 0)
            )
        }
        return template
    }
}

struct ExerciseDraft: Identifiable {
    let id = UUID()
    var name: String = ""
    var sets: [SetDraft] = [SetDraft()]

    var volume: Double {
        sets.reduce(0) { $0 + Double($1.reps) * $1.weight }
    }
}

struct SetDraft: Identifiable {
    let id = UUID()
    var reps: Int = 10
    var weight: Double = 0
    var completed: Bool = false
}
