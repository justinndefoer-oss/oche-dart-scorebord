import SwiftUI

/// Protein / carbs / fat totals, with progress bars when macro goals are on.
struct MacroBarsView: View {
    var totals: NutritionTotals
    var goals: NutritionGoals

    var body: some View {
        VStack(spacing: 12) {
            MacroRow(title: "Protein", value: totals.protein, goal: goals.protein, tint: .blue)
            MacroRow(title: "Carbs", value: totals.carbs, goal: goals.carbs, tint: .green)
            MacroRow(title: "Fat", value: totals.fat, goal: goals.fat, tint: .orange)
        }
    }
}

private struct MacroRow: View {
    var title: String
    var value: Double
    var goal: Double?
    var tint: Color

    var body: some View {
        VStack(spacing: 4) {
            HStack {
                Text(title)
                    .font(.subheadline)
                Spacer()
                if let goal, goal > 0 {
                    Text("\(Format.grams(value)) / \(Format.grams(goal))")
                        .font(.subheadline)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                } else {
                    Text(Format.grams(value))
                        .font(.subheadline)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
            }

            if let goal, goal > 0 {
                ProgressView(value: min(NutritionMath.progress(value, goal: goal), 1))
                    .tint(value > goal ? .red : tint)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// A single horizontal bar showing where today's calories came from.
struct MacroSplitBar: View {
    var totals: NutritionTotals

    var body: some View {
        let split = NutritionMath.macroSplit(totals)
        VStack(alignment: .leading, spacing: 6) {
            GeometryReader { geometry in
                HStack(spacing: 0) {
                    Rectangle().fill(Color.blue).frame(width: geometry.size.width * split.protein)
                    Rectangle().fill(Color.green).frame(width: geometry.size.width * split.carbs)
                    Rectangle().fill(Color.orange).frame(width: geometry.size.width * split.fat)
                    if split.protein + split.carbs + split.fat == 0 {
                        Rectangle().fill(Color.secondary.opacity(0.15))
                    }
                }
            }
            .frame(height: 8)
            .clipShape(Capsule())

            HStack(spacing: 12) {
                LegendDot(color: .blue, label: "P \(Format.percent(split.protein))")
                LegendDot(color: .green, label: "C \(Format.percent(split.carbs))")
                LegendDot(color: .orange, label: "F \(Format.percent(split.fat))")
            }
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Calorie split by macro")
    }
}

private struct LegendDot: View {
    var color: Color
    var label: String

    var body: some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(label)
        }
    }
}

#Preview {
    VStack(spacing: 24) {
        MacroBarsView(
            totals: NutritionTotals(calories: 1800, protein: 120, carbs: 190, fat: 55),
            goals: NutritionGoals(calories: 2200, protein: 150, carbs: 220, fat: 70)
        )
        MacroSplitBar(totals: NutritionTotals(calories: 1800, protein: 120, carbs: 190, fat: 55))
    }
    .padding()
}
