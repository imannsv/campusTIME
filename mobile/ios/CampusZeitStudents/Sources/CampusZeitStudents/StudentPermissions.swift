#if canImport(UIKit)
  import AVFoundation
  import CryptoKit
  import SwiftUI
  import UserNotifications
  import UIKit
  import StudentCore

  @MainActor
  final class StudentPermissions: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    @Published var setupOpen = false
    @Published var requesting = false
    @Published var cameraGranted = false
    @Published var notificationsGranted = false
    @Published var openInbox = false
    @Published var error: String?
    @Published private(set) var pushStatus = "Wird eingerichtet"
    private let center = UNUserNotificationCenter.current()
    private var currentScope: String?
    private let setupKey = "campuszeit.permissions.configured"
    private var pushCredential: DeviceCredential?
    private var pushBinding: String?
    private var pushToken: String?
    private var pushRequested = false
    private var syncingPush = false
    private var nextPushAttempt = Date.distantPast

    func configurePush(_ credential: DeviceCredential) {
      guard credential.login.canAccessContent else {
        clearNotifications()
        return
      }
      let scope = noticeScope(credential)
      guard currentScope != scope else { return }
      currentScope = scope
      pushCredential = credential
      pushBinding = UserDefaults.standard.string(forKey: "campuszeit.push.binding." + scope)
      nextPushAttempt = .distantPast
      pushStatus = pushBinding == nil ? "Wird eingerichtet" : "Aktiv"
    }

    private func noticeScope(_ credential: DeviceCredential) -> String {
      let session = SHA256.hash(data: Data(credential.login.token.utf8))
        .map { String(format: "%02x", $0) }.joined()
      return credential.server.absoluteString + "|" + session
    }

    func registeredForPush(_ token: Data) {
      if pushToken != studentPushToken(token) { nextPushAttempt = .distantPast }
      pushToken = studentPushToken(token)
      Task { await syncPush() }
    }

    func pushRegistrationFailed() {
      pushRequested = false
      nextPushAttempt = Date(timeIntervalSinceNow: 300)
      pushStatus = "App-Signierung oder Apple-Verbindung noch nicht bereit"
    }

    func syncPush() async {
      guard let saved = pushCredential, saved.login.canAccessContent,
        saved.login.expires > Date(), !syncingPush,
        Date() >= nextPushAttempt
      else { return }
      let scope = noticeScope(saved)
      let api = StudentAPI(server: saved.server)
      syncingPush = true
      defer { syncingPush = false }
      do {
        if !notificationsGranted {
          if pushBinding != nil { try await api.unregisterPush(token: saved.login.token) }
          guard currentScope == scope else { return }
          pushBinding = nil
          UserDefaults.standard.removeObject(forKey: "campuszeit.push.binding." + scope)
          pushStatus = "Benachrichtigungen nicht freigegeben"
          return
        }
        guard let pushToken else { return }
        let environment =
          Bundle.main.object(forInfoDictionaryKey: "CampusZeitPushEnvironment") as? String
          ?? "sandbox"
        let result = try await api.registerPush(
          token: saved.login.token, deviceToken: pushToken,
          environment: environment, topic: Bundle.main.bundleIdentifier ?? "")
        guard currentScope == scope, !Task.isCancelled else { return }
        pushBinding = result.binding.uuidString
        nextPushAttempt = Date(timeIntervalSinceNow: 300)
        UserDefaults.standard.set(pushBinding, forKey: "campuszeit.push.binding." + scope)
        pushStatus = "Aktiv"
      } catch StudentError.passwordChangeRequired {
        guard currentScope == scope else { return }
        clearNotifications()
        pushStatus = "Zuerst das vorläufige Passwort ändern"
      } catch StudentError.pushUnavailable {
        guard currentScope == scope else { return }
        pushBinding = nil
        UserDefaults.standard.removeObject(forKey: "campuszeit.push.binding." + scope)
        nextPushAttempt = Date(timeIntervalSinceNow: 300)
        pushStatus = "Server-Push noch nicht eingerichtet"
      } catch {
        guard currentScope == scope else { return }
        nextPushAttempt = Date(timeIntervalSinceNow: 300)
        pushStatus = "Push-Verbindung noch nicht bereit; automatischer Neuversuch"
      }
    }

    func installDelegate() { center.delegate = self }

    func prepare() async {
      installDelegate()
      await refreshStatus()
      setupOpen = !UserDefaults.standard.bool(forKey: setupKey)
    }

    func refreshStatus() async {
      cameraGranted = AVCaptureDevice.authorizationStatus(for: .video) == .authorized
      let settings = await center.notificationSettings()
      notificationsGranted = [.authorized, .provisional, .ephemeral].contains(
        settings.authorizationStatus)
      if notificationsGranted, !pushRequested, Date() >= nextPushAttempt, pushCredential != nil {
        pushRequested = true
        UIApplication.shared.registerForRemoteNotifications()
      }
    }

    func request() async {
      guard !requesting else { return }
      requesting = true
      error = nil
      defer { requesting = false }
      if AVCaptureDevice.authorizationStatus(for: .video) == .notDetermined {
        _ = await AVCaptureDevice.requestAccess(for: .video)
      }
      do {
        if await center.notificationSettings().authorizationStatus == .notDetermined {
          _ = try await center.requestAuthorization(options: [.alert, .sound])
        }
        await refreshStatus()
        await syncPush()
        finishSetup()
      } catch {
        self.error =
          "Die Benachrichtigungsfreigabe konnte nicht abgefragt werden. Bitte erneut versuchen oder später in den iPhone-Einstellungen aktivieren."
      }
    }

    func finishSetup() {
      UserDefaults.standard.set(true, forKey: setupKey)
      setupOpen = false
    }

    func clearNotifications() {
      if let currentScope {
        UserDefaults.standard.removeObject(forKey: "campuszeit.push.binding." + currentScope)
      }
      UIApplication.shared.unregisterForRemoteNotifications()
      pushRequested = false
      pushCredential = nil
      pushBinding = nil
      pushToken = nil
      pushStatus = "Nicht angemeldet"
      nextPushAttempt = .distantPast
      currentScope = nil
      openInbox = false
      center.removeAllPendingNotificationRequests()
      center.removeAllDeliveredNotifications()
    }

    func receive(_ notices: [StudentNotice], credential: DeviceCredential) async {
      guard credential.login.canAccessContent else { return }
      configurePush(credential)
      let scope = noticeScope(credential)
      let key = "campuszeit.notices.seen." + scope
      let saved = UserDefaults.standard.array(forKey: key) as? [Int]
      var known = Set(saved ?? [])
      let incoming = newStudentNotices(notices, knownIDs: saved == nil ? nil : known)
      if saved == nil {
        UserDefaults.standard.set(notices.map(\.id), forKey: key)
        return
      }
      await refreshStatus()
      guard !Task.isCancelled, currentScope == scope else { return }
      if !notificationsGranted || pushBinding != nil {
        UserDefaults.standard.set(Array(known.union(notices.map(\.id))), forKey: key)
        return
      }
      // Keep fetch-based banners for builds/servers without APNs; registered devices use remote alerts.
      for notice in incoming {
        guard !Task.isCancelled, currentScope == scope else { return }
        let content = UNMutableNotificationContent()
        content.title = notice.title
        content.body = String(notice.body.prefix(200))
        content.sound = .default
        let identifier = "campuszeit.notice." + scope + ".\(notice.id)"
        do {
          try await center.add(
            UNNotificationRequest(
              identifier: identifier, content: content, trigger: nil))
          guard !Task.isCancelled, currentScope == scope else {
            center.removePendingNotificationRequests(withIdentifiers: [identifier])
            center.removeDeliveredNotifications(withIdentifiers: [identifier])
            return
          }
          known.insert(notice.id)
          UserDefaults.standard.set(Array(known), forKey: key)
        } catch {
          self.error =
            "Eine Mitteilung konnte nicht als Benachrichtigung angezeigt werden. Sie bleibt im Posteingang verfügbar."
        }
      }
    }

    nonisolated func userNotificationCenter(
      _ center: UNUserNotificationCenter, willPresent notification: UNNotification,
      withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
      let payload = notification.request.content.userInfo
      if notification.request.trigger is UNPushNotificationTrigger {
        Task { @MainActor in
          completionHandler(
            matchesStudentPush(payload, binding: self.pushBinding) ? [.banner, .list, .sound] : [])
        }
      } else {
        completionHandler([.banner, .list, .sound])
      }
    }

    nonisolated func userNotificationCenter(
      _ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
      withCompletionHandler completionHandler: @escaping () -> Void
    ) {
      let remote = response.notification.request.trigger is UNPushNotificationTrigger
      let payload = response.notification.request.content.userInfo
      Task { @MainActor in
        if !remote || matchesStudentPush(payload, binding: self.pushBinding) {
          self.openInbox = true
        }
        completionHandler()
      }
    }
  }
#endif
