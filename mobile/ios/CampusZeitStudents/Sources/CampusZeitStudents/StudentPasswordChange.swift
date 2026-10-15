#if canImport(UIKit)
  import SwiftUI

  struct StudentPasswordChange: View {
    @ObservedObject var store: StudentStore
    let mandatory: Bool
    @Environment(\.dismiss) private var dismiss
    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmation = ""

    var body: some View {
      NavigationStack {
        Form {
          Section {
            Text(mandatory
              ? "Lege zuerst dein eigenes Passwort fest. Danach kannst du deinen persönlichen Zugang nutzen."
              : "Ändere das Passwort für deinen persönlichen Zugang. Andere Geräte werden dabei abgemeldet.")
          }
          Section("Passwort") {
            SecureField("Aktuelles Passwort", text: $currentPassword).textContentType(.password)
            SecureField("Neues Passwort", text: $newPassword).textContentType(.newPassword)
            SecureField("Neues Passwort wiederholen", text: $confirmation).textContentType(.newPassword)
            Text("Mindestens 10 Zeichen. Verwende ein Passwort, das du nicht anderweitig nutzt.")
              .font(.footnote).foregroundStyle(campusMuted)
            if !confirmation.isEmpty, newPassword != confirmation {
              Text("Die neuen Passwörter stimmen nicht überein.").foregroundStyle(campusRed)
            }
          }
          Section {
            Button("Passwort speichern") {
              Task {
                if await store.changePassword(currentPassword: currentPassword, newPassword: newPassword) {
                  currentPassword = ""
                  newPassword = ""
                  confirmation = ""
                  if !mandatory { dismiss() }
                }
              }
            }.disabled(store.busy || currentPassword.isEmpty || newPassword.isEmpty
              || newPassword != confirmation)
            if store.busy { ProgressView("Passwort wird geändert …") }
            if let error = store.error {
              Label(error, systemImage: "exclamationmark.circle").foregroundStyle(campusRed)
                .accessibilityAddTraits(.updatesFrequently)
            }
          }
          if mandatory {
            Section {
              Button("Abmelden", role: .destructive) { Task { await store.logout() } }
                .disabled(store.busy)
            }
          }
        }.scrollContentBackground(.hidden).background { CampusBackdrop() }
          .navigationTitle(mandatory ? "Eigenes Passwort festlegen" : "Passwort ändern")
          .navigationBarTitleDisplayMode(.inline)
          .toolbar {
            if !mandatory {
              ToolbarItem(placement: .cancellationAction) {
                Button("Schließen") { dismiss() }.disabled(store.busy)
              }
            }
          }
      }.interactiveDismissDisabled(mandatory || store.busy)
    }
  }
#endif
