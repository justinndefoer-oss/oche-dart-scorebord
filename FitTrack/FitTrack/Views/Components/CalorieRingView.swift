import SwiftUI

/// The big "calories eaten vs. goal" ring on the dashboard.
struct CalorieRingView: View {
    var consumed: Double
    var goal: Double

    private var progress: Double { NutritionMath.progress(consumed, goal: goal) }
    private var remaining: Double { NutritionMath.remaining(consumed, goal: goal) }
    private var isOver: Bool { remaining < 0 }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.secondary.opacity(0.15), lineWidth: 18)

            Circle()
                .trim(from: 0, to: min(progress, 1))
                .stroke(
                    isOver ? Color.orange : Color.accentColor,
                    style: StrokeStyle(lineWidth: 18, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.easeOut(duration: 0.35), value: progress)

            // A second, thinner arc for the part that went over the goal.
            if progress > 1 {
                Circle()
                    .trim(from: 0, to: min(progress - 1, 1))
                    .stroke(Color.red, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .padding(6)
            }

            VStack(spacing: 2) {
                Text(Format.calories(abs(remaining)))
                    .font(.system(size: 40, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                Text(isOver ? "over goal" : "remaining")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Text("\(Format.calories(consumed)) / \(Format.calories(goal)) kcal")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, 4)
            }
        }
        .frame(width: 190, height: 190)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Calories")
        .accessibilityValue(
            isOver
            ? "\(Format.calories(consumed)) of \(Format.calories(goal)) kilocalories, \(Format.calories(abs(remaining))) over goal"
            : "\(Format.calories(consumed)) of \(Format.calories(goal)) kilocalories, \(Format.calories(remaining)) remaining"
        )
    }
}

#Preview {
    VStack(spacing: 32) {
        CalorieRingView(consumed: 1420, goal: 2200)
        CalorieRingView(consumed: 2560, goal: 2200)
    }
    .padding()
}
