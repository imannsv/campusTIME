#if canImport(UIKit)
  import BackgroundTasks
  import OSLog
  import UIKit

  @MainActor
  final class StudentAppDelegate: NSObject, UIApplicationDelegate {
    static let refreshID = "de.campuszeit.students.refresh"
    let permissions = StudentPermissions()
    lazy var store = StudentStore(permissions: permissions)
    private let logger = Logger(subsystem: "de.campuszeit.students", category: "background-refresh")

    func application(
      _ application: UIApplication,
      didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
      permissions.installDelegate()
      _ = store
      let registered = BGTaskScheduler.shared.register(
        forTaskWithIdentifier: Self.refreshID, using: .main
      ) { [weak self] task in
        guard let self, task is BGAppRefreshTask else {
          task.setTaskCompleted(success: false)
          return
        }
        let operation = Task { @MainActor in
          self.store.restoreCredentialIfNeeded()
          let success = await self.store.refresh(background: true)
          task.expirationHandler = nil
          task.setTaskCompleted(success: success && !Task.isCancelled)
          self.scheduleRefresh()
        }
        task.expirationHandler = { operation.cancel() }
      }
      if !registered { logger.error("Background refresh registration failed") }
      return true
    }

    func application(
      _ application: UIApplication,
      didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
      permissions.registeredForPush(deviceToken)
    }

    func application(
      _ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
      permissions.pushRegistrationFailed()
    }

    func scheduleRefresh() {
      BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.refreshID)
      guard !store.requiresPasswordChange else { return }
      guard
        store.credentialRestoreDeferred
          || (store.credential?.login.expires ?? .distantPast) > Date()
      else { return }
      // shortcut: iOS chooses when background refresh runs; foreground refresh remains automatic.
      let request = BGAppRefreshTaskRequest(identifier: Self.refreshID)
      request.earliestBeginDate = Date(timeIntervalSinceNow: 30 * 60)
      do { try BGTaskScheduler.shared.submit(request) } catch {
        logger.notice(
          "Background refresh scheduling unavailable: \(error.localizedDescription, privacy: .public)"
        )
      }
    }
  }
#endif
