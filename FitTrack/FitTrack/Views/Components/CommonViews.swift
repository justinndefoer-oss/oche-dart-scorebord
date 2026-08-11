import SwiftUI
import UIKit

/// Compact "label + big number" tile used on the dashboard.
struct StatTile: View {
    var title: String
    var value: String
    var caption: String?
    var systemImage: String
    var tint: Color = .accentColor

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: systemImage)
                .font(.caption)
                .foregroundStyle(.secondary)
                .labelStyle(.titleAndIcon)

            Text(value)
                .font(.title3.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(tint)

            if let caption {
                Text(caption)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .combine)
    }
}

/// Placeholder for empty lists. Uses `ContentUnavailableView` (iOS 17+).
struct EmptyStateView: View {
    var title: String
    var message: String
    var systemImage: String

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: systemImage)
        } description: {
            Text(message)
        }
    }
}

/// A titled card used inside the dashboard's scroll view.
struct CardSection<Content: View>: View {
    var title: String
    var systemImage: String?
    var action: (() -> Void)?
    var actionTitle: String?
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                if let systemImage {
                    Label(title, systemImage: systemImage)
                        .font(.headline)
                } else {
                    Text(title).font(.headline)
                }
                Spacer()
                if let action, let actionTitle {
                    Button(actionTitle, action: action)
                        .font(.subheadline)
                }
            }
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}

/// Left/right stepper for moving through days, with the day's label between.
struct DayNavigator: View {
    @Binding var date: Date

    /// Stops you paging into the future.
    private var canGoForward: Bool {
        date.startOfDay < Date().startOfDay
    }

    var body: some View {
        HStack {
            Button {
                date = date.adding(days: -1)
            } label: {
                Image(systemName: "chevron.left")
                    .frame(width: 44, height: 34)
            }
            .buttonStyle(.bordered)
            .accessibilityLabel("Previous day")

            Spacer()

            VStack(spacing: 0) {
                Text(date.dayLabel)
                    .font(.headline)
                if !date.isToday {
                    Text(date.formatted(.dateTime.day().month().year()))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .contentTransition(.identity)

            Spacer()

            Button {
                date = date.adding(days: 1)
            } label: {
                Image(systemName: "chevron.right")
                    .frame(width: 44, height: 34)
            }
            .buttonStyle(.bordered)
            .disabled(!canGoForward)
            .accessibilityLabel("Next day")
        }
    }
}

/// Text field that edits a `Double`, showing an empty field for zero instead
/// of a distracting "0". Used all over the entry forms.
struct NumberField: View {
    private let title: String
    @Binding private var value: Double
    private let unit: String?
    private let decimals: Int

    @State private var text: String = ""
    @FocusState private var isFocused: Bool

    init(title: String, value: Binding<Double>, unit: String? = nil, decimals: Int = 1) {
        self.title = title
        self._value = value
        self.unit = unit
        self.decimals = decimals
    }

    var body: some View {
        HStack {
            Text(title)
            Spacer()
            TextField("0", text: $text)
                .keyboardType(decimals == 0 ? .numberPad : .decimalPad)
                .multilineTextAlignment(.trailing)
                .focused($isFocused)
                .frame(maxWidth: 110)
                .onChange(of: text) { _, newValue in
                    value = Self.parse(newValue) ?? 0
                }
            if let unit {
                Text(unit)
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 28, alignment: .leading)
            }
        }
        .onAppear { syncText() }
        .onChange(of: value) { _, newValue in
            // The value can change from outside (picking a saved food, a
            // stepper). Only take over the text when the user isn't typing.
            guard !isFocused, Self.parse(text) != newValue else { return }
            syncText()
        }
        .onChange(of: isFocused) { _, focused in
            // Tidy the text once the user leaves the field.
            if !focused { syncText() }
        }
    }

    private func syncText() {
        text = value == 0 ? "" : Format.number(value, decimals: decimals)
    }

    /// Accepts both "1.5" and "1,5" — iOS decimal pads differ by region.
    static func parse(_ string: String) -> Double? {
        let normalised = string.replacingOccurrences(of: ",", with: ".")
        return Double(normalised)
    }
}

/// Integer flavour of `NumberField`.
struct IntField: View {
    private let title: String
    @Binding private var value: Int
    private let unit: String?

    @State private var text: String = ""
    @FocusState private var isFocused: Bool

    init(title: String, value: Binding<Int>, unit: String? = nil) {
        self.title = title
        self._value = value
        self.unit = unit
    }

    var body: some View {
        HStack {
            Text(title)
            Spacer()
            TextField("0", text: $text)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
                .focused($isFocused)
                .frame(maxWidth: 110)
                .onChange(of: text) { _, newValue in
                    value = Int(newValue.filter(\.isNumber)) ?? 0
                }
            if let unit {
                Text(unit)
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 28, alignment: .leading)
            }
        }
        .onAppear { syncText() }
        .onChange(of: value) { _, newValue in
            guard !isFocused, Int(text) != newValue else { return }
            syncText()
        }
        .onChange(of: isFocused) { _, focused in
            if !focused { syncText() }
        }
    }

    private func syncText() {
        text = value == 0 ? "" : String(value)
    }
}

#Preview {
    ScrollView {
        VStack(spacing: 16) {
            HStack {
                StatTile(title: "Calories", value: "1,840", caption: "avg / day", systemImage: "flame")
                StatTile(title: "Weight", value: "78.4 kg", caption: "−0.6 this week", systemImage: "scalemass", tint: .green)
            }
            CardSection(title: "Today", systemImage: "sun.max", action: {}, actionTitle: "See all") {
                Text("Card body")
            }
            DayNavigator(date: .constant(Date()))
        }
        .padding()
    }
    .background(Color(.systemGroupedBackground))
}
