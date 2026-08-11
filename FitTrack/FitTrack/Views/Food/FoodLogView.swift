import SwiftUI
import SwiftData

/// Browse the food log one day at a time.
///
/// Note on fetching: this screen loads every `FoodEntry` and filters in memory
/// rather than rebuilding a `@Query` predicate per day. For a single-user diary
/// that is a few thousand small rows at most, and it keeps day-paging instant
/// and the code free of dynamic-predicate gymnastics.
struct FoodLogView: View {
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var settings: UserSettings

    @Query(sort: \FoodEntry.date, order: .forward)
    private var allEntries: [FoodEntry]

    @State private var day: Date = Date().startOfDay
    @State private var entryBeingEdited: FoodEntry?
    @State private var addingToMeal: MealCategory?
    @State private var showingLibrary = false

    private var entriesForDay: [FoodEntry] {
        allEntries.filter { $0.dayKey == day.startOfDay }
    }

    private var totals: NutritionTotals {
        NutritionMath.totals(for: entriesForDay)
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    DayNavigator(date: $day)
                        .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))

                    DaySummaryRow(totals: totals, goals: settings.nutritionGoals)
                }

                ForEach(NutritionMath.groupedByMeal(entriesForDay), id: \.meal) { group in
                    Section {
                        if group.entries.isEmpty {
                            Button {
                                addingToMeal = group.meal
                            } label: {
                                Label("Add \(group.meal.title.lowercased())", systemImage: "plus")
                                    .font(.subheadline)
                            }
                        } else {
                            ForEach(group.entries) { entry in
                                Button {
                                    entryBeingEdited = entry
                                } label: {
                                    FoodEntryRow(entry: entry)
                                }
                                .buttonStyle(.plain)
                            }
                            .onDelete { offsets in
                                delete(offsets, in: group.entries)
                            }

                            Button {
                                addingToMeal = group.meal
                            } label: {
                                Label("Add to \(group.meal.title.lowercased())", systemImage: "plus")
                                    .font(.subheadline)
                            }
                        }
                    } header: {
                        HStack {
                            Label(group.meal.title, systemImage: group.meal.symbolName)
                            Spacer()
                            if !group.entries.isEmpty {
                                Text("\(Format.calories(NutritionMath.totals(for: group.entries).calories)) kcal")
                                    .monospacedDigit()
                            }
                        }
                    }
                }
            }
            .navigationTitle("Food Log")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showingLibrary = true
                    } label: {
                        Label("My Foods", systemImage: "books.vertical")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        addingToMeal = suggestedMeal()
                    } label: {
                        Label("Add Food", systemImage: "plus")
                    }
                }
            }
            .sheet(item: $addingToMeal) { meal in
                AddFoodEntryView(day: day, meal: meal)
            }
            .sheet(item: $entryBeingEdited) { entry in
                AddFoodEntryView(editing: entry)
            }
            .sheet(isPresented: $showingLibrary) {
                NavigationStack {
                    FoodLibraryView()
                }
            }
        }
    }

    /// Guess the meal from the time of day so the "+" button lands somewhere sensible.
    private func suggestedMeal() -> MealCategory {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 0..<11: return .breakfast
        case 11..<15: return .lunch
        case 15..<17: return .snack
        case 17..<22: return .dinner
        default: return .snack
        }
    }

    private func delete(_ offsets: IndexSet, in entries: [FoodEntry]) {
        for index in offsets {
            context.delete(entries[index])
        }
    }
}

/// Calories + macros summary shown under the day navigator.
private struct DaySummaryRow: View {
    var totals: NutritionTotals
    var goals: NutritionGoals

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text(Format.calories(totals.calories))
                    .font(.system(size: 32, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                Text("/ \(Format.calories(goals.calories)) kcal")
                    .foregroundStyle(.secondary)
                Spacer()
                let remaining = NutritionMath.remaining(totals.calories, goal: goals.calories)
                Text(remaining >= 0 ? "\(Format.calories(remaining)) left" : "\(Format.calories(-remaining)) over")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(remaining >= 0 ? Color.secondary : Color.orange)
                    .monospacedDigit()
            }

            ProgressView(value: min(NutritionMath.progress(totals.calories, goal: goals.calories), 1))
                .tint(totals.calories > goals.calories ? .orange : .accentColor)

            MacroBarsView(totals: totals, goals: goals)
        }
        .padding(.vertical, 4)
    }
}

/// One logged food in the day list.
struct FoodEntryRow: View {
    var entry: FoodEntry

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.name)
                    .font(.body)
                HStack(spacing: 6) {
                    if entry.servings != 1 {
                        Text("×\(Format.servings(entry.servings))")
                    }
                    Text("P \(Format.number(entry.protein)) · C \(Format.number(entry.carbs)) · F \(Format.number(entry.fat))")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer()
            Text("\(Format.calories(entry.calories))")
                .font(.body.weight(.medium))
                .monospacedDigit()
        }
        .contentShape(Rectangle())
    }
}

#Preview {
    FoodLogView()
        .environmentObject(UserSettings())
        .modelContainer(Persistence.previewContainer())
}
