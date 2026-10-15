#if canImport(UIKit)
  import CryptoKit
  import SwiftUI
  import UIKit
  import StudentCore

  @MainActor
  final class StudentStore: ObservableObject {
    @Published var credential: DeviceCredential?
    @Published var feed: StudentFeed?
    @Published var upcomingRows: [StudentEvent] = []
    @Published private(set) var archive: StudentOfflineArchive?
    @Published private(set) var usingSavedData = false
    @Published private(set) var connectionUnavailable = false
    @Published private(set) var cacheError: String?
    @Published var busy = false
    @Published var error: String?
    @Published var selectedDate = Date()
    var scheduleView = StudentScheduleView.week
    var examRows: [StudentEvent] { upcomingRows.filter { $0.kind == "exam" } }
    var metadata: StudentFeed? { archive?.metadata }
    var requiresPasswordChange: Bool { credential?.login.passwordChangeRequired == true }
    var canAccessContent: Bool { credential?.login.canAccessContent == true }
    var calendar: Calendar { institutionCalendar(credential?.login.timezone ?? "Europe/Berlin") }
    var selectedWeekSavedAt: Date? {
      archive?.weeks.first { $0.start <= selectedDate && selectedDate < $0.end }?.savedAt
    }
    var todaySaved: Bool { archive?.feed(for: calendar.startOfDay(for: Date())) != nil }
    private(set) var credentialRestoreDeferred = false
    private var restorationBlocked = false
    let permissions: StudentPermissions
    private static let cacheURL = FileManager.default.urls(
      for: .applicationSupportDirectory, in: .userDomainMask
    ).first!
    .appendingPathComponent("CampusZeit/offline.json")
    private func cacheSession(_ saved: DeviceCredential) -> String {
      SHA256.hash(data: Data((saved.server.absoluteString + "|" + saved.login.token).utf8))
        .map { String(format: "%02x", $0) }.joined()
    }

    init(permissions: StudentPermissions) {
      self.permissions = permissions
      restoreCredentialIfNeeded()
    }

    func restoreCredentialIfNeeded() {
      guard !restorationBlocked, !requiresPasswordChange else { return }
      guard credential == nil || archive == nil else { return }
      credentialRestoreDeferred = false
      do {
        if let saved = try DeviceKeychain.read() {
          _ = try serverURL(saved.server.absoluteString)
          if saved.login.expires > Date() {
            try DeviceKeychain.save(saved)
            credential = saved
            permissions.configurePush(saved)
          } else {
            try DeviceKeychain.clear()
          }
        }
      } catch {
        credentialRestoreDeferred = !UIApplication.shared.isProtectedDataAvailable
        self.error = error.localizedDescription
        return  // Keep the saved stand when protected storage is temporarily unavailable.
      }
      guard let saved = credential else {
        permissions.clearNotifications()
        try? StudentOfflineArchive.clear(at: Self.cacheURL)
        return
      }
      guard saved.login.canAccessContent else {
        clearContent()
        permissions.clearNotifications()
        try? StudentOfflineArchive.clear(at: Self.cacheURL)
        return
      }
      do {
        archive = try StudentOfflineArchive.load(
          from: Self.cacheURL, session: cacheSession(saved), expires: saved.login.expires)
        if archive == nil { try StudentOfflineArchive.clear(at: Self.cacheURL) }
        usingSavedData = archive != nil
        selectSavedWeek()
        if let archive { persist(archive) }
      } catch is DecodingError {
        try? StudentOfflineArchive.clear(at: Self.cacheURL)
        cacheError = "Der gespeicherte Stand ist beschädigt und wird automatisch neu geladen."
      } catch {
        cacheError =
          "Der Offline-Speicher ist momentan nicht verfügbar. Die App versucht es automatisch erneut."
      }
    }

    func selectSavedWeek() {
      guard canAccessContent else { return }
      feed = archive?.feed(for: selectedDate)
      upcomingRows = archive?.events(from: calendar.startOfDay(for: Date())) ?? []
      if let stamp = selectedWeekSavedAt, let last = archive?.savedAt, stamp < last {
        usingSavedData = true
      }
    }

    func login(server: String, code: String, password: String, qr: LoginQR? = nil) async {
      guard !busy else { return }
      busy = true
      error = nil
      defer { busy = false }
      do {
        let url = try serverURL(server)
        let api = StudentAPI(server: url)
        let reply: LoginReply
        if let qr {
          reply = try await api.login(qr: qr)
        } else {
          reply = try await api.login(code: code, password: password)
        }
        let saved = DeviceCredential(server: url, login: reply)
        do {
          try StudentOfflineArchive.clear(at: Self.cacheURL)
          try DeviceKeychain.save(saved)
        } catch {
          try? await api.logout(token: reply.token)
          throw error
        }
        permissions.clearNotifications()
        credentialRestoreDeferred = false
        restorationBlocked = false
        archive = nil
        feed = nil
        upcomingRows = []
        cacheError = nil
        usingSavedData = false
        connectionUnavailable = false
        selectedDate = Date()
        credential = saved
        guard saved.login.canAccessContent else { return }
        permissions.configurePush(saved)
        await permissions.refreshStatus()
        await permissions.syncPush()
      } catch is CancellationError {} catch { self.error = error.localizedDescription }
    }

    private func clearContent() {
      archive = nil
      feed = nil
      upcomingRows = []
      usingSavedData = false
      connectionUnavailable = false
      cacheError = nil
    }

    func changePassword(currentPassword: String, newPassword: String) async -> Bool {
      guard let saved = credential, saved.login.isPersonal, !busy else { return false }
      busy = true
      error = nil
      defer { busy = false }
      let api = StudentAPI(server: saved.server)
      do {
        // Clear the old session's archive before its token can be revoked.
        try StudentOfflineArchive.clear(at: Self.cacheURL)
        clearContent()
        let reply = try await api.changePassword(token: saved.login.token,
          currentPassword: currentPassword, newPassword: newPassword)
        let replacement = DeviceCredential(server: saved.server, login: reply)
        permissions.clearNotifications()
        do {
          try DeviceKeychain.save(replacement)
        } catch {
          restorationBlocked = true
          credential = nil
          try? DeviceKeychain.clear()
          try? await api.logout(token: reply.token)
          self.error = "Das Passwort wurde geändert, aber der neue Zugang konnte nicht sicher gespeichert werden. Bitte mit dem neuen Passwort erneut anmelden."
          return false
        }
        credential = replacement
        credentialRestoreDeferred = false
        guard reply.canAccessContent else { return false }
        permissions.configurePush(replacement)
        await permissions.refreshStatus()
        await permissions.syncPush()
        Task { await refresh() }
        return true
      } catch StudentError.expired {
        expire()
      } catch is CancellationError {} catch {
        self.error = error.localizedDescription
      }
      return false
    }

    private func requirePasswordChange(_ saved: DeviceCredential) {
      var gated = saved
      gated.login.passwordChangeRequired = true
      credential = gated
      clearContent()
      permissions.clearNotifications()
      error = StudentError.passwordChangeRequired.localizedDescription
      do { try DeviceKeychain.save(gated) } catch { self.error = error.localizedDescription }
      do { try StudentOfflineArchive.clear(at: Self.cacheURL) } catch {
        self.error = error.localizedDescription
      }
    }

    private func expire() {
      try? DeviceKeychain.clear()
      try? StudentOfflineArchive.clear(at: Self.cacheURL)
      permissions.clearNotifications()
      credentialRestoreDeferred = false
      credential = nil
      archive = nil
      feed = nil
      upcomingRows = []
      usingSavedData = false
      connectionUnavailable = false
      cacheError = nil
      error = StudentError.expired.localizedDescription
    }

    @discardableResult
    func refresh(background: Bool = false) async -> Bool {
      guard let saved = credential, saved.login.canAccessContent, !busy, !Task.isCancelled else {
        return false
      }
      guard saved.login.expires > Date() else {
        expire()
        return false
      }
      let requestedDate = selectedDate
      let requestedView = scheduleView
      busy = true
      defer {
        busy = false
        if !background, !Task.isCancelled,
          selectedDate != requestedDate || scheduleView != requestedView, credential != nil
        {
          Task { await refresh() }
        }
      }
      selectSavedWeek()
      do {
        let start = calendar.dateInterval(of: .weekOfYear, for: requestedDate)!.start
        let selectedEnd = calendar.date(
          byAdding: .day, value: requestedView.rawValue, to: calendar.startOfDay(for: requestedDate)
        )!
        let end =
          requestedView == .week
          ? calendar.date(byAdding: .day, value: 7, to: start)!
          : calendar.dateInterval(of: .weekOfYear, for: selectedEnd.addingTimeInterval(-1))!.end
        let today = calendar.startOfDay(for: Date())
        let downloadStart = calendar.dateInterval(of: .weekOfYear, for: today)!.start
        let horizon = calendar.date(byAdding: .day, value: 126, to: downloadStart)!
        let api = StudentAPI(server: saved.server)
        let upcoming = try await api.feed(
          token: saved.login.token, start: downloadStart, end: horizon, zone: saved.login.timezone)
        try Task.checkCancellation()
        guard credential?.login.token == saved.login.token else { return false }
        guard saved.login.expires > Date() else {
          expire()
          return false
        }
        var snapshot = archive ?? StudentOfflineArchive(session: cacheSession(saved))
        snapshot.update(upcoming, start: downloadStart, end: horizon, savedAt: Date())
        archive = snapshot
        usingSavedData = false
        connectionUnavailable = false
        selectSavedWeek()
        error = nil
        persist(snapshot)
        await permissions.receive(upcoming.notices, credential: saved)
        await permissions.syncPush()
        try Task.checkCancellation()
        guard credential?.login.token == saved.login.token else { return false }
        if !background, start < downloadStart || end > horizon {
          let week = try await api.feed(
            token: saved.login.token, start: start, end: end, zone: saved.login.timezone)
          try Task.checkCancellation()
          guard credential?.login.token == saved.login.token else { return false }
          guard saved.login.expires > Date() else {
            expire()
            return false
          }
          snapshot.update(week, start: start, end: end, savedAt: Date())
          archive = snapshot
          usingSavedData = false
          selectSavedWeek()
          persist(snapshot)
        }
        return cacheError == nil && !Task.isCancelled
      } catch StudentError.expired {
        if credential?.login.token == saved.login.token { expire() }
      } catch StudentError.passwordChangeRequired {
        if credential?.login.token == saved.login.token { requirePasswordChange(saved) }
      } catch is CancellationError {} catch {
        if credential?.login.token == saved.login.token {
          usingSavedData = archive != nil
          connectionUnavailable = true
          self.error =
            archive == nil
            ? "Der Server ist momentan nicht erreichbar. Die App versucht es automatisch erneut."
            : nil
        }
      }
      return false
    }

    private func persist(_ snapshot: StudentOfflineArchive) {
      do {
        try snapshot.save(to: Self.cacheURL)
        cacheError = nil
      } catch {
        cacheError =
          "Der Offline-Stand konnte nicht gespeichert werden. Die geladenen Daten bleiben bis zum Schließen verfügbar. Die App versucht das Speichern automatisch erneut."
      }
    }

    func logout() async {
      guard let saved = credential else { return }
      do {
        try StudentOfflineArchive.clear(at: Self.cacheURL)
        try DeviceKeychain.clear()
      } catch {
        self.error = "Die gespeicherten Daten konnten nicht entfernt werden. Bitte erneut abmelden."
        return
      }
      permissions.clearNotifications()
      credentialRestoreDeferred = false
      credential = nil
      archive = nil
      feed = nil
      upcomingRows = []
      usingSavedData = false
      connectionUnavailable = false
      cacheError = nil
      error = nil
      do { try await StudentAPI(server: saved.server).logout(token: saved.login.token) } catch {
        self.error =
          "Auf diesem Gerät abgemeldet. Die Serverabmeldung war nicht erreichbar. Die Verwaltung kann den Zugang bei Bedarf sperren."
      }
    }
  }
#endif
