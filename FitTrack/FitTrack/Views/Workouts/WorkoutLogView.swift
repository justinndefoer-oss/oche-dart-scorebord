import SwiftUI
import SwiftData

/// Workout history, grouped by day, newest first.
struct WorkoutLogView: View {
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var settings: UserSettings

    @Query(sort: \Workout.date, order: .reverse)
    private var workouts: [Workout]

    @State private var creatingWorkout = false
    @State private var showingTemplates = false
    @State private var startingFromTemplate: WorkoutTemplate?

    private var days: [(day: Date, workouts: [Workout])] {
        TrendBuilder.workoutsByDay(workouts)
    }

    var body: some View {
        NavigationStack {
            Group {
                if workouts.isEmpty {
                    EmptyStateView(
                        title: "No workouts yet",
                        message: "Tap + to log a session, or start one from a saved routine.",
                        systemImage: "dumbbell"
                    )
                } else {
                    List {
                        Section {
                            HStack {
                                StatTile(
                                    title: "This week",
                                    value: "\(TrendBuilder.activeDayCount(workouts, days: 7))",
                                    caption: "active days",
                                    systemImage: "calendar",
                                    tint: .accentColor
                                )
                                StatTile(
                                    title: "Total logged",
                                    value: "\(workouts.count)",
                                    caption: "workouts",
                                    systemImage: "list.bullet",
                                    tint: .accentColor
                                )
                            }
                            .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
                            .listRowBackground(Color.clear)
                        }

                        ForEach(days, id: \.day) { group in
                            Section(group.day.dayLabel) {
                                ForEach(group.workouts) { workout in
                                    NavigationLink {
                                        WorkoutDetailView(workout: workout)
                                    } label: {
                                        WorkoutRow(workout: workout)
                                    }
                                }
                                .onDelete { offsets in
                                    delete(offsets, in: group.workouts)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Workouts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showingTemplates = true
                    } label: {
                        Label("Routines", systemImage: "list.bullet.rectangle")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        creatingWorkout = true
                    } label: {
                        Label("Log Workout", systemImage: "plus")
                    }
                }
            }
            .sheet(isPresented: $creatingWorkout) {
                WorkoutEditorView()
            }
            .sheet(item: $startingFromTemplate) { template in
                WorkoutEditorView(template: template)
            }
            .sheet(isPresented: $showingTemplates) {
                NavigationStack {
                    WorkoutTemplatesView { template in
                        showingTemplates = false
                        // Let the templates sheet finish dismissing first.
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                            startingFromTemplate = template
                        }
                    }
                }
            }
        }
    }

    private func delete(_ offsets: IndexSet, in workouts: [Workout]) {
        for index in offsets {
            context.delete(workouts[index])
        }
    }
}

/// One workout in the history list.
struct WorkoutRow: View {
    var workout: Workout

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: workout.type.symbolName)
                .font(.title3)
                .frame(width: 32)
                .foregroundStyle(.tint)

            VStack(alignment: .leading, spacing: 2) {
                Text(workout.name.isEmpty ? workout.type.title : workout.name)
                Text(workout.summaryLine)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Text(workout.date.timeLabel)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

#Preview {
    WorkoutLogView()
        .environmentObject(UserSettings())
        .modelContainer(Persistence.previewContainer())
}
