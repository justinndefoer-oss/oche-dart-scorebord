import SwiftUI
import SwiftData

/// Read-only view of one logged workout, with an Edit button.
struct WorkoutDetailView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var settings: UserSettings

    private let workout: Workout

    @State private var editing = false
    @State private var confirmingDelete = false

    init(workout: Workout) {
        self.workout = workout
    }

    var body: some View {
        List {
            Section {
                LabeledContent("Type", value: workout.type.title)
                LabeledContent("Date") {
                    Text(workout.date.formatted(date: .abbreviated, time: .shortened))
                }
                if workout.durationMinutes > 0 {
                    LabeledContent("Duration", value: Format.duration(minutes: workout.durationMinutes))
                }
                if workout.distanceKm > 0 {
                    LabeledContent("Distance", value: settings.formattedDistance(workout.distanceKm))
                }
                if workout.caloriesBurned > 0 {
                    LabeledContent("Calories burned", value: "\(Format.calories(workout.caloriesBurned)) kcal")
                }
                if workout.type.usesExercises && !workout.exercises.isEmpty {
                    LabeledContent("Total volume") {
                        Text(settings.formattedWeight(workout.totalVolume, decimals: 0))
                    }
                }
            }

            ForEach(workout.orderedExercises) { exercise in
                Section(exercise.name.isEmpty ? "Exercise" : exercise.name) {
                    ForEach(Array(exercise.orderedSets.enumerated()), id: \.element.persistentModelID) { index, set in
                        HStack {
                            Text("Set \(index + 1)")
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text("\(set.reps) × \(settings.formattedWeight(set.weight))")
                                .monospacedDigit()
                            if set.completed {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(.tint)
                                    .font(.caption)
                            }
                        }
                    }
                }
            }

            if !workout.notes.isEmpty {
                Section("Notes") {
                    Text(workout.notes)
                }
            }

            Section {
                Button(role: .destructive) {
                    confirmingDelete = true
                } label: {
                    Label("Delete Workout", systemImage: "trash")
                }
            }
        }
        .navigationTitle(workout.name.isEmpty ? workout.type.title : workout.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Edit") { editing = true }
            }
        }
        .sheet(isPresented: $editing) {
            WorkoutEditorView(editing: workout)
        }
        .confirmationDialog(
            "Delete this workout?",
            isPresented: $confirmingDelete,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                context.delete(workout)
                dismiss()
            }
            Button("Cancel", role: .cancel) { }
        }
    }
}
