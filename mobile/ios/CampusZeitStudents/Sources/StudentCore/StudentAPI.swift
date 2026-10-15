import Foundation

#if canImport(FoundationNetworking)
  import FoundationNetworking
#endif

public enum StudentError: LocalizedError {
  case invalidServer, invalidQR, expired, pushUnavailable, passwordChangeRequired
  case service(String)
  public var errorDescription: String? {
    switch self {
    case .invalidServer:
      "Bitte eine HTTPS-Serveradresse ohne Pfad eingeben. Für lokale Tests ist HTTP im privaten Netzwerk möglich."
    case .invalidQR: "Dieser QR-Code ist kein gültiger CampusZeit-Gruppenzugang."
    case .expired: "Dein Zugang ist abgelaufen oder gesperrt. Bitte erneut anmelden."
    case .pushUnavailable: "Push ist auf diesem Server noch nicht eingerichtet."
    case .passwordChangeRequired: "Bitte ändere zuerst dein vorläufiges Passwort."
    case .service(let message): message
    }
  }
}

public func serverURL(_ value: String) throws -> URL {
  guard let url = URL(string: value.trimmingCharacters(in: .whitespacesAndNewlines)),
    let host = url.host?.lowercased(), !host.isEmpty,
    url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
    url.path.isEmpty || url.path == "/"
  else { throw StudentError.invalidServer }
  let labels = host.split(separator: ".", omittingEmptySubsequences: false)
  let octets = labels.compactMap { label -> Int? in
    guard let value = Int(label), (0...255).contains(value), String(value) == label else {
      return nil
    }
    return value
  }
  let privateIP =
    labels.count == 4 && octets.count == 4
    && (octets[0] == 10 || (octets[0] == 192 && octets[1] == 168)
      || (octets[0] == 172 && (16...31).contains(octets[1])) || octets[0] == 127)
  let local = host == "localhost" || host.hasSuffix(".local") || privateIP
  guard url.scheme == "https" || (url.scheme == "http" && local) else {
    throw StudentError.invalidServer
  }
  return url
}

public struct LoginQR: Decodable, Sendable {
  public let version: Int
  public let server: String
  public let access: UUID
  public let key: String
  public static func parse(_ text: String) throws -> Self {
    guard text.utf8.count <= 2048, let data = text.data(using: .utf8),
      let qr = try? JSONDecoder().decode(Self.self, from: data),
      qr.version == 1, (32...100).contains(qr.key.count)
    else { throw StudentError.invalidQR }
    _ = try serverURL(qr.server)
    return qr
  }
}

public struct LoginReply: Codable, Sendable {
  public let token: String
  public let expires: Date
  public let institution: String
  public let scope: String
  public let scopeKind: String
  public let timezone: String
  public var passwordChangeRequired: Bool
  public var isPersonal: Bool { scopeKind == "person" }
  public var canAccessContent: Bool { !passwordChangeRequired }

  enum CodingKeys: String, CodingKey {
    case token, expires, institution, scope, scopeKind, timezone, passwordChangeRequired
  }

  public init(from decoder: Decoder) throws {
    let values = try decoder.container(keyedBy: CodingKeys.self)
    token = try values.decode(String.self, forKey: .token)
    expires = try values.decode(Date.self, forKey: .expires)
    institution = try values.decode(String.self, forKey: .institution)
    scope = try values.decode(String.self, forKey: .scope)
    scopeKind = try values.decode(String.self, forKey: .scopeKind)
    timezone = try values.decode(String.self, forKey: .timezone)
    passwordChangeRequired = try values.decodeIfPresent(Bool.self, forKey: .passwordChangeRequired) ?? false
  }
}

public struct DeviceCredential: Codable, Sendable {
  public let server: URL
  public var login: LoginReply
  public init(server: URL, login: LoginReply) {
    self.server = server
    self.login = login
  }
}

public struct StudentEvent: Codable, Identifiable, Sendable {
  public let id: String
  public let name: String
  public let start: Date
  public let end: Date
  public let kind: String
  public let cancelled: Bool
  public let roomNames: [String]?
  public let groupNames: [String]?
  public let teacherNames: [String]?
}

public struct StudentNotice: Codable, Identifiable, Sendable {
  public let id: Int
  public let title: String
  public let body: String
  public let created: Date
}

public struct StudentFeed: Codable, Sendable {
  public let institution: String
  public let scope: String
  public let timezone: String
  public let updated: Date
  public let rows: [StudentEvent]
  public let notices: [StudentNotice]
}

public func feedDecoder() -> JSONDecoder {
  let decoder = JSONDecoder()
  decoder.keyDecodingStrategy = .convertFromSnakeCase
  decoder.dateDecodingStrategy = .custom { decoder in
    let text = try decoder.singleValueContainer().decode(String.self)
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: text) { return date }
    formatter.formatOptions = [.withInternetDateTime]
    guard let date = formatter.date(from: text) else {
      throw StudentError.service("Ungültige Zeitangabe vom Server.")
    }
    return date
  }
  return decoder
}

public func institutionCalendar(_ zone: String) -> Calendar {
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = TimeZone(identifier: zone) ?? TimeZone(secondsFromGMT: 0)!
  calendar.firstWeekday = 2
  calendar.minimumDaysInFirstWeek = 4
  return calendar
}

public func displayDate(_ date: Date, template: String, zone: TimeZone) -> String {
  let formatter = DateFormatter()
  formatter.locale = Locale(identifier: "de_DE")
  formatter.timeZone = zone
  formatter.dateFormat = template
  return formatter.string(from: date)
}

final class RedirectGuard: NSObject, URLSessionTaskDelegate {
  func urlSession(
    _ session: URLSession, task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void
  ) {
    let original = task.originalRequest?.url
    let next = request.url
    completionHandler(
      original?.scheme == next?.scheme && original?.host == next?.host
        && original?.port == next?.port ? request : nil)
  }
}

public struct StudentAPI: Sendable {
  public let server: URL
  private let configuration: URLSessionConfiguration
  public init(server: URL) {
    self.init(server: server, configuration: .ephemeral)
  }
  init(server: URL, configuration: URLSessionConfiguration) {
    self.server = server
    self.configuration = configuration
  }

  private func request(
    _ path: String, method: String = "GET", body: [String: String]? = nil,
    token: String? = nil, query: [URLQueryItem] = []
  ) async throws -> Data {
    var components = URLComponents(
      url: server.appendingPathComponent("api/student-app/v1/" + path),
      resolvingAgainstBaseURL: false)!
    if !query.isEmpty { components.queryItems = query }
    var request = URLRequest(url: components.url!)
    request.httpMethod = method
    request.timeoutInterval = 20
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    if let token { request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization") }
    if let body {
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
      request.httpBody = try JSONSerialization.data(withJSONObject: body)
    }
    let config = configuration.copy() as! URLSessionConfiguration
    config.httpCookieStorage = nil
    let session = URLSession(configuration: config, delegate: RedirectGuard(), delegateQueue: nil)
    defer { session.finishTasksAndInvalidate() }
    let data: Data
    let response: URLResponse
    do {
      (data, response) = try await session.data(for: request)
    } catch let error as URLError where error.code == .cancelled {
      throw CancellationError()
    }
    guard let response = response as? HTTPURLResponse else {
      throw StudentError.service("Keine Antwort vom Server.")
    }
    if response.statusCode == 401, token != nil { throw StudentError.expired }
    if path == "push/", method == "POST", response.statusCode == 503 {
      throw StudentError.pushUnavailable
    }
    guard (200...299).contains(response.statusCode) else {
      let detail = (try? JSONSerialization.jsonObject(with: data)) as? [String: String]
      if response.statusCode == 403, detail?["code"] == "password_change_required" {
        throw StudentError.passwordChangeRequired
      }
      throw StudentError.service(
        detail?["detail"] ?? "Die Anfrage ist fehlgeschlagen (\(response.statusCode)).")
    }
    return data
  }

  public func login(code: String, password: String) async throws -> LoginReply {
    try feedDecoder().decode(
      LoginReply.self,
      from: await request(
        "login/", method: "POST",
        body: ["code": code.trimmingCharacters(in: .whitespacesAndNewlines), "password": password]))
  }
  public func login(qr: LoginQR) async throws -> LoginReply {
    try feedDecoder().decode(
      LoginReply.self,
      from: await request(
        "login/", method: "POST", body: ["access": qr.access.uuidString, "key": qr.key]))
  }
  public func logout(token: String) async throws {
    _ = try await request("logout/", method: "POST", token: token)
  }
  public func changePassword(token: String, currentPassword: String, newPassword: String) async throws
    -> LoginReply
  {
    try feedDecoder().decode(LoginReply.self,
      from: await request("password/", method: "POST",
        body: ["current_password": currentPassword, "new_password": newPassword], token: token))
  }
  public func registerPush(token: String, deviceToken: String, environment: String, topic: String)
    async throws -> StudentPushRegistration
  {
    try JSONDecoder().decode(
      StudentPushRegistration.self,
      from: await request(
        "push/", method: "POST",
        body: ["token": deviceToken, "environment": environment, "topic": topic], token: token))
  }
  public func unregisterPush(token: String) async throws {
    _ = try await request("push/", method: "DELETE", token: token)
  }
  public func feed(token: String, start: Date, end: Date, zone: String) async throws -> StudentFeed
  {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = institutionCalendar(zone).timeZone
    formatter.dateFormat = "yyyy-MM-dd"
    let query = [
      URLQueryItem(name: "start", value: formatter.string(from: start)),
      URLQueryItem(name: "end", value: formatter.string(from: end)),
    ]
    return try feedDecoder().decode(
      StudentFeed.self, from: await request("feed/", token: token, query: query))
  }
}
