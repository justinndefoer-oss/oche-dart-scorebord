import Foundation
import SwiftData

/// Everything SwiftData needs to know about. Add new `@Model` types here.
enum PersistenceSchema {
    static let models: [any PersistentModel.Type] = [
        Food.self,
        FoodEntry.self,
        Workout.self,
        Exercise.self,
        ExerciseSet.self,
        WorkoutTemplate.self,
        TemplateExercise.self,
        WeightEntry.self
    ]

    static var schema: Schema { Schema(models) }
}

enum Persistence {

    /// The on-disk container the app runs on.
    ///
    /// If the store cannot be opened — which in practice means an incompatible
    /// schema left over from an earlier build on the device — we fall back to
    /// an in-memory container so the app still launches instead of crashing on
    /// a black screen. Deleting and reinstalling the app clears the bad store.
    static let shared: ModelContainer = {
        let schema = PersistenceSchema.schema
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        do {
            return try ModelContainer(for: schema, configurations: [configuration])
        } catch {
            print("FitTrack: could not open the on-disk store (\(error)). Falling back to memory.")
            let fallback = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
            // swiftlint:disable:next force_try
            return try! ModelContainer(for: schema, configurations: [fallback])
        }
    }()

    /// An empty in-memory container for SwiftUI previews and testing.
    @MainActor
    static func previewContainer(seeded: Bool = true) -> ModelContainer {
        let configuration = ModelConfiguration(schema: PersistenceSchema.schema, isStoredInMemoryOnly: true)
        let container = try! ModelContainer(for: PersistenceSchema.schema, configurations: [configuration])
        if seeded { SampleData.insert(into: container.mainContext) }
        return container
    }
}

/// A little bit of data so previews aren't empty screens.
enum SampleData {
    @MainActor
    static func insert(into context: ModelContext) {
        let oats = Food(name: "Oats", servingDescription: "60 g dry", calories: 228, protein: 8, carbs: 40, fat: 4)
        let chicken = Food(name: "Chicken breast", servingDescription: "150 g", calories: 248, protein: 46, carbs: 0, fat: 5)
        let yoghurt = Food(name: "Greek yoghurt", servingDescription: "200 g", calories: 130, protein: 20, carbs: 8, fat: 2)
        for food in [oats, chicken, yoghurt] {
            context.insert(food)
        }

        let today = Date()
        context.insert(FoodEntry.from(food: oats, meal: .breakfast, servings: 1, date: today.startOfDay.addingTimeInterval(8 * 3600)))
        context.insert(FoodEntry.from(food: yoghurt, meal: .snack, servings: 1, date: today.startOfDay.addingTimeInterval(11 * 3600)))
        context.insert(FoodEntry.from(food: chicken, meal: .dinner, servings: 1.5, date: today.startOfDay.addingTimeInterval(19 * 3600)))

        let push = Workout(name: "Push day", type: .strength, date: today.addingTimeInterval(-3600))
        let bench = Exercise(name: "Bench press", order: 0)
        bench.sets = [
            ExerciseSet(order: 0, reps: 8, weight: 60),
            ExerciseSet(order: 1, reps: 8, weight: 62.5),
            ExerciseSet(order: 2, reps: 6, weight: 65)
        ]
        let press = Exercise(name: "Overhead press", order: 1)
        press.sets = [
            ExerciseSet(order: 0, reps: 10, weight: 35),
            ExerciseSet(order: 1, reps: 10, weight: 35)
        ]
        push.exercises = [bench, press]
        context.insert(push)

        let run = Workout(name: "Easy run", type: .cardio, date: today.adding(days: -2), durationMinutes: 32, distanceKm: 5.4)
        context.insert(run)

        for offset in stride(from: 28, through: 0, by: -2) {
            let drift = Double(offset) * 0.06
            context.insert(WeightEntry(weightKg: 78.4 + drift, date: today.adding(days: -offset)))
        }

        let template = WorkoutTemplate(name: "Push day", type: .strength)
        template.exercises = [
            TemplateExercise(name: "Bench press", order: 0, targetSets: 3, targetReps: 8, targetWeight: 60),
            TemplateExercise(name: "Overhead press", order: 1, targetSets: 3, targetReps: 10, targetWeight: 35),
            TemplateExercise(name: "Triceps pushdown", order: 2, targetSets: 3, targetReps: 12, targetWeight: 25)
        ]
        context.insert(template)
    }
}
