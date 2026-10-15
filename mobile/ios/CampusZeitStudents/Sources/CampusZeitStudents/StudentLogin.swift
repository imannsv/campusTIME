#if canImport(UIKit)
  import SwiftUI
  import UIKit
  import StudentCore

  struct StudentLogin: View {
    @ObservedObject var store: StudentStore
    @State private var server = ""
    @State private var code = ""
    @State private var password = ""
    @State private var scanning = false
    @State private var scanned: LoginQR?
    @State private var confirmQR = false
    @State private var manualLogin = false
    private let blue = campusBlue
    var body: some View {
      GeometryReader { viewport in
        ScrollView {
          VStack(spacing: 28) {
            if let url = Bundle.module.url(forResource: "Logo", withExtension: "png"),
              let logo = UIImage(contentsOfFile: url.path)
            {
              // The original RGB logo has a pale blue backing; remove it only for display.
              let transparent = logo.cgImage?.copy(
                maskingColorComponents: [233, 235, 240, 242, 246, 248])
                .map { UIImage(cgImage: $0, scale: logo.scale, orientation: logo.imageOrientation) }
              Image(uiImage: transparent ?? logo).resizable().scaledToFit().frame(width: 720, height: 46)
                .frame(width: 230, height: 46, alignment: .leading).clipped()
                .accessibilityLabel("CampusZeit")
            } else {
              Text("CampusZeit").font(.title.bold())
            }
            VStack(alignment: .leading, spacing: 24) {
              VStack(alignment: .leading, spacing: 12) {
                Text("Anmelden").font(.title.weight(.semibold)).foregroundStyle(blue)
                Text("Den QR-Code oder die Zugangsdaten erhältst du von deiner Verwaltung.")
                  .font(.body).foregroundStyle(campusMuted)
              }
              VStack(spacing: 12) {
                Button {
                  scanning = true
                } label: {
                  HStack(spacing: 12) {
                    if store.busy { ProgressView().tint(.white) }
                    Label(store.busy ? "Anmelden …" : "QR-Code scannen", systemImage: "qrcode")
                  }.font(.headline).frame(maxWidth: .infinity, minHeight: 52)
                    .foregroundStyle(.white).background(
                      Color(red: 20 / 255, green: 104 / 255, blue: 243 / 255),
                      in: RoundedRectangle(cornerRadius: 12))
                }.buttonStyle(.plain).disabled(store.busy)
                Button {
                  manualLogin = true
                } label: {
                  Text("Mit Zugangsdaten anmelden").font(.body.weight(.medium))
                    .frame(maxWidth: .infinity, minHeight: 52).foregroundStyle(blue)
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(blue.opacity(0.18)))
                    .contentShape(Rectangle())
                }.buttonStyle(.plain).disabled(store.busy)
              }
              errorMessage
            }.padding(24).campusCard(radius: 26)
          }.frame(maxWidth: 420).padding(24)
            .frame(maxWidth: .infinity, minHeight: viewport.size.height)
        }.scrollBounceBehavior(.basedOnSize)
          .background { CampusBackdrop() }
          .sheet(isPresented: $manualLogin) {
            NavigationStack {
              Form {
                Section {
                  Text("Die Zugangsdaten erhältst du von deiner Verwaltung.")
                    .foregroundStyle(campusMuted)
                }
                Section("Einrichtung") {
                  TextField("Serveradresse (https://…)", text: $server).keyboardType(.URL)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .accessibilityLabel(
                      "Serveradresse")
                }
                Section("Zugang") {
                  TextField("Benutzername oder Zugangscode", text: $code)
                    .textInputAutocapitalization(.never).textContentType(.username)
                    .autocorrectionDisabled().accessibilityLabel("Benutzername oder Zugangscode")
                  SecureField("Passwort", text: $password).textContentType(.password)
                }
                Section {
                  Button("Anmelden") {
                    Task {
                      await store.login(server: server, code: code, password: password)
                      password = ""
                      if store.credential != nil { manualLogin = false }
                    }
                  }.font(.headline).frame(maxWidth: .infinity, minHeight: 44)
                    .foregroundStyle(.white).listRowBackground(
                      Color(red: 20 / 255, green: 104 / 255, blue: 243 / 255)
                    )
                    .disabled(store.busy || server.isEmpty || code.isEmpty || password.isEmpty)
                  if store.busy { ProgressView("Anmelden …") }
                  errorMessage
                }
              }.disabled(store.busy)
                .navigationTitle("Zugangsdaten").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                  ToolbarItem(placement: .cancellationAction) {
                    Button("Schließen") { manualLogin = false }.disabled(store.busy)
                  }
                }
            }.interactiveDismissDisabled(store.busy)
          }
          .sheet(isPresented: $scanning) {
            QRScanner { result in
              scanning = false
              switch result {
              case .success(let text):
                do {
                  scanned = try LoginQR.parse(text)
                  confirmQR = true
                } catch { store.error = error.localizedDescription }
              case .failure(let error): store.error = error.localizedDescription
              }
            }
          }
          .alert("Mit diesem Server verbinden?", isPresented: $confirmQR) {
            Button("Abbrechen", role: .cancel) { scanned = nil }
            Button("Verbinden") {
              if let qr = scanned {
                Task { await store.login(server: qr.server, code: "", password: "", qr: qr) }
              }
              scanned = nil
            }
          } message: {
            Text(scanned?.server ?? "")
          }
      }
    }
    @ViewBuilder private var errorMessage: some View {
      if let error = store.error {
        Label(error, systemImage: "exclamationmark.circle")
          .font(.callout).foregroundStyle(campusRed).accessibilityAddTraits(.updatesFrequently)
      }
    }
  }
#endif
