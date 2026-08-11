import SwiftUI
import SwiftData

/// Saved routines. Tap one to start a workout from it.
struct WorkoutTemplatesView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @Query(sort: [SortDescriptor(\WorkoutTemplate.name, order: .forward)])
    private var templates: [WorkoutTemplate]

    @State private var creating = false
    @State private var templateBeingEdited: WorkoutTemplate?

    private let onStart: (WorkoutTemplate) -> Void

    init(onStart: @escaping (WorkoutTemplate) -> Void) {
        self.onStart = onStart
    }

    var body: some View {
        Group {
            if templates.isEmpty {
                EmptyStateView(
                    title: "No routines yet",
                    message: "Create a routine here, or tick “Save as routine” when you log a workout.",
                    systemImage: "list.bullet.rectangle"
                )
            } else {
                List {
                    ForEach(templates) { template in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Label(template.name, systemImage: template.type.symbolName)
                                    .font(.body.weight(.medium))
                                Spacer()
                                Button("Start") { onStart(template) }
                                    .buttonStyle(.borderedProminent)
                                    .controlSize(.small)
                            }
                            Text(summary(for: template))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .contentShape(Rectangle())
                        .swipeActions(edge: .leading) {
                            Button {
                                templateBeingEdited = template
                            } label: {
                                Label("Edit", systemImage: "pencil")
                            }
                            .tint(.orange)
                        }
                    }
                    .onDelete(perform: delete)
                }
            }
        }
        .navigationTitle("Routines")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Done") { dismiss() }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    creating = true
                } label: {
                    Label("New Routine", systemImage: "plus")
                }
            }
        }
        .sheet(isPresented: $creating) {
            TemplateEditorView()
        }
        .sheet(item: $templateBeingEdited) { template in
            TemplateEditorView(editing: template)
        }
    }

    private func summary(for template: WorkoutTemplate) -> String {
        switch template.type {
        case .strength:
            let count = template.exercises.count
            return "\(count) exercise\(count == 1 ? "" : "s")"
        case .cardio, .other:
            var parts: [String] = []
            if template.targetDurationMinutes > 0 {
                parts.append(Format.duration(minutes: template.targetDurationMinutes))
            }
            if template.targetDistanceKm > 0 {
                parts.append(Format.distance(kilometers: template.targetDistanceKm))
            }
            return parts.isEmpty ? template.type.title : parts.joined(separator: " · ")
        }
    }

    private func delete(_ offsets: IndexSet) {
        for index in offsets {
            context.delete(templates[index])
        }
    }
}

/// Create or edit a routine.
struct TemplateEditorView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var settings: UserSettings

    private let existingTemplate: WorkoutTemplate?

    @State private var name: String
    @State private var type: WorkoutType
    @State private var notes: String
    @State private var duration: Double
    @State private var distance: Double
    @State private var exercises: [TemplateExerciseDraft]
    @State private var loaded = false

    init() {
        existingTemplate = nil
        _name = State(initialValue: "")
        _type = State(initialValue: .strength)
        _notes = State(initialValue: "")
        _duration = State(initialValue: 0)
        _distance = State(initialValue: 0)
        _exercises = State(initialValue: [TemplateExerciseDraft()])
    }

    init(editing template: WorkoutTemplate) {
        existingTemplate = template
        _name = State(initialValue: template.name)
        _type = State(initialValue: template.type)
        _notes = State(initialValue: template.notes)
        _duration = State(initialValue: template.targetDurationMinutes)
        // Distance and weights are converted to display units in `loadIfNeeded`,
        // where `settings` is reachable.
        _distance = State(initialValue: template.targetDistanceKm)
        _exercises = State(initialValue: template.orderedExercises.map {
            TemplateExerciseDraft(name: $0.name, sets: $0.targetSets, reps: $0.targetReps, weight: $0.targetWeight)
        })
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Routine") {
                    TextField("Name", text: $name)
                        .textInputAutocapitalization(.sentences)
                    Picker("Type", selection: $type) {
                        ForEach(WorkoutType.allCases) { workoutType in
                            Label(workoutType.title, systemImage: workoutType.symbolName).tag(workoutType)
                        }
                    }
                }

                if type.usesExercises {
                    Section("Exercises") {
                        ForEach($exercises) { $exercise in
                            VStack(alignment: .leading, spacing: 8) {
                                TextField("Exercise name", text: $exercise.name)
                                    .textInputAutocapitalization(.words)
                                HStack(spacing: 12) {
                                    LabeledNumber(label: "Sets", value: $exercise.sets)
                                    LabeledNumber(label: "Reps", value: $exercise.reps)
                                    LabeledDecimal(
                                        label: settings.weightUnit.abbreviation,
                                        value: $exercise.weight
                                    )
                                }
                            }
                            .padding(.vertical, 4)
                        }
                        .onDelete { exercises.remove(atOffsets: $0) }

                        Button {
                            exercises.append(TemplateExerciseDraft())
                        } label: {
                            Label("Add exercise", systemImage: "plus")
                        }
                    }
                } else {
                    Section("Targets") {
                        NumberField(title: "Duration", value: $duration, unit: "min", decimals: 0)
                        if type.usesDistance {
                            NumberField(
                                title: "Distance",
                                value: $distance,
                                unit: settings.distanceUnit.abbreviation,
                                decimals: 2
                            )
                        }
                    }
                }

                Section("Notes") {
                    TextField("Notes", text: $notes, axis: .vertical)
                        .lineLimit(2...6)
                }
            }
            .navigationTitle(existingTemplate == nil ? "New Routine" : "Edit Routine")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(!canSave)
                }
            }
            .onAppear(perform: loadIfNeeded)
        }
    }

    /// Converts the stored kilogram/kilometre values into display units once.
    private func loadIfNeeded() {
        guard !loaded, existingTemplate != nil else { loaded = true; return }
        loaded = true
        distance = settings.displayDistance(distance)
        for index in exercises.indices {
            exercises[index].weight = settings.displayWeight(exercises[index].weight)
        }
    }

    private func save() {
        let template: WorkoutTemplate
        if let existing = existingTemplate {
            template = existing
            for exercise in existing.exercises { context.delete(exercise) }
            existing.exercises = []
        } else {
            template = WorkoutTemplate()
            context.insert(template)
        }

        template.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        template.type = type
        template.notes = notes
        template.targetDurationMinutes = duration
        template.targetDistanceKm = settings.storageDistance(distance)

        let newExercises = exercises
            .filter { !$0.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .enumerated()
            .map { index, draft in
                TemplateExercise(
                    name: draft.name.trimmingCharacters(in: .whitespacesAndNewlines),
                    order: index,
                    targetSets: max(draft.sets, 1),
                    targetReps: max(draft.reps, 1),
                    targetWeight: settings.storageWeight(draft.weight)
                )
            }
        template.exercises = newExercises
        for exercise in newExercises { context.insert(exercise) }

        dismiss()
    }
}

struct TemplateExerciseDraft: Identifiable {
    let id = UUID()
    var name: String = ""
    var sets: Int = 3
    var reps: Int = 10
    var weight: Double = 0
}

/// Small labelled integer box used in the routine editor.
private struct LabeledNumber: View {
    var label: String
    @Binding var value: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            TextField("0", value: $value, format: .number)
                .keyboardType(.numberPad)
                .textFieldStyle(.roundedBorder)
                .frame(width: 64)
        }
    }
}

private struct LabeledDecimal: View {
    var label: String
    @Binding var value: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            TextField("0", value: $value, format: .number)
                .keyboardType(.decimalPad)
                .textFieldStyle(.roundedBorder)
                .frame(width: 72)
        }
    }
}

#Preview {
    NavigationStack {
        WorkoutTemplatesView { _ in }
    }
    .environmentObject(UserSettings())
    .modelContainer(Persistence.previewContainer())
}
