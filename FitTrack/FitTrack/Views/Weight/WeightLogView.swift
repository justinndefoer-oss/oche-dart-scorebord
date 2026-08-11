import SwiftUI
import SwiftData
import Charts

/// Body-weight history: a line chart plus the list of readings.
struct WeightLogView: View {
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var settings: UserSettings

    @Query(sort: \WeightEntry.date, order: .reverse)
    private var entries: [WeightEntry]

    @State private var adding = false
    @State private var entryBeingEdited: WeightEntry?
    @State private var range: ChartRange = .month

    enum ChartRange: String, CaseIterable, Identifiable {
        case month = "30d"
        case quarter = "90d"
        case year = "1y"
        case all = "All"

        var id: String { rawValue }

        var days: Int? {
            switch self {
            case .month: return 30
            case .quarter: return 90
            case .year: return 365
            case .all: return nil
            }
        }
    }

    private var series: [WeightPoint] {
        TrendBuilder.weightSeries(from: entries, days: range.days)
    }

    var body: some View {
        NavigationStack {
            Group {
                if entries.isEmpty {
                    EmptyStateView(
                        title: "No weigh-ins yet",
                        message: "Tap + to log your weight. Once you have a couple of readings the chart will fill in.",
                        systemImage: "scalemass"
                    )
                } else {
                    List {
                        Section {
                            Picker("Range", selection: $range) {
                                ForEach(ChartRange.allCases) { option in
                                    Text(option.rawValue).tag(option)
                                }
                            }
                            .pickerStyle(.segmented)

                            WeightChart(points: series, settings: settings, goalKg: settings.weightGoalKg)
                                .frame(height: 200)
                                .padding(.vertical, 8)

                            summaryRow
                        }

                        Section("Readings") {
                            ForEach(entries) { entry in
                                Button {
                                    entryBeingEdited = entry
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(entry.date.dayLabel)
                                            if !entry.note.isEmpty {
                                                Text(entry.note)
                                                    .font(.caption)
                                                    .foregroundStyle(.secondary)
                                            }
                                        }
                                        Spacer()
                                        Text(settings.formattedWeight(entry.weightKg))
                                            .monospacedDigit()
                                    }
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                            }
                            .onDelete(perform: delete)
                        }
                    }
                }
            }
            .navigationTitle("Weight")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        adding = true
                    } label: {
                        Label("Log Weight", systemImage: "plus")
                    }
                }
            }
            .sheet(isPresented: $adding) {
                AddWeightView()
            }
            .sheet(item: $entryBeingEdited) { entry in
                AddWeightView(editing: entry)
            }
        }
    }

    @ViewBuilder
    private var summaryRow: some View {
        let change = TrendBuilder.weightChange(series)
        HStack {
            StatTile(
                title: "Latest",
                value: entries.first.map { settings.formattedWeight($0.weightKg) } ?? "—",
                caption: entries.first?.date.dayLabel,
                systemImage: "scalemass"
            )
            StatTile(
                title: "Change",
                value: change.map { Format.signedNumber(settings.displayWeight($0)) + " " + settings.weightUnit.abbreviation } ?? "—",
                caption: "over \(range.rawValue)",
                systemImage: "arrow.up.arrow.down",
                tint: (change ?? 0) <= 0 ? .green : .orange
            )
        }
        .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
        .listRowBackground(Color.clear)
    }

    private func delete(_ offsets: IndexSet) {
        for index in offsets {
            context.delete(entries[index])
        }
    }
}

/// The weight line chart. Y axis is scaled to the data (never zero-based) so
/// small real changes stay visible.
struct WeightChart: View {
    var points: [WeightPoint]
    var settings: UserSettings
    var goalKg: Double = 0

    private var domain: ClosedRange<Double> {
        let values = points.map { settings.displayWeight($0.weightKg) }
        guard let low = values.min(), let high = values.max() else { return 0...1 }
        let padding = max((high - low) * 0.2, 0.5)
        var lower = low - padding
        var upper = high + padding
        if goalKg > 0 {
            let goal = settings.displayWeight(goalKg)
            lower = min(lower, goal - padding / 2)
            upper = max(upper, goal + padding / 2)
        }
        return lower...upper
    }

    var body: some View {
        if points.count < 2 {
            ContentUnavailableView(
                "Not enough data",
                systemImage: "chart.xyaxis.line",
                description: Text("Log at least two weigh-ins to see a trend.")
            )
            .frame(maxWidth: .infinity)
        } else {
            Chart {
                ForEach(points) { point in
                    LineMark(
                        x: .value("Day", point.day),
                        y: .value("Weight", settings.displayWeight(point.weightKg))
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(Color.accentColor)

                    PointMark(
                        x: .value("Day", point.day),
                        y: .value("Weight", settings.displayWeight(point.weightKg))
                    )
                    .symbolSize(18)
                    .foregroundStyle(Color.accentColor)
                }

                if goalKg > 0 {
                    RuleMark(y: .value("Goal", settings.displayWeight(goalKg)))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                        .foregroundStyle(Color.secondary)
                        .annotation(position: .top, alignment: .leading) {
                            Text("Goal")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                }
            }
            .chartYScale(domain: domain)
            .chartYAxis {
                AxisMarks(position: .leading)
            }
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: 4)) {
                    AxisGridLine()
                    AxisValueLabel(format: .dateTime.day().month(.abbreviated))
                }
            }
        }
    }
}

#Preview {
    WeightLogView()
        .environmentObject(UserSettings())
        .modelContainer(Persistence.previewContainer())
}
