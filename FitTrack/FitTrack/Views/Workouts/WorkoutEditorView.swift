import SwiftUI
import SwiftData

/// Create or edit a workout. Works on a `WorkoutDraft`; nothing is written to
/// the store until you tap Save.
struct WorkoutEditorView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var settings: UserSettings

    private let existingWorkout: Workout?
    /// Set when the editor was opened from a routine, so we can fill the draft
    /// once `settings` is available (units matter, and the environment object
    /// isn't readable from `init`).
    private let sourceTemplate: WorkoutTemplate?

    @State private var draft = WorkoutDraft()
    @State private var loaded = false
    @State private var saveAsTemplate = false

    /// New, empty workout.
    init() {
        existingWorkout = nil
        sourceTemplate = nil
    }

    /// New workout pre-filled from a routine.
    init(template: WorkoutTemplate) {
        existingWorkout = nil
        sourceTemplate = template
    }

    /// Edit an existing workout.
    init(editing workout: Workout) {
        existingWorkout = workout
        sourceTemplate = nil
    }

    private var isEditing: Bool { existingWorkout != nil }

    var body: some View {
        NavigationStack {
            Form {
                Section("Workout") {
                    TextField("Name (e.g. Push day)", text: $draft.name)
                        .textInputAutocapitalization(.sentences)

                    Picker("Type", selection: $draft.type) {
                        ForEach(WorkoutType.allCases) { type in
                            Label(type.title, systemImage: type.symbolName).tag(type)
                        }
                    }

                    DatePicker("Date", selection: $draft.date)
                }

                if draft.type.usesExercises {
                    exerciseSections
                } else {
                    Section("Details") {
                        NumberField(title: "Duration", value: $draft.durationMinutes, unit: "min", decimals: 0)
                        if draft.type.usesDistance {
                            NumberField(
                                title: "Distance",
                                value: $draft.distance,
                                unit: settings.distanceUnit.abbreviation,
                                decimals: 2
                            )
                        }
                        NumberField(title: "Calories burned", value: $draft.caloriesBurned, unit: "kcal", decimals: 0)
                    }
                }

                Section("Notes") {
                    TextField("How did it go?", text: $draft.notes, axis: .vertical)
                        .lineLimit(2...6)
                }

                if !isEditing {
                    Section {
                        Toggle("Save as routine", isOn: $saveAsTemplate)
                    } footer: {
                        Text("Routines let you start the same session again without retyping it.")
                    }
                }
            }
            .navigationTitle(isEditing ? "Edit Workout" : "Log Workout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(!draft.isValid)
                }
            }
            .onAppear(perform: loadIfNeeded)
        }
    }

    // MARK: - Strength editing

    @ViewBuilder
    private var exerciseSections: some View {
        ForEach($draft.exercises) { $exercise in
            Section {
                TextField("Exercise name", text: $exercise.name)
                    .textInputAutocapitalization(.words)
                    .font(.body.weight(.medium))

                // Iterate the values for stable identity, but hand each row a
                // binding into the array so edits write straight back.
                ForEach(Array(exercise.sets.enumerated()), id: \.element.id) { index, _ in
                    SetRow(index: index, set: $exercise.sets[index], unit: settings.weightUnit.abbreviation)
                }
                .onDelete { offsets in
                    $exercise.wrappedValue.sets.remove(atOffsets: offsets)
                }

                Button {
                    addSet(to: $exercise)
                } label: {
                    Label("Add set", systemImage: "plus.circle")
                        .font(.subheadline)
                }
            } header: {
                HStack {
                    Text(exercise.name.isEmpty ? "Exercise" : exercise.name)
                    Spacer()
                    Button(role: .destructive) {
                        let id = exercise.id
                        draft.exercises.removeAll { $0.id == id }
                    } label: {
                        Text("Remove")
                    }
                    .buttonStyle(.borderless)
                    .font(.caption)
                }
                .textCase(nil)
            }
        }

        Section {
            Button {
                draft.exercises.append(ExerciseDraft())
            } label: {
                Label("Add exercise", systemImage: "plus")
            }
        }
    }

    /// New sets copy the previous set's reps/weight — that's almost always
    /// what you want when you're mid-session.
    private func addSet(to exercise: Binding<ExerciseDraft>) {
        let previous = exercise.wrappedValue.sets.last
        exercise.wrappedValue.sets.append(
            SetDraft(reps: previous?.reps ?? 10, weight: previous?.weight ?? 0, completed: false)
        )
    }

    // MARK: - Load / save

    private func loadIfNeeded() {
        guard !loaded else { return }
        loaded = true
        if let workout = existingWorkout {
            draft = WorkoutDraft.from(workout, settings: settings)
        } else if let template = sourceTemplate {
            draft = WorkoutDraft.from(template, settings: settings)
            template.lastUsedAt = Date()
        } else {
            draft = WorkoutDraft(date: Date(), exercises: [ExerciseDraft()])
        }
    }

    private func save() {
        let workout: Workout
        if let existing = existingWorkout {
            workout = existing
            // Replace the exercise list wholesale; the old rows would otherwise
            // be left orphaned in the store (cascade only fires on parent delete).
            for exercise in existing.exercises {
                context.delete(exercise)
            }
            existing.exercises = []
        } else {
            workout = Workout()
            context.insert(workout)
        }

        let created = draft.apply(to: workout, settings: settings)
        for exercise in created {
            context.insert(exercise)
            for set in exercise.sets { context.insert(set) }
        }

        if saveAsTemplate && !isEditing {
            let template = draft.makeTemplate(settings: settings)
            context.insert(template)
            for exercise in template.exercises { context.insert(exercise) }
        }

        dismiss()
    }
}

/// One set row: index, reps, weight, done toggle.
private struct SetRow: View {
    var index: Int
    @Binding var set: SetDraft
    var unit: String

    var body: some View {
        HStack(spacing: 10) {
            Text("\(index + 1)")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .frame(width: 18)

            HStack(spacing: 4) {
                TextField("0", value: $set.reps, format: .number)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 44)
                Text("reps")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 4) {
                TextField("0", value: $set.weight, format: .number)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 60)
                Text(unit)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button {
                set.completed.toggle()
            } label: {
                Image(systemName: set.completed ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(set.completed ? Color.accentColor : Color.secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(set.completed ? "Set done" : "Set not done")
        }
    }
}

#Preview {
    WorkoutEditorView()
        .environmentObject(UserSettings())
        .modelContainer(Persistence.previewContainer())
}
