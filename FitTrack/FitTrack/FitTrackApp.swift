import SwiftUI
import SwiftData

@main
struct FitTrackApp: App {
    @StateObject private var settings = UserSettings()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(settings)
        }
        .modelContainer(Persistence.shared)
    }
}
