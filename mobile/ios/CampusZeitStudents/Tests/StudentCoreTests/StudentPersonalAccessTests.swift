import Foundation
import XCTest
#if canImport(FoundationNetworking)
  import FoundationNetworking
#endif

@testable import StudentCore

final class StudentPersonalAccessTests: XCTestCase {
  private let legacy = """
    {"token":"old","expires":"2027-01-01T00:00:00Z","institution":"Campus","scope":"A1","scope_kind":"group","timezone":"Europe/Berlin"}
    """

  func testOlderGroupReplyAndStoredCredentialRemainUsable() throws {
    let reply = try feedDecoder().decode(LoginReply.self, from: Data(legacy.utf8))
    XCTAssertFalse(reply.passwordChangeRequired)
    XCTAssertTrue(reply.canAccessContent)
    XCTAssertFalse(reply.isPersonal)
    let saved = DeviceCredential(server: try serverURL("https://campus.example.org"), login: reply)
    let data = try JSONEncoder().encode(saved)
    let restored = try JSONDecoder().decode(DeviceCredential.self, from: data)
    XCTAssertTrue(restored.login.canAccessContent)
    let oldStored = String(decoding: data, as: UTF8.self)
      .replacingOccurrences(of: ",\"passwordChangeRequired\":false", with: "")
      .replacingOccurrences(of: "\"passwordChangeRequired\":false,", with: "")
    XCTAssertFalse(try JSONDecoder().decode(DeviceCredential.self, from: Data(oldStored.utf8))
      .login.passwordChangeRequired)
  }

  func testTemporaryPersonalLoginBlocksContentUntilRotatedReply() throws {
    let personal = legacy.replacingOccurrences(of: "\"group\"", with: "\"person\"")
      .replacingOccurrences(of: "\"token\":\"old\"", with:
        "\"token\":\"temporary\",\"password_change_required\":true")
    let reply = try feedDecoder().decode(LoginReply.self, from: Data(personal.utf8))
    XCTAssertTrue(reply.isPersonal)
    XCTAssertFalse(reply.canAccessContent)
    let restored = try JSONDecoder().decode(LoginReply.self, from: JSONEncoder().encode(reply))
    XCTAssertFalse(restored.canAccessContent)
    let changed = personal.replacingOccurrences(of: "true", with: "false")
    XCTAssertTrue(try feedDecoder().decode(LoginReply.self, from: Data(changed.utf8)).canAccessContent)
  }

  func testPasswordChangePostsAuthenticatedFieldsAndAdoptsRotatedReply() async throws {
    let body = legacy.replacingOccurrences(of: "\"group\"", with: "\"person\"")
      .replacingOccurrences(of: "\"old\"", with: "\"rotated\"")
    PasswordURLProtocol.handler = { request in
      XCTAssertEqual(request.url?.absoluteString, "https://campus.example.org/api/student-app/v1/password/")
      XCTAssertEqual(request.httpMethod, "POST")
      XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer temporary")
      let values = try JSONSerialization.jsonObject(with: XCTUnwrap(request.httpBody)) as? [String: String]
      XCTAssertEqual(values, ["current_password": "temporary pass", "new_password": "new secure password"])
      return (200, Data(body.utf8))
    }
    let reply = try await api().changePassword(token: "temporary",
      currentPassword: "temporary pass", newPassword: "new secure password")
    XCTAssertEqual(reply.token, "rotated")
    XCTAssertTrue(reply.canAccessContent)
  }

  func testPasswordValidationErrorPreservesServerDetail() async throws {
    PasswordURLProtocol.handler = { _ in
      (400, Data("{\"detail\":\"Das neue Passwort ist zu kurz.\"}".utf8))
    }
    do {
      _ = try await api().changePassword(token: "temporary", currentPassword: "old", newPassword: "short")
      XCTFail("Invalid password must fail")
    } catch StudentError.service(let detail) {
      XCTAssertEqual(detail, "Das neue Passwort ist zu kurz.")
    }
  }

  func testFeedPasswordGateIsDistinctFromNetworkFailure() async throws {
    PasswordURLProtocol.handler = { _ in
      (403, Data("{\"code\":\"password_change_required\",\"detail\":\"Bitte Passwort ändern.\"}".utf8))
    }
    do {
      _ = try await api().feed(token: "temporary", start: Date(), end: Date(), zone: "Europe/Berlin")
      XCTFail("Temporary login must not receive content")
    } catch StudentError.passwordChangeRequired {}
  }

  private func api() throws -> StudentAPI {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [PasswordURLProtocol.self]
    return StudentAPI(server: try serverURL("https://campus.example.org"), configuration: configuration)
  }
}

private final class PasswordURLProtocol: URLProtocol {
  nonisolated(unsafe) static var handler: ((URLRequest) throws -> (Int, Data))?
  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
  override func startLoading() {
    do {
      let (status, data) = try Self.handler!(request)
      let response = HTTPURLResponse(url: request.url!, statusCode: status,
        httpVersion: nil, headerFields: ["Content-Type": "application/json"])!
      client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
      client?.urlProtocol(self, didLoad: data)
      client?.urlProtocolDidFinishLoading(self)
    } catch { client?.urlProtocol(self, didFailWithError: error) }
  }
  override func stopLoading() {}
}
