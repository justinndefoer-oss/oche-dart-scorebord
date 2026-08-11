import SwiftUI
import Charts

/// Bar chart of the last seven days' calories with the goal drawn across it.
struct WeeklyCaloriesChart: View {
    var points: [DailyCaloriePoint]
    var goal: Double

    var body: some View {
        Chart {
            ForEach(points) { point in
                BarMark(
                    x: .value("Day", point.day, unit: .day),
                    y: .value("Calories", point.calories)
                )
                .foregroundStyle(point.calories > goal ? Color.orange : Color.accentColor)
                .cornerRadius(4)
            }

            if goal > 0 {
                RuleMark(y: .value("Goal", goal))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    .foregroundStyle(Color.secondary)
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading)
        }
        .chartXAxis {
            AxisMarks(values: points.map(\.day)) { value in
                AxisValueLabel {
                    if let day = value.as(Date.self) {
                        Text(day.shortWeekdayLabel)
                            .font(.caption2)
                    }
                }
            }
        }
        .accessibilityLabel("Calories over the last seven days")
    }
}

#Preview {
    WeeklyCaloriesChart(
        points: DateRanges.lastDays(7).enumerated().map { index, day in
            DailyCaloriePoint(day: day, calories: index == 2 ? 0 : Double(1700 + index * 130))
        },
        goal: 2200
    )
    .frame(height: 180)
    .padding()
}
