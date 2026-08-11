import SwiftUI
import SwiftData
import Charts
import UIKit

/// Home screen: where today stands, quick add buttons, and the weekly trends.
struct DashboardView: View {
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var settings: UserSettings

    @Query(sort: \FoodEntry.date, order: .forward)
    private var foodEntries: [FoodEntry]

    @Query(sort: \Workout.date, order: .reverse)
    private var workouts: [Workout]

    @Query(sort: \WeightEntry.date, order: .reverse)
    private var weightEntries: [WeightEntry]

    @Binding private var selection: RootView.Tab

    @State private var addingFood = false
    @State private var addingWorkout = false
    @State private var addingWeight = false

    init(selection: Binding<RootView.Tab>) {
        self._selection = selection
    }

    private var today: Date { Date().startOfDay }

    private var todaysEntries: [FoodEntry] {
        foodEntries.filter { $0.dayKey == today }
    }

    private var todaysWorkouts: [Workout] {
        workouts.filter { $0.dayKey == today }
    }

    private var totals: NutritionTotals { NutritionMath.totals(for: todaysEntries) }
    private var goals: NutritionGoals { settings.nutritionGoals }
    private var caloriePoints: [DailyCaloriePoint] { TrendBuilder.dailyCalories(from: foodEntries, days: 7) }
    private var weightPoints: [WeightPoint] { TrendBuilder.weightSeries(from: weightEntries, days: 30) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    calorieCard
                    quickAddCard
                    todaysWorkoutCard
                    weeklyCaloriesCard
                    weightCard
                }
                .padding(16)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle(Date().formatted(.dateTime.weekday(.wide).day().month(.wide)))
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $addingFood) {
                AddFoodEntryView(day: today, meal: suggestedMeal())
            }
            .sheet(isPresented: $addingWorkout) {
                WorkoutEditorView()
            }
            .sheet(isPresented: $addingWeight) {
                AddWeightView()
            }
        }
    }

    // MARK: - Cards

    private var calorieCard: some View {
        CardSection(title: "Today", systemImage: "flame", action: { selection = .food }, actionTitle: "Food log") {
            VStack(spacing: 16) {
                CalorieRingView(consumed: totals.calories, goal: goals.calories)
                    .frame(maxWidth: .infinity)

                MacroSplitBar(totals: totals)

                MacroBarsView(totals: totals, goals: goals)
            }
        }
    }

    private var quickAddCard: some View {
        HStack(spacing: 12) {
            QuickAddButton(title: "Food", systemImage: "fork.knife") { addingFood = true }
            QuickAddButton(title: "Workout", systemImage: "dumbbell") { addingWorkout = true }
            QuickAddButton(title: "Weight", systemImage: "scalemass") { addingWeight = true }
        }
    }

    private var todaysWorkoutCard: some View {
        CardSection(
            title: "Today's workout",
            systemImage: "figure.run",
            action: { selection = .workouts },
            actionTitle: "All workouts"
        ) {
            if todaysWorkouts.isEmpty {
                HStack {
                    Text("Nothing logged today.")
                        .foregroundStyle(.secondary)
                    Spacer()
                    Button("Log one") { addingWorkout = true }
                        .font(.subheadline)
                }
            } else {
                VStack(spacing: 12) {
                    ForEach(todaysWorkouts) { workout in
                        WorkoutRow(workout: workout)
                    }
                }
            }
        }
    }

    private var weeklyCaloriesCard: some View {
        CardSection(title: "Calories this week", systemImage: "chart.bar") {
            VStack(alignment: .leading, spacing: 12) {
                WeeklyCaloriesChart(points: caloriePoints, goal: goals.calories)
                    .frame(height: 170)

                HStack {
                    StatTile(
                        title: "Daily average",
                        value: "\(Format.calories(TrendBuilder.averageCalories(caloriePoints)))",
                        caption: "logged days only",
                        systemImage: "flame"
                    )
                    StatTile(
                        title: "Active days",
                        value: "\(TrendBuilder.activeDayCount(workouts, days: 7))",
                        caption: "of last 7",
                        systemImage: "figure.run"
                    )
                }
            }
        }
    }

    private var weightCard: some View {
        CardSection(
            title: "Weight",
            systemImage: "scalemass",
            action: { selection = .weight },
            actionTitle: "History"
        ) {
            VStack(alignment: .leading, spacing: 12) {
                WeightChart(points: weightPoints, settings: settings, goalKg: settings.weightGoalKg)
                    .frame(height: 150)

                if let latest = weightEntries.first {
                    HStack {
                        Text("Latest: \(settings.formattedWeight(latest.weightKg))")
                            .font(.subheadline)
                        Spacer()
                        if let change = TrendBuilder.weightChange(weightPoints) {
                            Text("\(Format.signedNumber(settings.displayWeight(change))) \(settings.weightUnit.abbreviation) over 30d")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

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
}

/// One of the three big quick-add buttons.
private struct QuickAddButton: View {
    var title: String
    var systemImage: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: systemImage)
                    .font(.title3)
                Text(title)
                    .font(.caption)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add \(title.lowercased())")
    }
}

#Preview {
    DashboardView(selection: .constant(.dashboard))
        .environmentObject(UserSettings())
        .modelContainer(Persistence.previewContainer())
}
