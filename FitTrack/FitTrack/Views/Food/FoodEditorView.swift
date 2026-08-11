import SwiftUI
import SwiftData

/// Create or edit a reusable food in the library.
struct FoodEditorView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    private let existingFood: Food?

    @State private var name: String
    @State private var servingDescription: String
    @State private var calories: Double
    @State private var protein: Double
    @State private var carbs: Double
    @State private var fat: Double

    init() {
        existingFood = nil
        _name = State(initialValue: "")
        _servingDescription = State(initialValue: "")
        _calories = State(initialValue: 0)
        _protein = State(initialValue: 0)
        _carbs = State(initialValue: 0)
        _fat = State(initialValue: 0)
    }

    init(editing food: Food) {
        existingFood = food
        _name = State(initialValue: food.name)
        _servingDescription = State(initialValue: food.servingDescription)
        _calories = State(initialValue: food.calories)
        _protein = State(initialValue: food.protein)
        _carbs = State(initialValue: food.carbs)
        _fat = State(initialValue: food.fat)
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Food") {
                    TextField("Name", text: $name)
                        .textInputAutocapitalization(.sentences)
                    TextField("Serving (e.g. 100 g, 1 cup)", text: $servingDescription)
                }

                Section {
                    NumberField(title: "Calories", value: $calories, unit: "kcal", decimals: 0)
                    NumberField(title: "Protein", value: $protein, unit: "g")
                    NumberField(title: "Carbs", value: $carbs, unit: "g")
                    NumberField(title: "Fat", value: $fat, unit: "g")
                } header: {
                    Text("Per serving")
                } footer: {
                    let implied = protein * 4 + carbs * 4 + fat * 9
                    if implied > 0 {
                        Text("Macros add up to about \(Format.calories(implied)) kcal.")
                    }
                }
            }
            .navigationTitle(existingFood == nil ? "New Food" : "Edit Food")
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
        }
    }

    private func save() {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if let food = existingFood {
            food.name = trimmedName
            food.servingDescription = servingDescription
            food.calories = calories
            food.protein = protein
            food.carbs = carbs
            food.fat = fat
        } else {
            context.insert(
                Food(
                    name: trimmedName,
                    servingDescription: servingDescription,
                    calories: calories,
                    protein: protein,
                    carbs: carbs,
                    fat: fat
                )
            )
        }
        dismiss()
    }
}

#Preview {
    FoodEditorView()
        .modelContainer(Persistence.previewContainer())
}
