#if canImport(UIKit)
  import SwiftUI
  import UIKit
  import StudentCore

  struct ContentView: View {
    @ObservedObject var store: StudentStore
    @ObservedObject var permissions: StudentPermissions
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage("campuszeit.appearance") private var appearance = CampusAppearance.system.rawValue
    @AppStorage("campuszeit.news.dismissed") private var dismissedRelease = ""
    @AppStorage("campuszeit.schedule.view") private var scheduleViewValue = StudentScheduleView.week
      .rawValue
    @State private var tab = 0
    @State private var noticeSearch = ""
    @State private var appeared = false
    @State private var motto = studentMotto()
    @State private var selectedEvent: StudentEvent?
    @State private var daySummary: ScheduleDaySummary?
    @State private var calendarOpen = false
    @State private var passwordChangeOpen = false

    let scheduleBackgroundRefresh: () -> Void

    var body: some View {
      Group {
        if store.requiresPasswordChange {
          StudentPasswordChange(store: store, mandatory: true)
        } else if store.canAccessContent {
          TabView(selection: $tab) {
            home.tabItem { Label("Start", systemImage: "building.2") }.tag(0)
            schedule.tabItem { Label("Stundenplan", systemImage: "calendar") }.tag(1)
            exams.tabItem { Label("Prüfungen", systemImage: "graduationcap") }.tag(2)
            notices.tabItem { Label("Mitteilungen", systemImage: "envelope") }.tag(3)
            profile.tabItem { Label("Profil", systemImage: "person.crop.circle") }.tag(4)
          }
        } else {
          StudentLogin(store: store)
        }
      }
      .opacity(appeared ? 1 : 0)
      .offset(y: appeared || reduceMotion ? 0 : 10)
      .onAppear {
        store.scheduleView = scheduleView
        if reduceMotion {
          appeared = true
        } else {
          withAnimation(.easeOut(duration: 0.35)) { appeared = true }
        }
      }
      .onChange(of: scheduleViewValue) { _, _ in
        store.scheduleView = scheduleView
        Task { await store.refresh() }
      }
      .tint(campusBlue)
      .preferredColorScheme((CampusAppearance(rawValue: appearance) ?? .system).colorScheme)
      .environment(\.locale, Locale(identifier: "de_DE"))
      .environment(\.calendar, store.calendar)
      .environment(\.timeZone, store.calendar.timeZone)
      .task {
        if scenePhase == .active { store.restoreCredentialIfNeeded() }
        await permissions.prepare()
        if permissions.openInbox {
          tab = 3
          permissions.openInbox = false
        }
        scheduleBackgroundRefresh()
      }
      .sheet(isPresented: Binding(
        get: { permissions.setupOpen && !store.requiresPasswordChange },
        set: { permissions.setupOpen = $0 })) { permissionSetup }
      .sheet(isPresented: $passwordChangeOpen) {
        StudentPasswordChange(store: store, mandatory: false)
      }
      .onChange(of: permissions.openInbox) { _, open in
        if open {
          tab = 3
          noticeSearch = ""
          permissions.openInbox = false
          Task { await store.refresh() }
        }
      }
      .sheet(item: $selectedEvent) { event in
        NavigationStack {
          EventDetails(event: event)
            .toolbar {
              ToolbarItem(placement: .confirmationAction) {
                Button("Fertig") { selectedEvent = nil }
              }
            }
        }
      }
      .sheet(item: $daySummary) { summary in
        NavigationStack {
          List {
            if summary.events.isEmpty {
              Text("Keine Veranstaltungen an diesem Tag").foregroundStyle(campusMuted)
            }
            ForEach(summary.events) { event in
              NavigationLink {
                EventDetails(event: event)
              } label: {
                EventRow(event: event)
              }
            }
          }.navigationTitle(
            displayDate(summary.date, template: "EEEE, dd. MMM", zone: store.calendar.timeZone)
          )
          .navigationBarTitleDisplayMode(.inline)
          .toolbar {
            ToolbarItem(placement: .confirmationAction) { Button("Fertig") { daySummary = nil } }
          }
        }
      }
      .onChange(of: store.credential?.login.token) { _, _ in
        selectedEvent = nil
        tab = 0
        noticeSearch = ""
        calendarOpen = false
        daySummary = nil
        passwordChangeOpen = false
        scheduleBackgroundRefresh()
      }
      .onChange(of: store.requiresPasswordChange) { _, required in
        if required {
          selectedEvent = nil
          daySummary = nil
          calendarOpen = false
          passwordChangeOpen = false
        }
        scheduleBackgroundRefresh()
      }
      .task(id: store.canAccessContent ? store.credential?.login.token : nil) {
        guard store.canAccessContent else { return }
        if scenePhase == .active { await store.refresh() }
        while !Task.isCancelled {
          do { try await Task.sleep(for: .seconds(60)) } catch { return }
          if scenePhase == .active { await store.refresh() }
        }
      }
      .sheet(isPresented: $calendarOpen) {
        NavigationStack {
          DatePicker("Datum auswählen", selection: $store.selectedDate, displayedComponents: .date)
            .datePickerStyle(.graphical).padding(16)
            .onChange(of: store.selectedDate) { _, _ in calendarOpen = false }
            .navigationTitle("Datum auswählen").navigationBarTitleDisplayMode(.inline)
            .toolbar {
              ToolbarItem(placement: .confirmationAction) {
                Button("Fertig") { calendarOpen = false }
              }
            }
        }.presentationDetents([.medium, .large])
      }
      .onChange(of: store.selectedDate) { previous, next in
        store.selectSavedWeek()
        let missingDays = ScheduleWeek(
          events: scheduleRows, date: next, calendar: store.calendar, view: scheduleView
        ).days.contains { store.archive?.feed(for: $0) == nil }
        if store.calendar.dateInterval(of: .weekOfYear, for: previous)?.start
          != store.calendar.dateInterval(of: .weekOfYear, for: next)?.start
          || missingDays
        {
          Task { await store.refresh() }
        }
      }
      .onChange(of: scenePhase) { _, next in
        if next == .active {
          motto = studentMotto(after: motto)
          Task {
            store.restoreCredentialIfNeeded()
            await permissions.refreshStatus()
            await store.refresh()
          }
        } else if next == .background {
          scheduleBackgroundRefresh()
        }
      }
    }
    @ViewBuilder private var status: some View {
      if let error = store.error {
        Label(error, systemImage: "exclamationmark.circle").foregroundStyle(campusRed).font(
          .callout)
      }
    }
    @ViewBuilder private var header: some View {
      if store.usingSavedData,
        let savedAt = (tab == 1 ? store.selectedWeekSavedAt : store.archive?.savedAt)
          ?? store.archive?.savedAt
      {
        Label(
          "\(store.connectionUnavailable ? "Offline" : "Geladener Stand") · "
            + displayDate(savedAt, template: "dd.MM., HH:mm", zone: store.calendar.timeZone),
          systemImage: store.connectionUnavailable ? "wifi.slash" : "arrow.down.circle"
        ).font(.footnote.weight(.medium)).foregroundStyle(campusMuted)
          .frame(maxWidth: .infinity, alignment: .leading).padding(12)
          .campusCard(radius: 16).padding(.horizontal, 20).padding(.vertical, 8)
          .accessibilityHint(
            "Letzter geladener Stand. Neue Änderungen werden erst mit Verbindung sichtbar.")
      }
      if store.error != nil {
        status.padding(.horizontal, 24).padding(.vertical, 8)
      }
    }
    private var groupIdentity: some View {
      Button {
        tab = 4
      } label: {
        VStack(spacing: 2) {
          Text(store.credential?.login.institution ?? "").font(.caption).foregroundStyle(
            campusMuted)
          HStack(spacing: 6) {
            Text(store.credential?.login.scope ?? "").font(.subheadline.weight(.semibold))
              .foregroundStyle(campusInk)
            if store.busy { ProgressView().controlSize(.mini) }
          }
        }.lineLimit(1).frame(minHeight: 44)
      }.buttonStyle(.plain).accessibilityHint("Gruppenzugang und Aktualisierungsstand öffnen")
    }
    @ViewBuilder private var brandSymbol: some View {
      if let url = Bundle.module.url(forResource: "Mark", withExtension: "png"),
        let mark = UIImage(contentsOfFile: url.path)
      {
        // The source is RGB with a white backing; mask only the near-white background.
        let transparent = mark.cgImage?.copy(maskingColorComponents: [250, 255, 250, 255, 250, 255])
          .map { UIImage(cgImage: $0, scale: mark.scale, orientation: mark.imageOrientation) }
        Image(uiImage: transparent ?? mark).resizable().scaledToFit().frame(width: 42, height: 42)
          .frame(width: 44, height: 44).clipped().accessibilityLabel("CampusZeit")
      }
    }
    private var dateCaption: String {
      let calendar = store.calendar
      let week = ScheduleWeek(
        events: scheduleRows, date: store.selectedDate,
        calendar: calendar, view: scheduleView)
      let monday = week.days.first!
      let lastDay = week.days.last!
      if week.days.count == 1 {
        return displayDate(monday, template: "dd. MMM", zone: calendar.timeZone)
      }
      let sameMonth = calendar.isDate(monday, equalTo: lastDay, toGranularity: .month)
      return displayDate(monday, template: sameMonth ? "dd." : "dd. MMM", zone: calendar.timeZone)
        + "–" + displayDate(lastDay, template: "dd. MMM", zone: calendar.timeZone)
    }
    private func moveWeek(_ step: Int) {
      store.selectedDate = store.calendar.date(
        byAdding: .day, value: step * scheduleView.rawValue, to: store.selectedDate)!
    }
    private var scheduleView: StudentScheduleView {
      StudentScheduleView(rawValue: scheduleViewValue) ?? .week
    }
    private var scheduleRows: [StudentEvent] {
      store.archive?.events(
        from: store.calendar.dateInterval(of: .weekOfYear, for: store.selectedDate)!.start)
        ?? store.feed?.rows ?? []
    }
    private var weekMenu: some View {
      Menu {
        Section(dateCaption) {
          Button(scheduleView == .week ? "Vorherige Woche" : "Zurück", systemImage: "chevron.left")
          { moveWeek(-1) }
          Button(scheduleView == .week ? "Nächste Woche" : "Weiter", systemImage: "chevron.right") {
            moveWeek(1)
          }
          Button(scheduleView == .week ? "Diese Woche" : "Heute", systemImage: "calendar") {
            store.selectedDate = Date()
            Task { await store.refresh() }
          }
          Button("Datum auswählen", systemImage: "calendar.badge.clock") { calendarOpen = true }
        }
        Picker("Ansicht", selection: $scheduleViewValue) {
          ForEach(StudentScheduleView.allCases, id: \.rawValue) { view in
            let symbol =
              switch view {
              case .day: "rectangle"
              case .twoDays: "rectangle.split.2x1"
              case .threeDays: "rectangle.split.3x1"
              case .week: "tablecells"
              }
            Label(view.title, systemImage: symbol).tag(view.rawValue)
          }
        }
        NavigationLink {
          StudentHelpView()
        } label: {
          Label("Hilfe", systemImage: "questionmark.circle")
        }
        Button("Aktualisieren", systemImage: "arrow.clockwise") { Task { await store.refresh() } }
      } label: {
        Image(systemName: "ellipsis").frame(width: 44, height: 44)
      }.accessibilityLabel("Wochenwahl und Kalender").accessibilityValue(dateCaption)
    }
    private var schedule: some View {
      NavigationStack {
        VStack(spacing: 0) {
          header
          if store.feed != nil {
            let window = ScheduleWeek(
              events: scheduleRows, date: store.selectedDate,
              calendar: store.calendar, view: scheduleView)
            if window.days.contains(where: { store.archive?.feed(for: $0) == nil }) {
              Text("Einzelne Tage sind noch nicht gespeichert.")
                .font(.footnote).foregroundStyle(campusMuted).padding(8)
            }
            StudentWeekGrid(
              events: scheduleRows, date: store.selectedDate, calendar: store.calendar,
              view: scheduleView,
              selectedEvent: $selectedEvent, openCalendar: { calendarOpen = true },
              openDay: { date, rows in
                daySummary = ScheduleDaySummary(date: date, events: rows)
              }
            )
            .simultaneousGesture(
              DragGesture(minimumDistance: 40).onEnded { drag in
                let step = scheduleSwipeStep(
                  horizontal: Double(drag.translation.width),
                  vertical: Double(drag.translation.height))
                if step != 0 { moveWeek(step) }
              })
          } else if store.busy {
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
          } else {
            StudentEmptyState(
              title: "Diese Woche ist noch nicht gespeichert", symbol: "calendar",
              detail:
                "Diese Woche wird automatisch geladen, sobald der Server erreichbar ist."
            ).padding(24)
            Spacer()
          }
        }.background { CampusBackdrop() }.navigationTitle("").navigationBarTitleDisplayMode(.inline)
          .toolbarBackground(.ultraThinMaterial, for: .navigationBar, .tabBar)
          .toolbarBackground(.visible, for: .navigationBar, .tabBar)
          .toolbar {
            ToolbarItem(placement: .topBarLeading) { brandSymbol }
            ToolbarItem(placement: .principal) { groupIdentity }
            ToolbarItem(placement: .topBarTrailing) { weekMenu }
          }
      }
    }
    private var exams: some View {
      NavigationStack {
        VStack(spacing: 0) {
          header
          TimelineView(.periodic(from: .now, by: 60)) { clock in
            ScrollView {
              VStack(alignment: .leading, spacing: 16) {
                Text("Prüfungen").font(.title2.weight(.semibold)).foregroundStyle(campusInk)
                if store.metadata != nil {
                  let today = store.calendar.startOfDay(for: clock.date)
                  let events = store.examRows.filter { $0.end >= today }
                  let nextID = events.first { !$0.cancelled && $0.end >= clock.date }?.id
                  if events.isEmpty {
                    StudentEmptyState(
                      title: "Keine Prüfungstermine", symbol: "graduationcap",
                      detail: "Noch keine Prüfungen im geladenen Zeitraum veröffentlicht.")
                  }
                  ForEach(events) { event in
                    Button {
                      selectedEvent = event
                    } label: {
                      StudentExamCard(
                        event: event, now: clock.date, calendar: store.calendar,
                        prominent: event.id == nextID)
                    }.buttonStyle(.plain)
                  }
                  Text("Veröffentlichte Prüfungen im heruntergeladenen Zeitraum.")
                    .font(.footnote).foregroundStyle(campusMuted).padding(.top, 4)
                } else if !store.busy {
                  StudentEmptyState(
                    title: "Noch keine Prüfungen geladen", symbol: "graduationcap",
                    detail: "Ziehe die Ansicht nach unten zum Aktualisieren.")
                }
              }.padding(20).frame(maxWidth: .infinity, alignment: .leading)
            }.refreshable { await store.refresh() }
          }
        }.background { CampusBackdrop() }
          .navigationTitle("").navigationBarTitleDisplayMode(.inline)
          .toolbarBackground(.ultraThinMaterial, for: .navigationBar, .tabBar)
          .toolbarBackground(.visible, for: .navigationBar, .tabBar)
          .toolbar {
            ToolbarItem(placement: .topBarLeading) { brandSymbol }
            ToolbarItem(placement: .principal) { groupIdentity }
            ToolbarItem(placement: .topBarTrailing) { accountButton }
          }
      }
    }
    private var notices: some View {
      NavigationStack {
        VStack(spacing: 0) {
          header
          HStack(spacing: 10) {
            Image(systemName: "magnifyingglass").foregroundStyle(campusMuted)
            TextField("Mitteilungen suchen", text: $noticeSearch)
              .textInputAutocapitalization(.never).autocorrectionDisabled()
            if !noticeSearch.isEmpty {
              Button {
                noticeSearch = ""
              } label: {
                Image(systemName: "xmark.circle.fill").frame(width: 44, height: 44)
              }
              .accessibilityLabel("Suche löschen")
            }
          }.padding(14).campusCard(radius: 18).padding(16)
          List {
            if let feed = store.metadata {
              let matches = feed.notices.filter {
                noticeSearch.isEmpty || $0.title.localizedStandardContains(noticeSearch)
                  || $0.body.localizedStandardContains(noticeSearch)
              }
              if matches.isEmpty {
                StudentEmptyState(
                  title: noticeSearch.isEmpty ? "Keine Mitteilungen" : "Keine Treffer",
                  symbol: "envelope",
                  detail: noticeSearch.isEmpty
                    ? "Neue Hinweise deiner Verwaltung erscheinen hier."
                    : "Versuche einen anderen Suchbegriff."
                )
                .listRowBackground(campusSurface)
              }
              ForEach(matches) { notice in
                NavigationLink {
                  ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                      Text(notice.title).font(.title2.weight(.semibold))
                      Text(
                        displayDate(
                          notice.created, template: "dd. MMMM yyyy, HH:mm",
                          zone: store.calendar.timeZone)
                      ).font(.subheadline).foregroundStyle(campusMuted)
                      Divider()
                      Text(notice.body).font(.body).textSelection(.enabled)
                    }.frame(maxWidth: .infinity, alignment: .leading).padding(24)
                  }.background(campusSurface).navigationTitle("Mitteilung")
                    .navigationBarTitleDisplayMode(
                      .inline)
                } label: {
                  HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "envelope").foregroundStyle(campusBlue)
                      .frame(width: 40, height: 40).background(campusCanvas, in: Circle())
                      .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 8) {
                      HStack(alignment: .firstTextBaseline) {
                        Text(notice.title).font(.body.weight(.semibold)).lineLimit(2)
                        Spacer(minLength: 8)
                        Text(
                          displayDate(
                            notice.created, template: "dd. MMM", zone: store.calendar.timeZone)
                        )
                        .font(.caption).foregroundStyle(campusMuted)
                      }
                      Text(notice.body).font(.subheadline).foregroundStyle(campusMuted).lineLimit(2)
                    }
                  }.foregroundStyle(campusInk).padding(.vertical, 10)
                }.listRowBackground(campusSurface)
              }
            } else if !store.busy {
              StudentEmptyState(
                title: "Noch keine Mitteilungen geladen", symbol: "envelope",
                detail: "Ziehe die Ansicht nach unten zum Aktualisieren."
              ).listRowBackground(campusSurface)
            }
          }.listStyle(.plain).scrollContentBackground(.hidden)
            .refreshable { await store.refresh() }
        }.background { CampusBackdrop() }.navigationTitle("Mitteilungen")
          .navigationBarTitleDisplayMode(
            .inline
          )
          .toolbarBackground(.ultraThinMaterial, for: .navigationBar, .tabBar)
          .toolbarBackground(.visible, for: .navigationBar, .tabBar)
          .toolbar { ToolbarItem(placement: .topBarLeading) { brandSymbol } }
      }
    }
    private var home: some View {
      NavigationStack {
        VStack(spacing: 0) {
          header
          TimelineView(.periodic(from: .now, by: 60)) { clock in
            let today = store.calendar.startOfDay(for: clock.date)
            let rows = schedulePlacements(store.upcomingRows, day: today, calendar: store.calendar)
              .map(\.event)
            let next = rows.first { !$0.cancelled && $0.end > clock.date }
            ScrollView {
              VStack(alignment: .leading, spacing: 24) {
                homeGreeting(at: clock.date)
                  .padding(.horizontal, -20).padding(.top, -20)
                Button {
                  daySummary = ScheduleDaySummary(date: today, events: rows)
                } label: {
                  HStack(alignment: .center, spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                      Text(displayDate(today, template: "EEEE", zone: store.calendar.timeZone))
                        .font(.subheadline)
                      Text(displayDate(today, template: "dd", zone: store.calendar.timeZone))
                        .font(.system(size: 48, weight: .bold, design: .rounded).monospacedDigit())
                        .foregroundStyle(
                          campusBlue)
                      Text(displayDate(today, template: "MMMM", zone: store.calendar.timeZone))
                        .font(.subheadline)
                    }
                    VStack(alignment: .leading, spacing: 10) {
                      if let next {
                        Text(next.start <= clock.date ? "Jetzt" : "Als Nächstes")
                          .font(.caption.weight(.semibold)).foregroundStyle(campusBlue)
                        Text(next.name).font(.headline).fixedSize(horizontal: false, vertical: true)
                        Text(
                          displayDate(next.start, template: "HH:mm", zone: store.calendar.timeZone)
                            + " – "
                            + displayDate(
                              next.end, template: "HH:mm", zone: store.calendar.timeZone)
                        )
                        .font(.subheadline.monospacedDigit())
                        if let room = next.roomNames?.first {
                          Label(room, systemImage: "door.left.hand.open").font(.subheadline)
                        }
                      } else {
                        Text(
                          !store.todaySaved
                            ? (store.busy ? "Stundenplan wird geladen" : "Noch keine Daten geladen")
                            : rows.isEmpty
                              ? "Heute keine Termine" : "Heute keine weiteren Termine"
                        ).font(.headline)
                        Text(
                          !store.todaySaved
                            ? "Ziehe die Ansicht zum Aktualisieren nach unten."
                            : "\(rows.count) veröffentlichte Termine heute"
                        ).font(.subheadline)
                          .foregroundStyle(campusMuted)
                      }
                    }.frame(maxWidth: .infinity, alignment: .leading).padding(16)
                      .background(campusIce.opacity(0.65), in: RoundedRectangle(cornerRadius: 16))
                  }.padding(20).foregroundStyle(campusInk)
                    .campusCard(radius: 26)
                }.buttonStyle(.plain).disabled(!store.todaySaved).accessibilityHint(
                  "Alle heutigen Termine öffnen")
                if dismissedRelease != StudentRelease.id {
                  HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "info.circle").foregroundStyle(campusBlue)
                      .font(.title3).accessibilityHidden(true)
                    NavigationLink {
                      StudentNewsView()
                    } label: {
                      VStack(alignment: .leading, spacing: 6) {
                        Text("Was gibt es Neues").font(.headline).foregroundStyle(campusInk)
                        Text(StudentRelease.summary).font(.subheadline).foregroundStyle(campusMuted)
                      }.frame(maxWidth: .infinity, alignment: .leading)
                    }.buttonStyle(.plain)
                    Button {
                      dismissedRelease = StudentRelease.id
                    } label: {
                      Image(systemName: "xmark.circle.fill").foregroundStyle(campusMuted)
                        .frame(width: 44, height: 44)
                    }.buttonStyle(.plain).accessibilityLabel("Neuerungen ausblenden")
                  }.padding(16).campusCard()
                }
                VStack(alignment: .leading, spacing: 12) {
                  Text("Schnellzugriff").font(.title3.weight(.semibold))
                    .foregroundStyle(campusInk).padding(.bottom, 2)
                  homeLink("Mein Stundenplan", symbol: "calendar", destination: 1)
                  homeLink("Meine Prüfungen", symbol: "graduationcap", destination: 2)
                  homeLink("Mitteilungen", symbol: "envelope", destination: 3)
                }
                Text("\(store.credential?.login.scope ?? "") · \(store.credential?.login.isPersonal == true ? "Persönlicher Zugang" : "Gruppenzugang")")
                  .font(.subheadline).foregroundStyle(campusMuted)
              }.padding(20).frame(maxWidth: .infinity, alignment: .leading)
            }.refreshable { await store.refresh() }
          }
        }.background { CampusBackdrop() }.navigationTitle("").navigationBarTitleDisplayMode(.inline)
          .toolbarBackground(.ultraThinMaterial, for: .navigationBar, .tabBar)
          .toolbarBackground(.visible, for: .navigationBar, .tabBar)
          .toolbar {
            ToolbarItem(placement: .topBarLeading) { brandSymbol }
            ToolbarItem(placement: .principal) { groupIdentity }
            ToolbarItem(placement: .topBarTrailing) { inboxButton }
          }
      }
    }
    private var inboxButton: some View {
      Button {
        tab = 3
      } label: {
        Image(systemName: "bell").font(.title3).frame(width: 44, height: 44)
      }.accessibilityLabel("Mitteilungen öffnen")
    }
    private func homeGreeting(at date: Date) -> some View {
      VStack(alignment: .leading, spacing: 10) {
        Text(store.credential?.login.institution ?? "CampusZeit")
          .font(.caption.weight(.semibold)).tracking(1).foregroundStyle(campusMuted)
        Text(greeting(at: date))
          .font(.largeTitle.weight(.bold)).tracking(-0.8).foregroundStyle(campusInk)
        Text(motto).font(.subheadline).foregroundStyle(campusInk)
          .frame(maxWidth: 250, alignment: .leading)
          .fixedSize(horizontal: false, vertical: true)
      }.frame(maxWidth: 250, alignment: .leading)
        .padding(.horizontal, 20)
        .frame(maxWidth: .infinity, minHeight: 180, alignment: .leading)
        .padding(.vertical, 16)
        .background {
          if store.credential?.login.institution == "Leibniz-FH",
            let url = Bundle.module.url(forResource: "CampusLeibnizFH", withExtension: "jpg"),
            let photo = UIImage(contentsOfFile: url.path)
          {
            GeometryReader { size in
              Image(uiImage: photo).resizable().scaledToFill()
                .frame(width: size.size.width, height: size.size.height)
                .clipped()
                .mask {
                  LinearGradient(
                    stops: [
                      .init(color: .clear, location: 0),
                      .init(color: .white.opacity(0.03), location: 0.35),
                      .init(color: .white.opacity(0.14), location: 0.6),
                      .init(color: .white.opacity(0.45), location: 0.82),
                      .init(color: .white.opacity(0.85), location: 1),
                    ], startPoint: .leading, endPoint: .trailing)
                }
                .mask {
                  LinearGradient(
                    stops: [
                      .init(color: .clear, location: 0),
                      .init(color: .white, location: 0.18),
                      .init(color: .white, location: 0.55),
                      .init(color: .clear, location: 1),
                    ], startPoint: .top, endPoint: .bottom)
                }
            }.accessibilityHidden(true)
          }
        }
    }
    private func greeting(at date: Date) -> String {
      switch store.calendar.component(.hour, from: date) {
      case 5..<11: return "Guten Morgen"
      case 11..<18: return "Guten Tag"
      default: return "Guten Abend"
      }
    }
    private func homeLink(_ title: String, symbol: String, destination: Int) -> some View {
      Button {
        if destination == 1 { store.selectedDate = Date() }
        tab = destination
      } label: {
        HStack(spacing: 16) {
          let accent = destination == 2 ? campusViolet : destination == 3 ? campusMint : campusBlue
          Image(systemName: symbol).font(.title2.weight(.medium)).foregroundStyle(accent)
            .frame(width: 50, height: 50)
            .background(accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))
          VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.body.weight(.semibold)).foregroundStyle(campusInk)
            Text(
              destination == 1
                ? "Vorlesungen und Räume"
                : destination == 2
                  ? "Termine und Prüfungsdetails" : "Hinweise deiner Verwaltung"
            )
            .font(.caption).foregroundStyle(campusMuted)
          }
          Spacer()
          Image(systemName: "chevron.right").foregroundStyle(campusMuted).font(.subheadline)
        }.padding(16).frame(maxWidth: .infinity, minHeight: 76, alignment: .leading)
          .contentShape(Rectangle()).campusCard(radius: 22)
      }.buttonStyle(.plain)
    }
    private var permissionSetup: some View {
      NavigationStack {
        Form {
          Section {
            HStack(spacing: 12) {
              brandSymbol
              Text("CampusZeit einrichten").font(.title3.weight(.semibold)).foregroundStyle(
                campusInk)
            }
            Text(
              "Du entscheidest, welche Freigaben du erteilst. Die Anmeldung mit Zugangsdaten funktioniert auch ohne Kamera."
            )
            .font(.subheadline).foregroundStyle(campusMuted)
          }
          Section {
            Label("Kamera", systemImage: "qrcode.viewfinder").font(.headline)
            Text("Zum Scannen des QR-Codes deiner Verwaltung.").font(.subheadline)
            Label("Lokales Netzwerk", systemImage: "wifi").font(.headline)
            Text(
              "Für einen CampusZeit-Server im selben WLAN fragt iOS beim Verbindungsaufbau nach der Netzwerkfreigabe."
            )
            .font(.subheadline)
            Label("Benachrichtigungen", systemImage: "bell").font(.headline)
            Text(
              "Für neue Mitteilungen, sobald CampusZeit sie abruft. Push bei geschlossener App ist noch nicht verfügbar."
            )
            .font(.subheadline)
          }
          Section {
            if let error = permissions.error {
              Text(error).foregroundStyle(campusRed).font(.subheadline)
            }
            Button {
              Task { await permissions.request() }
            } label: {
              HStack {
                Text("Freigaben einrichten").fontWeight(.semibold)
                if permissions.requesting {
                  Spacer()
                  ProgressView()
                }
              }.frame(minHeight: 44)
            }.disabled(permissions.requesting)
            Button("Später einrichten") { permissions.finishSetup() }
              .frame(minHeight: 44).disabled(permissions.requesting)
          }
        }.scrollContentBackground(.hidden).background { CampusBackdrop() }
          .navigationTitle("Ersteinrichtung").navigationBarTitleDisplayMode(.inline)
      }.interactiveDismissDisabled().tint(campusBlue)
    }
    private var profile: some View {
      NavigationStack {
        VStack(spacing: 0) {
          header
          Form {
            Section {
              HStack(spacing: 16) {
                Image(systemName: store.credential?.login.isPersonal == true ? "person" : "person.2")
                  .font(.title2).foregroundStyle(campusBlue)
                  .frame(width: 52, height: 52).background(campusCanvas, in: Circle())
                VStack(alignment: .leading, spacing: 6) {
                  Text(store.credential?.login.scope ?? "").font(.title3.weight(.semibold))
                  Text(store.credential?.login.institution ?? "").font(.subheadline)
                    .foregroundStyle(campusMuted)
                  Text(store.credential?.login.isPersonal == true
                    ? "Persönlicher Zugang" : "Gemeinsamer Gruppenzugang")
                    .font(.caption).foregroundStyle(campusBlue)
                }
              }.padding(.vertical, 8)
              if store.credential?.login.isPersonal == true {
                Button("Passwort ändern", systemImage: "key") {
                  store.error = nil
                  passwordChangeOpen = true
                }.disabled(store.busy)
              }
            }
            Section("Darstellung") {
              Picker("Erscheinungsbild", selection: $appearance) {
                ForEach(CampusAppearance.allCases) { mode in
                  Text(mode.title).tag(mode.rawValue)
                }
              }.pickerStyle(.segmented)
              Text("System folgt der hellen oder dunklen Darstellung deines iPhones.")
                .font(.footnote).foregroundStyle(campusMuted)
            }
            Section("Verbindung") {
              LabeledContent("Server", value: store.credential?.server.host ?? "")
              LabeledContent(
                "Status",
                value: store.connectionUnavailable
                  ? "Server nicht erreichbar"
                  : store.usingSavedData ? "Gespeicherter Stand" : "Verbunden")
              if let feed = store.metadata {
                LabeledContent(
                  "Aktualisiert",
                  value: displayDate(
                    feed.updated,
                    template: "dd.MM.yyyy, HH:mm", zone: store.calendar.timeZone))
              }
              Button("Jetzt aktualisieren", systemImage: "arrow.clockwise") {
                Task { await store.refresh() }
              }.disabled(store.busy)
            }
            Section("Offline verfügbar") {
              if let archive = store.archive, let savedAt = archive.savedAt {
                LabeledContent(
                  "Gespeichert",
                  value: displayDate(
                    savedAt,
                    template: "dd.MM.yyyy, HH:mm", zone: store.calendar.timeZone))
                if let first = archive.weeks.map(\.start).min(),
                  let end = archive.weeks.map(\.end).max()
                {
                  let last = store.calendar.date(byAdding: .day, value: -1, to: end)!
                  LabeledContent(
                    "Zeitraum",
                    value: displayDate(first, template: "dd.MM.", zone: store.calendar.timeZone)
                      + "–"
                      + displayDate(last, template: "dd.MM.yyyy", zone: store.calendar.timeZone))
                  Text(
                    "\(archive.weeks.count) gespeicherte Wochen. Bereits geladene frühere Wochen können ebenfalls enthalten sein; dazwischen sind Lücken möglich."
                  )
                  .font(.footnote).foregroundStyle(campusMuted)
                }
              } else {
                Text("Noch kein Offline-Stand vorhanden.")
              }
              LabeledContent(
                "Hintergrundaktualisierung",
                value:
                  UIApplication.shared.backgroundRefreshStatus == .available
                  ? "Von iOS gesteuert" : "Von iOS eingeschränkt")
              Text(
                "Stundenplan, Prüfungen und Mitteilungen werden automatisch geladen und gespeichert – beim Öffnen, während der Nutzung und wenn iOS einen Hintergrundabruf erlaubt. Du musst nichts herunterladen. Gespeichert werden die aktuelle und die nächsten 17 Wochen. Neue Änderungen benötigen Verbindung zum Server."
              )
              .font(.footnote).foregroundStyle(campusMuted)
              if let error = store.cacheError {
                Text(error).font(.subheadline).foregroundStyle(campusRed)
              }
            }
            Section("App-Freigaben") {
              LabeledContent(
                "Kamera", value: permissions.cameraGranted ? "Freigegeben" : "Nicht freigegeben")
              LabeledContent(
                "Benachrichtigungen",
                value: permissions.notificationsGranted ? "Freigegeben" : "Nicht freigegeben")
              LabeledContent("Push-Zustellung", value: permissions.pushStatus)
              Button("Freigaben einrichten") { permissions.setupOpen = true }
              Link(
                "iPhone-Einstellungen öffnen",
                destination: URL(string: UIApplication.openSettingsURLString)!)
              if let error = permissions.error {
                Text(error).font(.subheadline).foregroundStyle(campusRed)
              }
              Text(
                "Push-Mitteilungen benötigen die Freigabe auf diesem Gerät und einen eingerichteten Push-Dienst. Sie können auch bei geschlossener App eintreffen. Auf dem Sperrbildschirm steht nur ein allgemeiner Hinweis; den Inhalt findest du im Posteingang."
              )
              .font(.footnote).foregroundStyle(campusMuted)
            }
            Section("Über CampusZeit") {
              NavigationLink("Was gibt es Neues", destination: StudentNewsView())
              NavigationLink("Hilfe", destination: StudentHelpView())
              NavigationLink("Open-Source-Lizenzen", destination: StudentLicensesView())
              Text("Stundenplan, Prüfungen und Mitteilungen deiner Verwaltung.")
              Text(store.credential?.login.isPersonal == true
                ? "Dieser Zugang ist persönlich. Persönliche Noten und Teilnehmerlisten werden nicht angezeigt."
                : "Dieser Zugang wird gemeinsam von der Gruppe genutzt. Persönliche Noten und Teilnehmerlisten werden nicht angezeigt.")
              .font(.subheadline).foregroundStyle(campusMuted)
            }
            Section {
              Button(
                "Auf diesem Gerät abmelden", systemImage: "rectangle.portrait.and.arrow.right",
                role: .destructive
              ) {
                Task { await store.logout() }
              }
            }
          }.scrollContentBackground(.hidden)
        }.background { CampusBackdrop() }.navigationTitle("Mein Zugang")
          .navigationBarTitleDisplayMode(
            .large
          )
          .toolbarBackground(.ultraThinMaterial, for: .navigationBar, .tabBar)
          .toolbarBackground(.visible, for: .navigationBar, .tabBar)
          .toolbar { ToolbarItem(placement: .topBarLeading) { brandSymbol } }
      }
    }
    private var accountButton: some View {
      Button {
        tab = 4
      } label: {
        Image(systemName: "person.crop.circle")
      }.accessibilityLabel("Mein Zugang")
    }

  }

  private struct ScheduleDaySummary: Identifiable {
    let date: Date
    let events: [StudentEvent]
    var id: Date { date }
  }

  private func eventTint(_ event: StudentEvent) -> Color {
    let colors = [
      campusBlue, campusMint, campusViolet,
    ]
    if event.cancelled { return campusRed }
    if event.kind == "exam" { return colors[2] }
    return colors[event.name.utf8.reduce(0) { ($0 + Int($1)) % colors.count }]
  }

  private struct StudentWeekGrid: View {
    let events: [StudentEvent]
    let date: Date
    let calendar: Calendar
    let view: StudentScheduleView
    @Binding var selectedEvent: StudentEvent?
    let openCalendar: () -> Void
    let openDay: (Date, [StudentEvent]) -> Void
    @ScaledMetric(relativeTo: .caption) private var axisWidth: CGFloat = 44
    @ScaledMetric(relativeTo: .subheadline) private var headerHeight: CGFloat = 52
    @ScaledMetric(relativeTo: .footnote) private var footerHeight: CGFloat = 44

    var body: some View {
      TimelineView(.periodic(from: .now, by: 60)) { clock in
        let week = ScheduleWeek(events: events, date: date, calendar: calendar, view: view)
        GeometryReader { viewport in
          let axis = min(axisWidth, 72)
          let column = max(1, (viewport.size.width - 16 - axis) / CGFloat(week.days.count))
          let plotHeight = max(1, viewport.size.height - headerHeight - footerHeight - 8)
          let duration = week.endMinute - week.startMinute
          let scale = plotHeight / CGFloat(duration)
          let today = week.days.first { calendar.isDate($0, inSameDayAs: clock.date) }
          let nowMinutes = today.map {
            clock.date.timeIntervalSince(
              calendar.date(
                bySettingHour: week.startMinute / 60, minute: week.startMinute % 60,
                second: 0, of: $0)!) / 60
          }
          VStack(spacing: 0) {
            HStack(spacing: 0) {
              Button(action: openCalendar) {
                VStack(alignment: .leading, spacing: 4) {
                  Text("KW \(calendar.component(.weekOfYear, from: week.days[0]))").font(.caption)
                  Text(displayDate(week.days[0], template: "MMM", zone: calendar.timeZone))
                    .font(.subheadline.weight(.semibold))
                }.frame(width: axis, height: headerHeight, alignment: .leading)
                  .foregroundStyle(campusMuted)
              }.buttonStyle(.plain).accessibilityLabel("Kalender öffnen")
                .accessibilityValue(
                  displayDate(week.days[0], template: "MMMM yyyy", zone: calendar.timeZone))
              ForEach(week.days.indices, id: \.self) { index in
                let day = week.days[index]
                Button {
                  openDay(day, week.placements[index].map(\.event))
                } label: {
                  VStack(spacing: 4) {
                    Text(displayDate(day, template: "EE", zone: calendar.timeZone)).font(.caption)
                    Text(displayDate(day, template: "dd", zone: calendar.timeZone))
                      .font(.subheadline.weight(.semibold).monospacedDigit())
                  }.frame(width: column, height: headerHeight)
                    .foregroundStyle(
                      calendar.isDate(day, inSameDayAs: clock.date)
                        ? campusBlue : campusInk.opacity(0.75)
                    )
                    .background(
                      calendar.isDate(day, inSameDayAs: clock.date)
                        ? campusBlue.opacity(0.08) : campusSurface)
                }.buttonStyle(.plain)
                  .accessibilityLabel(
                    displayDate(day, template: "EEEE, dd. MMMM", zone: calendar.timeZone)
                  )
                  .accessibilityHint("Alle Termine dieses Tages anzeigen")
              }
            }.frame(height: headerHeight).background(campusSurface)
            HStack(spacing: 0) {
              ZStack(alignment: .topLeading) {
                ForEach(week.timeTicks, id: \.self) { minute in
                  Text(String(format: "%02d:%02d", minute / 60, minute % 60)).font(
                    .caption.monospacedDigit()
                  )
                  .foregroundStyle(campusMuted).lineLimit(1)
                  .opacity(
                    (minute != week.startMinute && CGFloat(minute - week.startMinute) * scale < 20)
                      || nowMinutes.map {
                        $0 >= 0 && $0 < Double(duration)
                          && abs($0 - Double(minute - week.startMinute)) < 15
                      } == true ? 0 : 1
                  )
                  .offset(y: CGFloat(minute - week.startMinute) * scale)
                }
              }.frame(width: axis, height: plotHeight, alignment: .topLeading).accessibilityHidden(
                true)
              ForEach(week.days.indices, id: \.self) { index in
                dayColumn(
                  week: week, index: index, width: column, height: plotHeight,
                  scale: scale, now: clock.date)
              }
            }.frame(height: plotHeight)
              .overlay(alignment: .topLeading) {
                if let minutes = nowMinutes, minutes >= 0, minutes < Double(duration) {
                  HStack(spacing: 0) {
                    Text(displayDate(clock.date, template: "HH:mm", zone: calendar.timeZone))
                      .font(.caption.weight(.semibold).monospacedDigit())
                      .foregroundStyle(campusRed)
                      .frame(width: axis, alignment: .leading).background(campusCanvas)
                    Rectangle().fill(campusRed).frame(height: 1)
                  }.frame(height: 20).offset(y: CGFloat(minutes) * scale - 10)
                    .allowsHitTesting(false)
                    .accessibilityLabel(
                      "Aktuelle Uhrzeit \(displayDate(clock.date, template: "HH:mm", zone: calendar.timeZone))"
                    )
                }
              }
            Menu {
              ForEach(week.days.indices, id: \.self) { index in
                Button(
                  displayDate(week.days[index], template: "EEEE, dd. MMM", zone: calendar.timeZone)
                ) {
                  openDay(week.days[index], week.placements[index].map(\.event))
                }
              }
            } label: {
              VStack(spacing: 4) {
                if let minutes = nowMinutes, minutes < 0 || minutes >= Double(duration) {
                  Text(
                    "Jetzt \(displayDate(clock.date, template: "HH:mm", zone: calendar.timeZone)) · \(minutes < 0 ? "vor Beginn" : "nach Ende")"
                  )
                  .font(.caption).foregroundStyle(campusRed)
                }
                Label("Termine & Details", systemImage: "list.bullet").font(
                  .footnote.weight(.medium))
              }.frame(maxWidth: .infinity, minHeight: footerHeight)
            }
          }.padding(.horizontal, 8).padding(.bottom, 8).background { CampusBackdrop() }
        }
      }
    }
    private func dayColumn(
      week: ScheduleWeek, index: Int, width: CGFloat,
      height: CGFloat, scale: CGFloat, now: Date
    ) -> some View {
      let day = week.days[index]
      let start = calendar.date(
        bySettingHour: week.startMinute / 60, minute: week.startMinute % 60, second: 0, of: day)!
      let rows = week.placements[index]
      return ZStack(alignment: .topLeading) {
        Rectangle().fill(campusBlue.opacity(calendar.isDate(day, inSameDayAs: now) ? 0.025 : 0))
        ForEach(week.timeTicks, id: \.self) { minute in
          Rectangle().fill(campusMuted.opacity(0.16)).frame(width: width, height: 0.5)
            .offset(y: CGFloat(minute - week.startMinute) * scale)
        }
        ForEach(rows) { item in
          let lane = width / CGFloat(item.lanes)
          let blockHeight = CGFloat(item.end.timeIntervalSince(item.start) / 60) * scale
          let tint = eventTint(item.event)
          VStack(alignment: .leading, spacing: 3) {
            if blockHeight >= 20 {
              Text(lane >= 140 ? item.event.name : scheduleShortTitle(item.event.name)).font(
                .subheadline.weight(.semibold)
              )
              .strikethrough(item.event.cancelled).lineLimit(1)
              if blockHeight >= 48, let teacher = item.event.teacherNames?.first {
                Text(lane >= 140 ? teacher : scheduleShortTitle(teacher)).font(.caption).lineLimit(
                  1
                )
                .strikethrough(item.event.cancelled)
              }
              if blockHeight >= 68, let room = item.event.roomNames?.first {
                Text(room.replacingOccurrences(of: " ", with: "")).font(.caption).lineLimit(1)
                  .strikethrough(item.event.cancelled)
              }
              Spacer(minLength: 0)
              if blockHeight >= 96 {
                Image(systemName: item.event.cancelled ? "xmark.circle.fill" : "info.circle")
                  .font(.caption).foregroundStyle(tint).frame(
                    maxWidth: .infinity, alignment: .trailing)
              }
            }
          }.padding(.leading, 6).padding(.trailing, 3).padding(.vertical, blockHeight >= 40 ? 6 : 1)
            .frame(width: max(1, lane - 4), height: max(1, blockHeight - 4), alignment: .topLeading)
            .foregroundStyle(item.event.cancelled ? tint : campusInk)
            .background(item.event.cancelled ? tint.opacity(0.10) : campusSurface)
            .overlay(alignment: .leading) { Rectangle().fill(tint.opacity(0.7)).frame(width: 3) }
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(
              RoundedRectangle(cornerRadius: 4).stroke(
                item.event.cancelled ? tint : campusInk.opacity(0.12),
                lineWidth: item.event.cancelled ? 1.5 : 0.5)
            )
            .shadow(color: campusInk.opacity(0.08), radius: 3, y: 2)
            .offset(
              x: CGFloat(item.lane) * lane + 1,
              y: CGFloat(item.start.timeIntervalSince(start) / 60) * scale + 1)
        }
      }.frame(width: width, height: height).clipped()
        .overlay(alignment: .trailing) {
          Rectangle().fill(campusMuted.opacity(0.16)).frame(width: 0.5)
        }
        .contentShape(Rectangle())
        .onTapGesture(count: 1, coordinateSpace: .local) { point in
          let time = start.addingTimeInterval(Double(point.y / scale) * 60)
          if let event = scheduleHit(
            rows, time: time, laneFraction: Double(point.x / width),
            tolerance: Double(22 / scale) * 60)
          {
            selectedEvent = event
          } else {
            openDay(day, rows.map(\.event))
          }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
          "\(displayDate(day, template: "EEEE, dd. MMMM", zone: calendar.timeZone)), \(rows.count) Termine"
        )
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { openDay(day, rows.map(\.event)) }
    }
  }

  private struct StudentExamCard: View {
    let event: StudentEvent
    let now: Date
    let calendar: Calendar
    let prominent: Bool
    @ScaledMetric(relativeTo: .body) private var badgeWidth: CGFloat = 52
    @ScaledMetric(relativeTo: .body) private var badgeHeight: CGFloat = 64
    var body: some View {
      let ink = event.cancelled ? campusRed : campusInk
      let accent = event.cancelled ? campusRed : campusBlue
      return VStack(alignment: .leading, spacing: 16) {
        HStack {
          Text(prominent ? "Nächste Prüfung" : "Prüfungstermin")
            .font(.caption.weight(.semibold)).foregroundStyle(accent)
          Spacer()
          Text(
            event.cancelled
              ? "Abgesagt"
              : event.end < now
                ? "Beendet"
                : examCountdown(to: event.start, now: now, calendar: calendar)
          )
          .font(.subheadline.weight(.semibold)).foregroundStyle(ink)
          .padding(.horizontal, 10).padding(.vertical, 5)
          .background(accent.opacity(0.08), in: Capsule())
        }
        HStack(alignment: .top, spacing: 14) {
          VStack(spacing: 4) {
            Text(displayDate(event.start, template: "dd", zone: calendar.timeZone))
              .font(.title2.weight(.semibold).monospacedDigit())
            Text(displayDate(event.start, template: "MMM", zone: calendar.timeZone).uppercased())
              .font(.caption.weight(.semibold))
          }.frame(width: badgeWidth, height: badgeHeight).foregroundStyle(ink)
            .background(
              accent.opacity(prominent ? 0.12 : 0.06),
              in: RoundedRectangle(cornerRadius: 10))
          VStack(alignment: .leading, spacing: 8) {
            Text(event.name).font(prominent ? .title3.weight(.semibold) : .body.weight(.semibold))
              .strikethrough(event.cancelled).fixedSize(horizontal: false, vertical: true)
            Text(displayDate(event.start, template: "EEEE, yyyy", zone: calendar.timeZone))
              .font(.subheadline).foregroundStyle(campusMuted)
          }.frame(maxWidth: .infinity, alignment: .leading)
        }
        VStack(alignment: .leading, spacing: 8) {
          Label(
            "\(displayDate(event.start, template: "HH:mm", zone: calendar.timeZone)) – \(displayDate(event.end, template: "HH:mm", zone: calendar.timeZone))",
            systemImage: "clock")
          if let rooms = event.roomNames, !rooms.isEmpty {
            Label(rooms.joined(separator: ", "), systemImage: "door.left.hand.open")
          }
        }.font(.subheadline).foregroundStyle(ink.opacity(0.85))
      }.padding(18).frame(maxWidth: .infinity, alignment: .leading)
        .foregroundStyle(ink).campusCard(radius: 24)
        .overlay(alignment: .leading) {
          if prominent {
            RoundedRectangle(cornerRadius: 2).fill(accent).frame(width: 3).padding(.vertical, 18)
          }
        }
        .accessibilityElement(children: .combine)
    }
  }

  struct EventRow: View {
    let event: StudentEvent
    @Environment(\.timeZone) private var zone
    @ScaledMetric(relativeTo: .subheadline) private var timeWidth: CGFloat = 56
    var body: some View {
      HStack(alignment: .top, spacing: 16) {
        VStack(alignment: .leading, spacing: 4) {
          Text(displayDate(event.start, template: "HH:mm", zone: zone))
            .font(.subheadline.weight(.semibold).monospacedDigit())
          Text(displayDate(event.end, template: "HH:mm", zone: zone))
            .font(.caption.monospacedDigit()).foregroundStyle(campusMuted)
        }.frame(width: timeWidth, alignment: .leading)
          .foregroundStyle(event.cancelled ? campusRed : campusBlue)
        VStack(alignment: .leading, spacing: 8) {
          Text(event.name).font(.body.weight(.medium)).strikethrough(event.cancelled)
            .fixedSize(horizontal: false, vertical: true)
          if event.cancelled {
            Label("Abgesagt", systemImage: "xmark.circle").font(.subheadline.weight(.medium))
          } else if event.kind == "exam" {
            Text("Prüfung").font(.caption.weight(.medium)).foregroundStyle(campusMuted)
          }
          if let rooms = event.roomNames, !rooms.isEmpty {
            Label(rooms.joined(separator: ", "), systemImage: "door.left.hand.open")
              .font(.footnote).foregroundStyle(campusMuted)
          }
        }
      }.foregroundStyle(event.cancelled ? campusRed : campusInk)
        .padding(.vertical, 16)
    }
  }
  private struct StudentEmptyState: View {
    let title: String
    let symbol: String
    let detail: String
    var body: some View {
      HStack(alignment: .top, spacing: 12) {
        Image(systemName: symbol).font(.title3).foregroundStyle(campusBlue)
          .accessibilityHidden(true)
        VStack(alignment: .leading, spacing: 6) {
          Text(title).font(.body.weight(.medium)).foregroundStyle(campusInk)
          Text(detail).font(.subheadline).foregroundStyle(campusMuted)
        }
      }.padding(.vertical, 24)
    }
  }
  struct EventDetails: View {
    let event: StudentEvent
    @Environment(\.timeZone) private var zone
    var body: some View {
      List {
        Section { EventRow(event: event) }
        Section {
          LabeledContent(
            "Datum", value: displayDate(event.start, template: "dd.MM.yyyy", zone: zone))
          LabeledContent(
            "Dauer", value: "\(Int(event.end.timeIntervalSince(event.start) / 60)) Minuten")
          LabeledContent("Art", value: event.kind == "exam" ? "Prüfung" : "Lehrveranstaltung")
        }
        if let teachers = event.teacherNames, !teachers.isEmpty {
          Section("Lehrende / Aufsicht") { ForEach(teachers, id: \.self) { Text($0) } }
        }
        if let groups = event.groupNames, !groups.isEmpty {
          Section(event.kind == "exam" ? "Prüfungsangaben" : "Gruppen") {
            ForEach(groups, id: \.self) { Text($0) }
          }
        }
      }.scrollContentBackground(.hidden).background { CampusBackdrop() }
        .navigationTitle("Termindetails").navigationBarTitleDisplayMode(.inline)
    }
  }
#endif
