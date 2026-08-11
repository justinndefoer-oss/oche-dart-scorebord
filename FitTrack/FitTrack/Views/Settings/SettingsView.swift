import SwiftUI
import SwiftData

/// Goals and units. Deliberately small for v1.
struct SettingsView: View {
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var settings: UserSettings

    @Query private var foodEntries: [FoodEntry]
    @Query private var workouts: [Workout]
    @Query private var weightEntries: [WeightEntry]
    @Query private var foods: [Food]

    @State private var weightGoalDisplay: Double = 0
    @State private var loaded = false
    @State private var confirmingReset = false

    private var macroCalories: Double {
        Double(settings.proteinGoal) * 4 + Double(settings.carbsGoal) * 4 + Double(settings.fatGoal) * 9
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    IntField(title: "Daily calories", value: $settings.calorieGoal, unit: "kcal")
                } header: {
                    Text("Calorie goal")
                } footer: {
                    Text("Used for the ring on the home screen and the “remaining” number in the food log.")
                }

                Section {
                    Toggle("Track macro goals", isOn: $settings.macroGoalsEnabled)

                    if settings.macroGoalsEnabled {
                        IntField(title: "Protein", value: $settings.proteinGoal, unit: "g")
                        IntField(title: "Carbs", value: $settings.carbsGoal, unit: "g")
                        IntField(title: "Fat", value: $settings.fatGoal, unit: "g")
                    }
                } header: {
                    Text("Macro goals")
                } footer: {
                    if settings.macroGoalsEnabled {
                        let difference = macroCalories - Double(settings.calorieGoal)
                        if abs(difference) > 50 {
                            Text("These macros add up to \(Format.calories(macroCalories)) kcal — \(Format.calories(abs(difference))) \(difference > 0 ? "more" : "less") than your calorie goal.")
                        } else {
                            Text("These macros add up to \(Format.calories(macroCalories)) kcal, which matches your calorie goal.")
                        }
                    } else {
                        Text("With macro goals off, the app still shows your daily protein, carbs and fat totals — just without targets.")
                    }
                }

                Section("Weight") {
                    Picker("Unit", selection: $settings.weightUnit) {
                        ForEach(WeightUnit.allCases) { unit in
                            Text(unit.title).tag(unit)
                        }
                    }
                    NumberField(
                        title: "Goal weight",
                        value: $weightGoalDisplay,
                        unit: settings.weightUnit.abbreviation,
                        decimals: 1
                    )
                    .onChange(of: weightGoalDisplay) { _, newValue in
                        settings.weightGoalKg = settings.storageWeight(newValue)
                    }
                }

                Section("Distance") {
                    Picker("Unit", selection: $settings.distanceUnit) {
                        ForEach(DistanceUnit.allCases) { unit in
                            Text(unit.title).tag(unit)
                        }
                    }
                }

                Section("Your data") {
                    LabeledContent("Food entries", value: "\(foodEntries.count)")
                    LabeledContent("Saved foods", value: "\(foods.count)")
                    LabeledContent("Workouts", value: "\(workouts.count)")
                    LabeledContent("Weigh-ins", value: "\(weightEntries.count)")
                }

                Section {
                    Button("Reset goals to defaults") {
                        confirmingReset = true
                    }
                } footer: {
                    Text("Everything is stored on this device only. There is no account, no sync and no network access — deleting the app deletes the data.")
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                guard !loaded else { return }
                loaded = true
                weightGoalDisplay = settings.displayWeight(settings.weightGoalKg)
            }
            .onChange(of: settings.weightUnit) { _, _ in
                // Keep the goal field showing the same real weight in the new unit.
                weightGoalDisplay = settings.displayWeight(settings.weightGoalKg)
            }
            .confirmationDialog(
                "Reset goals to defaults?",
                isPresented: $confirmingReset,
                titleVisibility: .visible
            ) {
                Button("Reset", role: .destructive) {
                    settings.resetToDefaults()
                    weightGoalDisplay = 0
                }
                Button("Cancel", role: .cancel) { }
            } message: {
                Text("This only changes your goals and units. Your logged food, workouts and weigh-ins are untouched.")
            }
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(UserSettings())
        .modelContainer(Persistence.previewContainer())
}
