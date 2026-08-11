import SwiftUI
import SwiftData

/// Add a new food entry, or edit an existing one.
///
/// Nutrition is entered *per serving*; the entry stores per-serving values plus
/// a serving count, so changing "servings" later rescales everything correctly.
struct AddFoodEntryView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    /// nil when adding, set when editing.
    private let existingEntry: FoodEntry?

    @State private var name: String
    @State private var meal: MealCategory
    @State private var servings: Double
    @State private var calories: Double
    @State private var protein: Double
    @State private var carbs: Double
    @State private var fat: Double
    @State private var date: Date
    @State private var saveToLibrary = false
    @State private var servingDescription = ""
    @State private var linkedFood: Food?
    @State private var showingPicker = false

    /// Add mode: start on `day` in `meal`, optionally pre-filled from a saved food.
    init(day: Date, meal: MealCategory, prefill: Food? = nil) {
        self.existingEntry = nil
        // Log against the chosen day. For today we use the current time so the
        // entry sorts correctly; for a past day we use midday as a neutral time.
        let entryDate: Date
        if day.isToday {
            entryDate = Date()
        } else {
            entryDate = Calendar.current.date(bySettingHour: 12, minute: 0, second: 0, of: day.startOfDay) ?? day.startOfDay
        }
        _name = State(initialValue: prefill?.name ?? "")
        _meal = State(initialValue: meal)
        _servings = State(initialValue: 1)
        _calories = State(initialValue: prefill?.calories ?? 0)
        _protein = State(initialValue: prefill?.protein ?? 0)
        _carbs = State(initialValue: prefill?.carbs ?? 0)
        _fat = State(initialValue: prefill?.fat ?? 0)
        _date = State(initialValue: entryDate)
        _servingDescription = State(initialValue: prefill?.servingDescription ?? "")
        _linkedFood = State(initialValue: prefill)
    }

    /// Edit mode.
    init(editing entry: FoodEntry) {
        self.existingEntry = entry
        _name = State(initialValue: entry.name)
        _meal = State(initialValue: entry.meal)
        _servings = State(initialValue: entry.servings)
        _calories = State(initialValue: entry.caloriesPerServing)
        _protein = State(initialValue: entry.proteinPerServing)
        _carbs = State(initialValue: entry.carbsPerServing)
        _fat = State(initialValue: entry.fatPerServing)
        _date = State(initialValue: entry.date)
        _linkedFood = State(initialValue: entry.food)
    }

    private var isEditing: Bool { existingEntry != nil }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && servings > 0
    }

    private var totalCalories: Double { calories * servings }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Button {
                        showingPicker = true
                    } label: {
                        Label("Pick from My Foods", systemImage: "books.vertical")
                    }
                }

                Section("Food") {
                    TextField("Name", text: $name)
                        .textInputAutocapitalization(.sentences)

                    Picker("Meal", selection: $meal) {
                        ForEach(MealCategory.allCases) { category in
                            Label(category.title, systemImage: category.symbolName).tag(category)
                        }
                    }

                    DatePicker("Time", selection: $date)
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
                    if implied > 0 && calories > 0 && abs(implied - calories) > max(30, calories * 0.15) {
                        Text("Heads up: the macros add up to about \(Format.calories(implied)) kcal, which doesn't match the calories you entered.")
                    } else {
                        Text("Enter the numbers for one serving, then set how many servings you had.")
                    }
                }

                Section("Servings") {
                    NumberField(title: "Servings", value: $servings, unit: nil, decimals: 2)
                    Stepper(value: $servings, in: 0.25...50, step: 0.25) {
                        Text("Quick adjust")
                            .foregroundStyle(.secondary)
                    }
                    LabeledContent("Total") {
                        Text("\(Format.calories(totalCalories)) kcal")
                            .monospacedDigit()
                    }
                }

                if !isEditing {
                    Section {
                        Toggle("Save to My Foods", isOn: $saveToLibrary)
                        if saveToLibrary {
                            TextField("Serving description (e.g. 100 g)", text: $servingDescription)
                        }
                    } footer: {
                        Text("Saved foods can be reused later without retyping the nutrition.")
                    }
                }
            }
            .navigationTitle(isEditing ? "Edit Entry" : "Add Food")
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
            .sheet(isPresented: $showingPicker) {
                NavigationStack {
                    FoodPickerView { food in
                        apply(food)
                        showingPicker = false
                    }
                }
            }
        }
    }

    private func apply(_ food: Food) {
        name = food.name
        calories = food.calories
        protein = food.protein
        carbs = food.carbs
        fat = food.fat
        servingDescription = food.servingDescription
        linkedFood = food
    }

    private func save() {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)

        if let entry = existingEntry {
            entry.name = trimmedName
            entry.meal = meal
            entry.servings = servings
            entry.caloriesPerServing = calories
            entry.proteinPerServing = protein
            entry.carbsPerServing = carbs
            entry.fatPerServing = fat
            entry.setDate(date)
        } else {
            var food = linkedFood
            if saveToLibrary && food == nil {
                let newFood = Food(
                    name: trimmedName,
                    servingDescription: servingDescription,
                    calories: calories,
                    protein: protein,
                    carbs: carbs,
                    fat: fat
                )
                context.insert(newFood)
                food = newFood
            }
            food?.markUsed(at: date)

            let entry = FoodEntry(
                name: trimmedName,
                meal: meal,
                servings: servings,
                caloriesPerServing: calories,
                proteinPerServing: protein,
                carbsPerServing: carbs,
                fatPerServing: fat,
                date: date,
                food: food
            )
            context.insert(entry)
        }

        dismiss()
    }
}

#Preview("Add") {
    AddFoodEntryView(day: Date(), meal: .lunch)
        .modelContainer(Persistence.previewContainer())
}
