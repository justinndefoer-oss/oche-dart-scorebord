import SwiftUI

/// The five top-level tabs.
struct RootView: View {
    @State private var selection: Tab = .dashboard

    enum Tab: Hashable {
        case dashboard, food, workouts, weight, settings
    }

    var body: some View {
        TabView(selection: $selection) {
            DashboardView(selection: $selection)
                .tabItem { Label("Home", systemImage: "house") }
                .tag(Tab.dashboard)

            FoodLogView()
                .tabItem { Label("Food", systemImage: "fork.knife") }
                .tag(Tab.food)

            WorkoutLogView()
                .tabItem { Label("Workouts", systemImage: "dumbbell") }
                .tag(Tab.workouts)

            WeightLogView()
                .tabItem { Label("Weight", systemImage: "scalemass") }
                .tag(Tab.weight)

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .tag(Tab.settings)
        }
    }
}

#Preview {
    RootView()
        .environmentObject(UserSettings())
        .modelContainer(Persistence.previewContainer())
}
