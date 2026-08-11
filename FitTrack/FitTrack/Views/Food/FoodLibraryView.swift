import SwiftUI
import SwiftData

/// Manage the reusable "custom foods" library.
struct FoodLibraryView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @Query(sort: [SortDescriptor(\Food.name, order: .forward)])
    private var foods: [Food]

    @State private var searchText = ""
    @State private var creatingFood = false
    @State private var foodBeingEdited: Food?
    @State private var loggingFood: Food?

    private var filtered: [Food] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return foods }
        return foods.filter { $0.name.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        Group {
            if foods.isEmpty {
                EmptyStateView(
                    title: "No saved foods",
                    message: "Save the things you eat often so you only type the numbers once.",
                    systemImage: "books.vertical"
                )
            } else {
                List {
                    ForEach(filtered) { food in
                        Button {
                            foodBeingEdited = food
                        } label: {
                            FoodRow(food: food)
                        }
                        .buttonStyle(.plain)
                        .swipeActions(edge: .leading) {
                            Button {
                                loggingFood = food
                            } label: {
                                Label("Log", systemImage: "plus.circle")
                            }
                            .tint(.accentColor)
                        }
                    }
                    .onDelete(perform: delete)
                }
                .searchable(text: $searchText, prompt: "Search my foods")
            }
        }
        .navigationTitle("My Foods")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Done") { dismiss() }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    creatingFood = true
                } label: {
                    Label("New Food", systemImage: "plus")
                }
            }
        }
        .sheet(isPresented: $creatingFood) {
            FoodEditorView()
        }
        .sheet(item: $foodBeingEdited) { food in
            FoodEditorView(editing: food)
        }
        .sheet(item: $loggingFood) { food in
            AddFoodEntryView(day: Date(), meal: .snack, prefill: food)
        }
    }

    private func delete(_ offsets: IndexSet) {
        // Deleting a saved food nullifies the link on past entries but leaves
        // their nutrition intact — see `FoodEntry`.
        for index in offsets {
            context.delete(filtered[index])
        }
    }
}

#Preview {
    NavigationStack {
        FoodLibraryView()
    }
    .modelContainer(Persistence.previewContainer())
}
