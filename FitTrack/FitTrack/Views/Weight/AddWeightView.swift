import SwiftUI
import SwiftData

/// Log or edit a body-weight reading.
struct AddWeightView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var settings: UserSettings

    private let existingEntry: WeightEntry?

    /// In the user's display unit; converted to kilograms on save.
    @State private var weight: Double = 0
    @State private var date: Date
    @State private var note: String
    @State private var loaded = false

    init() {
        existingEntry = nil
        _date = State(initialValue: Date())
        _note = State(initialValue: "")
    }

    init(editing entry: WeightEntry) {
        existingEntry = entry
        _date = State(initialValue: entry.date)
        _note = State(initialValue: entry.note)
    }

    private var canSave: Bool { weight > 0 }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    NumberField(
                        title: "Weight",
                        value: $weight,
                        unit: settings.weightUnit.abbreviation,
                        decimals: 1
                    )
                    DatePicker("Date", selection: $date, displayedComponents: [.date, .hourAndMinute])
                }

                Section("Note") {
                    TextField("Optional", text: $note, axis: .vertical)
                        .lineLimit(1...4)
                }
            }
            .navigationTitle(existingEntry == nil ? "Log Weight" : "Edit Weigh-in")
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

    private func loadIfNeeded() {
        guard !loaded else { return }
        loaded = true
        if let entry = existingEntry {
            weight = settings.displayWeight(entry.weightKg)
        }
    }

    private func save() {
        let kilograms = settings.storageWeight(weight)
        if let entry = existingEntry {
            entry.weightKg = kilograms
            entry.note = note
            entry.setDate(date)
        } else {
            context.insert(WeightEntry(weightKg: kilograms, date: date, note: note))
        }
        dismiss()
    }
}

#Preview {
    AddWeightView()
        .environmentObject(UserSettings())
        .modelContainer(Persistence.previewContainer())
}
