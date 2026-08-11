import SwiftUI
import SwiftData

/// Searchable list of saved foods. Calls back with the one you tap.
struct FoodPickerView: View {
    @Environment(\.dismiss) private var dismiss

    /// Most recently used first, then never-used ones alphabetically.
    @Query(sort: [SortDescriptor(\Food.name, order: .forward)])
    private var foods: [Food]

    @State private var searchText = ""
    private let onSelect: (Food) -> Void

    // Explicit init: with private stored properties around, relying on the
    // synthesised memberwise initialiser is asking for access-level trouble.
    init(onSelect: @escaping (Food) -> Void) {
        self.onSelect = onSelect
    }

    private var filtered: [Food] {
        let matches: [Food]
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        if query.isEmpty {
            matches = foods
        } else {
            matches = foods.filter { $0.name.localizedCaseInsensitiveContains(query) }
        }
        return matches.sorted { lhs, rhs in
            switch (lhs.lastUsedAt, rhs.lastUsedAt) {
            case let (l?, r?): return l > r
            case (_?, nil): return true
            case (nil, _?): return false
            case (nil, nil): return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
            }
        }
    }

    var body: some View {
        Group {
            if foods.isEmpty {
                EmptyStateView(
                    title: "No saved foods yet",
                    message: "Tick “Save to My Foods” when you log something and it will show up here.",
                    systemImage: "books.vertical"
                )
            } else {
                List(filtered) { food in
                    Button {
                        onSelect(food)
                    } label: {
                        FoodRow(food: food)
                    }
                    .buttonStyle(.plain)
                }
                .searchable(text: $searchText, prompt: "Search my foods")
            }
        }
        .navigationTitle("My Foods")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
    }
}

/// Shared row for the picker and the library.
struct FoodRow: View {
    var food: Food

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(food.name)
                HStack(spacing: 6) {
                    if !food.servingDescription.isEmpty {
                        Text(food.servingDescription)
                        Text("·")
                    }
                    Text("P \(Format.number(food.protein)) · C \(Format.number(food.carbs)) · F \(Format.number(food.fat))")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer()
            Text("\(Format.calories(food.calories)) kcal")
                .font(.subheadline)
                .monospacedDigit()
                .foregroundStyle(.secondary)
        }
        .contentShape(Rectangle())
    }
}

#Preview {
    NavigationStack {
        FoodPickerView { _ in }
    }
    .modelContainer(Persistence.previewContainer())
}
